import * as vscode from 'vscode';

export interface RtlMdConfig {
  direction: 'rtl' | 'ltr' | 'auto';
  applyToBuiltinPreview: boolean;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  maxContentWidth: string;
  codeBlockDirection: 'ltr' | 'rtl' | 'inherit';
  tableHeaderAlign: 'auto' | 'right' | 'center' | 'left';
  enableMermaid: boolean;
  enableMath: boolean;
  enableTaskLists: boolean;
  enableFootnotes: boolean;
  syncScroll: boolean;
  showToolbar: boolean;
  showToc: boolean;
}

/** Font stack that renders Arabic well on Windows, macOS and Linux. */
export const DEFAULT_FONT_STACK =
  "'Segoe UI', 'Noto Naskh Arabic', 'Geeza Pro', 'Dubai', 'Tahoma', 'Amiri', 'Scheherazade New', system-ui, -apple-system, sans-serif";

export function getConfig(scope?: vscode.Uri): RtlMdConfig {
  const c = vscode.workspace.getConfiguration('rtlMd', scope);
  return {
    direction: c.get('direction', 'rtl') as RtlMdConfig['direction'],
    applyToBuiltinPreview: c.get('applyToBuiltinPreview', true),
    fontFamily: c.get('fontFamily', ''),
    fontSize: c.get('fontSize', 16),
    lineHeight: c.get('lineHeight', 1.9),
    maxContentWidth: c.get('maxContentWidth', '980px'),
    codeBlockDirection: c.get('codeBlockDirection', 'ltr') as RtlMdConfig['codeBlockDirection'],
    tableHeaderAlign: c.get('tableHeaderAlign', 'auto') as RtlMdConfig['tableHeaderAlign'],
    enableMermaid: c.get('enableMermaid', true),
    enableMath: c.get('enableMath', true),
    enableTaskLists: c.get('enableTaskLists', true),
    enableFootnotes: c.get('enableFootnotes', true),
    syncScroll: c.get('syncScroll', true),
    showToolbar: c.get('showToolbar', true),
    showToc: c.get('showToc', false)
  };
}

export function resolveDirection(
  setting: RtlMdConfig['direction'],
  detect: () => 'rtl' | 'ltr'
): 'rtl' | 'ltr' {
  return setting === 'auto' ? detect() : setting;
}
