import * as vscode from 'vscode';
import { RtlMarkdownEditorProvider } from './editorProvider';
import { extendMarkdownIt } from './markdownItHook';
import { buildHtmlDocument } from './webviewHtml';
import { createMarkdownIt, detectDirection } from './renderer';
import { getConfig, resolveDirection } from './config';

/** Panels opened via the preview commands, keyed by source document URI. */
const previewPanels = new Map<string, vscode.WebviewPanel>();

export function activate(context: vscode.ExtensionContext): { extendMarkdownIt: typeof extendMarkdownIt } {
  context.subscriptions.push(RtlMarkdownEditorProvider.register(context));

  context.subscriptions.push(
    vscode.commands.registerCommand('rtlMd.openPreview', (uri?: vscode.Uri) =>
      openPreview(context, uri, vscode.ViewColumn.Active)
    ),
    vscode.commands.registerCommand('rtlMd.openPreviewToSide', (uri?: vscode.Uri) =>
      openPreview(context, uri, vscode.ViewColumn.Beside)
    ),
    vscode.commands.registerCommand('rtlMd.toggleDirection', toggleDirection),
    vscode.commands.registerCommand('rtlMd.makeDefault', makeDefault),
    vscode.commands.registerCommand('rtlMd.clearDefault', clearDefault),
    vscode.commands.registerCommand('rtlMd.exportHtml', (uri?: vscode.Uri) =>
      exportHtml(context, uri)
    ),
    vscode.commands.registerCommand('rtlMd.print', () =>
      vscode.commands.executeCommand('workbench.action.webview.print')
    )
  );

  // Re-render every open preview when settings change.
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('rtlMd')) {
        for (const [key, panel] of previewPanels) {
          const doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === key);
          if (doc) {
            updatePreview(context, panel, doc);
          }
        }
      }
    })
  );

  // Live-update previews as the user types.
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      const panel = previewPanels.get(e.document.uri.toString());
      if (panel) {
        updatePreview(context, panel, e.document);
      }
    })
  );

  // Scroll sync: editor -> preview.
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorVisibleRanges((e) => {
      if (!getConfig().syncScroll) {
        return;
      }
      const panel = previewPanels.get(e.textEditor.document.uri.toString());
      if (panel && e.visibleRanges.length > 0) {
        panel.webview.postMessage({
          type: 'scrollToLine',
          line: e.visibleRanges[0].start.line
        });
      }
    })
  );

  // VS Code calls this on the extension's exported API to extend the
  // built-in Markdown preview's markdown-it instance.
  return { extendMarkdownIt };
}

export function deactivate(): void {
  /* nothing to tear down */
}

function resolveTargetUri(uri?: vscode.Uri): vscode.Uri | undefined {
  if (uri instanceof vscode.Uri) {
    return uri;
  }
  const editor = vscode.window.activeTextEditor;
  if (editor && isMarkdown(editor.document)) {
    return editor.document.uri;
  }
  return undefined;
}

function isMarkdown(doc: vscode.TextDocument): boolean {
  return doc.languageId === 'markdown' || /\.(md|markdown|mdown|mkd)$/i.test(doc.uri.fsPath);
}

async function openPreview(
  context: vscode.ExtensionContext,
  uri: vscode.Uri | undefined,
  column: vscode.ViewColumn
): Promise<void> {
  const target = resolveTargetUri(uri);
  if (!target) {
    vscode.window.showWarningMessage('افتح ملف Markdown أولاً.');
    return;
  }

  const doc = await vscode.workspace.openTextDocument(target);
  const key = target.toString();

  const existing = previewPanels.get(key);
  if (existing) {
    existing.reveal(column);
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    'rtlMd.preview',
    `معاينة: ${basename(target)}`,
    { viewColumn: column, preserveFocus: true },
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: buildResourceRoots(context, target)
    }
  );

  panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'icon.png');
  previewPanels.set(key, panel);

  panel.onDidDispose(() => previewPanels.delete(key), null, context.subscriptions);

  panel.onDidChangeViewState(() => {
    vscode.commands.executeCommand('setContext', 'rtlMd.previewFocused', panel.active);
  });

  panel.webview.onDidReceiveMessage(
    (msg) => handleWebviewMessage(msg, doc),
    undefined,
    context.subscriptions
  );

  updatePreview(context, panel, doc);
}

