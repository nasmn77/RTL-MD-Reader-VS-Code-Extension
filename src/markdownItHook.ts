import * as vscode from 'vscode';

/**
 * Contributed to VS Code's built-in Markdown preview via
 * `contributes.markdown.markdownItPlugins`. It adds `dir="auto"` to block
 * elements and forces code to LTR, which — together with
 * media/builtin-preview-rtl.css — makes the stock preview render RTL.
 */
export function extendMarkdownIt(md: any): any {
  const enabled = vscode.workspace
    .getConfiguration('rtlMd')
    .get<boolean>('applyToBuiltinPreview', true);

  if (!enabled) {
    return md;
  }

  const rules = md.renderer.rules;

  for (const tag of ['paragraph_open', 'heading_open', 'td_open', 'th_open']) {
    const original = rules[tag];
    rules[tag] = (tokens: any, idx: number, options: any, env: any, self: any) => {
      const token = tokens[idx];
      if (token.attrIndex('dir') < 0) {
        token.attrPush(['dir', 'auto']);
      }
      return original
        ? original(tokens, idx, options, env, self)
        : self.renderToken(tokens, idx, options);
    };
  }

  const originalFence = rules.fence;
  rules.fence = (tokens: any, idx: number, options: any, env: any, self: any) => {
    const html = originalFence
      ? originalFence(tokens, idx, options, env, self)
      : self.renderToken(tokens, idx, options);
    return html.replace('<pre', '<pre dir="ltr"');
  };

  const originalCodeInline = rules.code_inline;
  rules.code_inline = (tokens: any, idx: number, options: any, env: any, self: any) => {
    const html = originalCodeInline
      ? originalCodeInline(tokens, idx, options, env, self)
      : self.renderToken(tokens, idx, options);
    return html.replace('<code', '<code dir="ltr"');
  };

  return md;
}
