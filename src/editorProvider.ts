import * as vscode from 'vscode';
import { buildHtmlDocument } from './webviewHtml';
import { createMarkdownIt, detectDirection } from './renderer';
import { getConfig, resolveDirection } from './config';
import { basename, buildResourceRoots, openLink } from './extension';

/**
 * A read-only custom text editor for Markdown. Registering it lets the user set
 * `workbench.editorAssociations` so `.md` files open straight into the RTL
 * reader instead of the plain text editor.
 */
export class RtlMarkdownEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'rtlMd.reader';

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new RtlMarkdownEditorProvider(context);
    return vscode.window.registerCustomEditorProvider(
      RtlMarkdownEditorProvider.viewType,
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: true
      }
    );
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    panel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: buildResourceRoots(this.context, document.uri)
    };

    const render = () => this.render(document, panel);
    render();

    const changeSub = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        render();
      }
    });

    const configSub = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('rtlMd')) {
        render();
      }
    });

    const themeSub = vscode.window.onDidChangeActiveColorTheme(() => render());

    panel.onDidChangeViewState(() => {
      vscode.commands.executeCommand('setContext', 'rtlMd.previewFocused', panel.active);
    });

    const msgSub = panel.webview.onDidReceiveMessage((msg) =>
      this.handleMessage(msg, document)
    );

    panel.onDidDispose(() => {
      changeSub.dispose();
      configSub.dispose();
      themeSub.dispose();
      msgSub.dispose();
    });
  }

  private render(document: vscode.TextDocument, panel: vscode.WebviewPanel): void {
    const cfg = getConfig(document.uri);
    const md = createMarkdownIt(cfg);
    const source = document.getText();
    const body = md.render(source);
    const dir = resolveDirection(cfg.direction, () => detectDirection(source));

    panel.webview.html = buildHtmlDocument({
      body,
      dir,
      cfg,
      webview: panel.webview,
      extensionUri: this.context.extensionUri,
      docUri: document.uri,
      title: basename(document.uri),
      isCustomEditor: true
    });
  }

  private async handleMessage(msg: any, document: vscode.TextDocument): Promise<void> {
    if (!msg || typeof msg.type !== 'string') {
      return;
    }
    switch (msg.type) {
      case 'editSource':
        // Reopen the same file in the plain text editor so the user can edit it
        // even when this reader is the default association.
        await vscode.commands.executeCommand(
          'vscode.openWith',
          document.uri,
          'default',
          vscode.ViewColumn.Active
        );
        break;
      case 'toggleDirection': {
        const cfg = vscode.workspace.getConfiguration('rtlMd');
        const current = cfg.get<string>('direction', 'rtl');
        await cfg.update(
          'direction',
          current === 'rtl' ? 'ltr' : 'rtl',
          vscode.ConfigurationTarget.Global
        );
        break;
      }
      case 'openLink':
        await openLink(msg.href, document.uri);
        break;
      case 'copy':
        if (typeof msg.text === 'string') {
          await vscode.env.clipboard.writeText(msg.text);
          vscode.window.setStatusBarMessage('تم نسخ الكود', 2000);
        }
        break;
      case 'print':
        await vscode.commands.executeCommand('workbench.action.webview.print');
        break;
    }
  }
}