async function handleWebviewMessage(msg: any, doc: vscode.TextDocument): Promise<void> {
  if (!msg || typeof msg.type !== 'string') {
    return;
  }
  switch (msg.type) {
    case 'revealLine': {
      if (!getConfig().syncScroll) {
        return;
      }
      const editor = vscode.window.visibleTextEditors.find(
        (e) => e.document.uri.toString() === doc.uri.toString()
      );
      if (editor && typeof msg.line === 'number') {
        const line = Math.max(0, Math.min(msg.line, doc.lineCount - 1));
        editor.revealRange(
          new vscode.Range(line, 0, line, 0),
          vscode.TextEditorRevealType.AtTop
        );
      }
      break;
    }
    case 'openLink': {
      await openLink(msg.href, doc.uri);
      break;
    }
    case 'toggleDirection': {
      await toggleDirection();
      break;
    }
    case 'makeDefault': {
      await makeDefault();
      break;
    }
    case 'copy': {
      if (typeof msg.text === 'string') {
        await vscode.env.clipboard.writeText(msg.text);
        vscode.window.setStatusBarMessage('تم نسخ الكود', 2000);
      }
      break;
    }
  }
}

/**
 * Resolve a Markdown link href to a workspace URI.
 *
 * Markdown link targets are URL-encoded, so `%20` and friends must be decoded
 * before the text reaches `Uri.joinPath` -- otherwise a path containing spaces
 * resolves to a file that does not exist. Absolute paths, `file:` URIs and
 * Windows drive letters are handled separately from document-relative paths.
 * Returns `undefined` when the href is not a file reference we can resolve.
 */
export function resolveLinkUri(
  href: string,
  docUri: vscode.Uri
): { uri: vscode.Uri; fragment: string } | undefined {
  const hashAt = href.indexOf('#');
  const rawPath = hashAt === -1 ? href : href.slice(0, hashAt);
  const fragment = hashAt === -1 ? '' : href.slice(hashAt + 1);

  if (rawPath.length === 0) {
    return undefined;
  }

  let path: string;
  try {
    path = decodeURIComponent(rawPath);
  } catch {
    // Malformed percent-escapes: fall back to the literal text.
    path = rawPath;
  }
  path = path.replace(/\\/g, '/');

  if (/^file:/i.test(rawPath)) {
    return { uri: vscode.Uri.parse(rawPath), fragment };
  }
  if (path.startsWith('/') || /^[a-zA-Z]:\//.test(path)) {
    return { uri: vscode.Uri.file(path), fragment };
  }
  return { uri: vscode.Uri.joinPath(docUri, '..', path), fragment };
}

/**
 * Open a link clicked inside the reader. Markdown files are handed to
 * `vscode.open` so the user's editor association decides whether they land in
 * the reader or the text editor; anything else opens with its default handler.
 */
export async function openLink(href: unknown, docUri: vscode.Uri): Promise<void> {
  if (typeof href !== 'string' || href.length === 0) {
    return;
  }
  if (/^(https?|mailto|vscode|command):/i.test(href)) {
    await vscode.env.openExternal(vscode.Uri.parse(href));
    return;
  }

  const resolved = resolveLinkUri(href, docUri);
  if (!resolved) {
    return;
  }

  // Confirm the target exists before opening: `vscode.open` fails silently on a
  // missing file, which looks to the user like the click did nothing at all.
  try {
    await vscode.workspace.fs.stat(resolved.uri);
  } catch {
    vscode.window.showWarningMessage(
      `تعذر فتح الرابط - الملف غير موجود: ${href}`
    );
    return;
  }

  try {
    await vscode.commands.executeCommand('vscode.open', resolved.uri);
  } catch {
    vscode.window.showWarningMessage(`تعذر فتح الرابط: ${href}`);
  }
}

export function buildResourceRoots(
  context: vscode.ExtensionContext,
  docUri: vscode.Uri
): vscode.Uri[] {
  const roots: vscode.Uri[] = [context.extensionUri, vscode.Uri.joinPath(docUri, '..')];
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    roots.push(folder.uri);
  }
  return roots;
}

export function updatePreview(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  doc: vscode.TextDocument
): void {
  const cfg = getConfig();
  const md = createMarkdownIt(cfg);
  const source = doc.getText();
  const body = md.render(source);
  const dir = resolveDirection(cfg.direction, () => detectDirection(source));

  panel.webview.html = buildHtmlDocument({
    body,
    dir,
    cfg,
    webview: panel.webview,
    extensionUri: context.extensionUri,
    docUri: doc.uri,
    title: basename(doc.uri)
  });
}

async function toggleDirection(): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('rtlMd');
  const current = cfg.get<string>('direction', 'rtl');
  const next = current === 'rtl' ? 'ltr' : 'rtl';
  await cfg.update('direction', next, vscode.ConfigurationTarget.Global);
  vscode.window.setStatusBarMessage(
    next === 'rtl' ? 'الاتجاه: من اليمين إلى اليسار' : 'الاتجاه: من اليسار إلى اليمين',
    2500
  );
}

/**
 * Register the custom editor as the default handler for Markdown files by
 * writing `workbench.editorAssociations`. Existing associations are preserved.
 */
async function makeDefault(): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('workbench');
  const current = cfg.get<Record<string, string>>('editorAssociations') ?? {};

  if (current['*.md'] === RtlMarkdownEditorProvider.viewType) {
    const undo = await vscode.window.showInformationMessage(
      'قارئ RTL هو المحرر الافتراضي لملفات Markdown بالفعل.',
      'إلغاء الافتراضية'
    );
    if (undo) {
      await clearDefault();
    }
    return;
  }

  const confirm = await vscode.window.showInformationMessage(
    'جعل قارئ RTL هو المحرر الافتراضي لملفات Markdown؟',
    {
      modal: true,
      detail:
        'بعد التفعيل:\n' +
        '• النقر المزدوج على أي ملف ‎.md‎ يفتحه في القارئ بالاتجاه من اليمين إلى اليسار.\n' +
        '• للرجوع إلى تحرير النص: زر "✎ تحرير" في شريط الأدوات أعلى القارئ.\n' +
        '• يمكن التراجع في أي وقت عبر الأمر: RTL Markdown: إلغاء جعلها الافتراضية.\n\n' +
        'سيُضاف هذا إلى إعداد workbench.editorAssociations في إعداداتك.'
    },
    'تفعيل'
  );
  if (confirm !== 'تفعيل') {
    return;
  }

  await cfg.update(
    'editorAssociations',
    {
      ...current,
      '*.md': RtlMarkdownEditorProvider.viewType,
      '*.markdown': RtlMarkdownEditorProvider.viewType
    },
    vscode.ConfigurationTarget.Global
  );

  // Reopen the active Markdown file in the reader so the change is visible now
  // rather than only on the next file the user opens. `activeTextEditor` is
  // undefined when the reader webview itself has focus, in which case the file
  // is already open in the reader and there is nothing to reopen.
  const active = vscode.window.activeTextEditor;
  if (active && isMarkdown(active.document)) {
    await vscode.commands.executeCommand(
      'vscode.openWith',
      active.document.uri,
      RtlMarkdownEditorProvider.viewType
    );
  }

  vscode.window.showInformationMessage(
    'تم التفعيل. ستُفتح ملفات Markdown الآن في قارئ RTL.'
  );
}

async function clearDefault(): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('workbench');
  const current = { ...(cfg.get<Record<string, string>>('editorAssociations') ?? {}) };
  let changed = false;
  for (const key of Object.keys(current)) {
    if (current[key] === 'rtlMd.reader') {
      delete current[key];
      changed = true;
    }
  }
  if (!changed) {
    vscode.window.showInformationMessage('القارئ ليس مضبوطاً كافتراضي أصلاً.');
    return;
  }
  await cfg.update('editorAssociations', current, vscode.ConfigurationTarget.Global);
  vscode.window.showInformationMessage('تم إلغاء الافتراضية. ستُفتح ملفات MD في المحرر النصي.');
}

async function exportHtml(
  context: vscode.ExtensionContext,
  uri?: vscode.Uri
): Promise<void> {
  const target = resolveTargetUri(uri);
  if (!target) {
    vscode.window.showWarningMessage('افتح ملف Markdown أولاً.');
    return;
  }
  const doc = await vscode.workspace.openTextDocument(target);
  const cfg = getConfig();
  const md = createMarkdownIt(cfg);
  const source = doc.getText();
  const body = md.render(source);
  const dir = resolveDirection(cfg.direction, () => detectDirection(source));

  const html = buildHtmlDocument({
    body,
    dir,
    cfg,
    webview: undefined,
    extensionUri: context.extensionUri,
    docUri: doc.uri,
    title: basename(doc.uri),
    standalone: true
  });

  const defaultPath = target.fsPath.replace(/\.(md|markdown|mdown|mkd)$/i, '') + '.html';
  const saveUri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(defaultPath),
    filters: { HTML: ['html'] }
  });
  if (!saveUri) {
    return;
  }
  await vscode.workspace.fs.writeFile(saveUri, Buffer.from(html, 'utf8'));
  const open = await vscode.window.showInformationMessage(
    `تم التصدير إلى ${basename(saveUri)}`,
    'فتح في المتصفح'
  );
  if (open) {
    await vscode.env.openExternal(saveUri);
  }
}

export function basename(uri: vscode.Uri): string {
  const parts = uri.path.split('/');
  return parts[parts.length - 1] || uri.path;
}
