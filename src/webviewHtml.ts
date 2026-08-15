import * as vscode from 'vscode';
import { RtlMdConfig, DEFAULT_FONT_STACK } from './config';
import { escapeHtml } from './renderer';

export interface HtmlOptions {
  body: string;
  dir: 'rtl' | 'ltr';
  cfg: RtlMdConfig;
  webview?: vscode.Webview;
  extensionUri: vscode.Uri;
  docUri: vscode.Uri;
  title: string;
  isCustomEditor?: boolean;
  /** Standalone export: inline everything, no VS Code APIs. */
  standalone?: boolean;
}

function nonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 32; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

export function buildHtmlDocument(opts: HtmlOptions): string {
  const { body, dir, cfg, webview, extensionUri, docUri, title } = opts;
  const n = nonce();
  const isRtl = dir === 'rtl';
  const start = isRtl ? 'right' : 'left';
  const end = isRtl ? 'left' : 'right';

  const fontFamily = cfg.fontFamily.trim() || DEFAULT_FONT_STACK;

  // Rewrite relative image/asset paths so the webview can load them.
  const processedBody = opts.standalone
    ? body
    : rewriteResourceUris(body, webview!, docUri);

  const mediaUri = (file: string): string => {
    const uri = vscode.Uri.joinPath(extensionUri, 'media', file);
    return webview ? webview.asWebviewUri(uri).toString() : uri.toString();
  };

  const csp = webview
    ? `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data: blob:; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource} https: data:; script-src 'nonce-${n}' ${webview.cspSource};">`
    : '';

  const styles = buildStyles(cfg, isRtl, start, end, fontFamily);

  const toolbar =
    cfg.showToolbar && !opts.standalone ? buildToolbar(isRtl, !!opts.isCustomEditor) : '';

  const mermaidScript =
    cfg.enableMermaid && !opts.standalone
      ? `<script nonce="${n}" src="${mediaUri('mermaid.min.js')}"></script>`
      : '';

  const katexAssets =
    cfg.enableMath && !opts.standalone
      ? `<link rel="stylesheet" href="${mediaUri('katex/katex.min.css')}">
    <script nonce="${n}" src="${mediaUri('katex/katex.min.js')}"></script>
    <script nonce="${n}" src="${mediaUri('katex/auto-render.min.js')}"></script>`
      : '';

  const runtime = opts.standalone
    ? standaloneRuntime(n)
    : `<script nonce="${n}">${webviewRuntime(cfg)}</script>`;

  return `<!DOCTYPE html>
<html lang="${isRtl ? 'ar' : 'en'}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  ${csp}
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  ${katexAssets}
  <style>${styles}</style>
</head>
<body class="rtl-md ${isRtl ? 'is-rtl' : 'is-ltr'}">
  ${toolbar}
  <main class="content" id="content">
${processedBody}
  </main>
  ${mermaidScript}
  ${runtime}
</body>
</html>`;
}

/**
 * Turn relative `src`/`href` attributes into webview URIs so local images
 * next to the Markdown file actually display.
 */
function rewriteResourceUris(
  html: string,
  webview: vscode.Webview,
  docUri: vscode.Uri
): string {
  const base = vscode.Uri.joinPath(docUri, '..');
  return html.replace(
    /(<img\b[^>]*?\bsrc=)(["'])(.*?)\2/gi,
    (match, prefix: string, quote: string, src: string) => {
      if (/^(https?:|data:|vscode-|blob:|\/\/)/i.test(src)) {
        return match;
      }
      try {
        const clean = decodeURI(src.split('#')[0].split('?')[0]);
        const target = clean.startsWith('/')
          ? vscode.Uri.file(clean)
          : vscode.Uri.joinPath(base, clean);
        return `${prefix}${quote}${webview.asWebviewUri(target)}${quote}`;
      } catch {
        return match;
      }
    }
  );
}

function buildToolbar(isRtl: boolean, isCustomEditor: boolean): string {
  const editButton = isCustomEditor
    ? `<button class="tb-btn" data-action="edit" title="فتح الملف للتحرير">✎ تحرير</button>`
    : `<button class="tb-btn" data-action="makeDefault" title="جعل قارئ RTL هو المحرر الافتراضي لملفات Markdown">★ اجعلها الافتراضية</button>`;
  return `<div class="toolbar" id="toolbar">
    <div class="tb-group">
      ${editButton}
      <button class="tb-btn" data-action="direction" title="تبديل الاتجاه">⇄ ${
        isRtl ? 'RTL' : 'LTR'
      }</button>
      <button class="tb-btn" data-action="print" title="طباعة أو حفظ PDF">⎙ طباعة</button>
      <button class="tb-btn" data-action="toc" title="فهرس المحتويات">☰ الفهرس</button>
    </div>
    <div class="tb-group">
      <button class="tb-btn tb-icon" data-action="zoom-out" title="تصغير">−</button>
      <span class="tb-zoom" id="zoomLabel">100%</span>
      <button class="tb-btn tb-icon" data-action="zoom-in" title="تكبير">+</button>
    </div>
  </div>
  <nav class="toc-panel" id="tocPanel" hidden><div class="toc-title">الفهرس</div><ul id="tocList"></ul></nav>`;
}

function buildStyles(
  cfg: RtlMdConfig,
  isRtl: boolean,
  start: string,
  end: string,
  fontFamily: string
): string {
  const codeDir =
    cfg.codeBlockDirection === 'inherit' ? (isRtl ? 'rtl' : 'ltr') : cfg.codeBlockDirection;

  const headerAlign =
    cfg.tableHeaderAlign === 'auto' ? (isRtl ? 'right' : 'left') : cfg.tableHeaderAlign;

  return `
:root {
  --rtl-font: ${fontFamily};
  --rtl-mono: 'Cascadia Code', 'Fira Code', Consolas, 'Courier New', monospace;
  --rtl-size: ${cfg.fontSize}px;
  --rtl-lh: ${cfg.lineHeight};
  --rtl-width: ${cfg.maxContentWidth};
  --rtl-fg: var(--vscode-editor-foreground, #1f2328);
  --rtl-bg: var(--vscode-editor-background, #ffffff);
  --rtl-muted: var(--vscode-descriptionForeground, #656d76);
  --rtl-border: var(--vscode-panel-border, rgba(128,128,128,0.35));
  --rtl-link: var(--vscode-textLink-foreground, #0969da);
  --rtl-link-hover: var(--vscode-textLink-activeForeground, #0550ae);
  --rtl-code-bg: var(--vscode-textCodeBlock-background, rgba(128,128,128,0.12));
  --rtl-quote-bg: var(--vscode-textBlockQuote-background, rgba(128,128,128,0.08));
  --rtl-quote-border: var(--vscode-textBlockQuote-border, #0969da);
  --rtl-accent: var(--vscode-focusBorder, #0969da);
  --rtl-table-stripe: rgba(128,128,128,0.06);
  --rtl-table-head: rgba(128,128,128,0.14);
  --rtl-zoom: 1;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  background: var(--rtl-bg);
  color: var(--rtl-fg);
}

body.rtl-md {
  font-family: var(--rtl-font);
  font-size: calc(var(--rtl-size) * var(--rtl-zoom));
  line-height: var(--rtl-lh);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

/* ---------- Toolbar ---------- */
.toolbar {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: var(--vscode-editorWidget-background, var(--rtl-bg));
  border-bottom: 1px solid var(--rtl-border);
  backdrop-filter: blur(6px);
  font-size: 12px;
  user-select: none;
}
.tb-group { display: flex; align-items: center; gap: 6px; }
.tb-btn {
  font-family: inherit;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 5px;
  border: 1px solid var(--rtl-border);
  background: var(--vscode-button-secondaryBackground, transparent);
  color: var(--vscode-button-secondaryForeground, var(--rtl-fg));
  cursor: pointer;
  transition: background .12s ease, border-color .12s ease;
}
.tb-btn:hover {
  background: var(--vscode-button-secondaryHoverBackground, rgba(128,128,128,0.18));
  border-color: var(--rtl-accent);
}
.tb-btn.tb-icon { padding: 4px 9px; font-weight: 600; }
.tb-zoom { min-width: 42px; text-align: center; color: var(--rtl-muted); font-variant-numeric: tabular-nums; }

/* ---------- TOC ---------- */
.toc-panel {
  position: fixed;
  top: 40px;
  ${start}: 0;
  width: 260px;
  max-height: calc(100vh - 48px);
  overflow-y: auto;
  padding: 12px 16px 20px;
  background: var(--vscode-editorWidget-background, var(--rtl-bg));
  border-${end}: 1px solid var(--rtl-border);
  z-index: 90;
  font-size: 13px;
}
.toc-title { font-weight: 700; margin-bottom: 8px; color: var(--rtl-muted); }
.toc-panel ul { list-style: none; margin: 0; padding: 0; }
.toc-panel li { margin: 2px 0; }
.toc-panel a {
  display: block;
  padding: 3px 6px;
  border-radius: 4px;
  color: var(--rtl-fg);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.toc-panel a:hover { background: rgba(128,128,128,0.15); color: var(--rtl-link); }
.toc-h3 { padding-${start}: 12px; }
.toc-h4 { padding-${start}: 24px; }
.toc-h5, .toc-h6 { padding-${start}: 36px; }
body.toc-open .content { margin-${start}: 276px; }

/* ---------- Content shell ---------- */
.content {
  max-width: var(--rtl-width);
  margin: 0 auto;
  padding: 28px 34px 96px;
  text-align: ${start};
  word-wrap: break-word;
  overflow-wrap: break-word;
}

/* ---------- Headings ---------- */
.content h1, .content h2, .content h3,
.content h4, .content h5, .content h6 {
  margin: 1.6em 0 .65em;
  font-weight: 700;
  line-height: 1.45;
  text-align: ${start};
}
.content h1 {
  font-size: 2em;
  padding-bottom: .32em;
  border-bottom: 2px solid var(--rtl-border);
}
.content h2 {
  font-size: 1.55em;
  padding-bottom: .28em;
  border-bottom: 1px solid var(--rtl-border);
}
.content h3 { font-size: 1.28em; }
.content h4 { font-size: 1.1em; }
.content h5 { font-size: 1em; }
.content h6 { font-size: .92em; color: var(--rtl-muted); }
.content h1:first-child, .content h2:first-child { margin-top: .3em; }

/* ---------- Text ---------- */
.content p { margin: 0 0 1.05em; }
.content strong { font-weight: 700; }
.content em { font-style: italic; }
.content del { opacity: .7; }
.content mark {
  background: var(--vscode-editor-findMatchHighlightBackground, #fff3a3);
  color: inherit;
  padding: 0 .2em;
  border-radius: 3px;
}
.content hr {
  height: 1px;
  border: 0;
  margin: 2em 0;
  background: var(--rtl-border);
}
.content a { color: var(--rtl-link); text-decoration: none; }
.content a:hover { color: var(--rtl-link-hover); text-decoration: underline; }

/* ---------- Lists: markers must sit on the start side ---------- */
.content ul, .content ol {
  margin: 0 0 1.05em;
  padding-${start}: 2em;
  padding-${end}: 0;
}
.content li { margin: .35em 0; }
.content li > ul, .content li > ol { margin: .3em 0; }
.content ul { list-style-position: outside; }
.content ol { list-style-position: outside; }
/* Arabic-Indic numbering reads more naturally in RTL documents. */
${isRtl ? '.content ol { list-style-type: arabic-indic; }' : ''}

/* Task lists */
.content .task-list-item { list-style: none; margin-${start}: -1.5em; }
.content .task-list-item input[type="checkbox"] {
  margin-${start}: 0;
  margin-${end}: .55em;
  vertical-align: middle;
  width: 1em;
  height: 1em;
  accent-color: var(--rtl-accent);
}
.content .contains-task-list { padding-${start}: 1.6em; }

/* Definition lists */
.content dl { margin: 0 0 1.05em; }
.content dt { font-weight: 700; margin-top: .7em; }
.content dd { margin: .2em 0 .2em 0; padding-${start}: 1.6em; }

/* ---------- Blockquote: border on the start side ---------- */
.content blockquote {
  margin: 0 0 1.05em;
  padding: .55em 1.1em;
  border-${start}: 4px solid var(--rtl-quote-border);
  border-${end}: none;
  background: var(--rtl-quote-bg);
  color: var(--rtl-muted);
  border-radius: ${isRtl ? '0 6px 6px 0' : '6px 0 0 6px'};
}
.content blockquote > :last-child { margin-bottom: 0; }

/* ---------- Code ---------- */
.content code {
  font-family: var(--rtl-mono);
  font-size: .88em;
  background: var(--rtl-code-bg);
  padding: .16em .38em;
  border-radius: 4px;
  unicode-bidi: isolate;
}
.content pre {
  direction: ${codeDir};
  text-align: left;
  margin: 0 0 1.15em;
  padding: 14px 16px;
  background: var(--rtl-code-bg);
  border: 1px solid var(--rtl-border);
  border-radius: 8px;
  overflow-x: auto;
  line-height: 1.6;
  unicode-bidi: isolate;
  position: relative;
}
.content pre code {
  background: none;
  padding: 0;
  font-size: .875em;
  white-space: pre;
  display: block;
}
.copy-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  font-family: var(--rtl-font);
  font-size: 11px;
  padding: 3px 9px;
  border-radius: 4px;
  border: 1px solid var(--rtl-border);
  background: var(--rtl-bg);
  color: var(--rtl-muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity .15s ease;
}
.content pre:hover .copy-btn { opacity: 1; }
.copy-btn:hover { color: var(--rtl-fg); border-color: var(--rtl-accent); }

/* ---------- TABLES: the critical RTL piece ---------- */
.content table {
  direction: ${isRtl ? 'rtl' : 'ltr'};
  border-collapse: collapse;
  border-spacing: 0;
  margin: 0 0 1.3em;
  width: auto;
  max-width: 100%;
  display: table;
  overflow-x: auto;
  border: 1px solid var(--rtl-border);
  border-radius: 6px;
  font-size: .96em;
}
/* Wrapper added by the runtime so wide tables scroll instead of clipping. */
.table-wrap {
  overflow-x: auto;
  margin: 0 0 1.3em;
  direction: ${isRtl ? 'rtl' : 'ltr'};
}
.table-wrap > table { margin: 0; }

.content table th,
.content table td {
  border: 1px solid var(--rtl-border);
  padding: .55em .85em;
  text-align: ${start};
  vertical-align: top;
}
.content table th {
  background: var(--rtl-table-head);
  font-weight: 700;
  text-align: ${headerAlign};
  white-space: nowrap;
}
.content table tbody tr:nth-child(even) { background: var(--rtl-table-stripe); }
.content table tbody tr:hover { background: rgba(128,128,128,0.11); }
.content table caption {
  caption-side: top;
  padding: .4em 0;
  font-weight: 700;
  color: var(--rtl-muted);
  text-align: ${start};
}

/* Honour explicit column alignment from the |:---:| syntax.
   markdown-it emits inline style="text-align:..." — respect it over our default. */
.content table th[style*="text-align:center"],
.content table td[style*="text-align:center"] { text-align: center !important; }
.content table th[style*="text-align:right"],
.content table td[style*="text-align:right"] { text-align: right !important; }
.content table th[style*="text-align:left"],
.content table td[style*="text-align:left"] { text-align: left !important; }

/* ---------- Images & media ---------- */
.content img {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
  display: inline-block;
}
.content figure { margin: 0 0 1.2em; text-align: center; }
.content figcaption { color: var(--rtl-muted); font-size: .9em; margin-top: .4em; }
.content video, .content iframe { max-width: 100%; }

/* ---------- Footnotes ---------- */
.content .footnotes {
  margin-top: 2.5em;
  padding-top: 1em;
  border-top: 1px solid var(--rtl-border);
  font-size: .92em;
  color: var(--rtl-muted);
}
.content .footnotes ol { padding-${start}: 1.8em; }
.content .footnote-backref { margin-${start}: .35em; text-decoration: none; }
.content .footnote-ref { font-size: .82em; vertical-align: super; }

/* ---------- Mermaid ---------- */
.content .mermaid {
  direction: ltr;
  text-align: center;
  margin: 0 0 1.3em;
  padding: 12px;
  background: var(--rtl-code-bg);
  border: 1px solid var(--rtl-border);
  border-radius: 8px;
  overflow-x: auto;
}
.content .mermaid svg { max-width: 100%; height: auto; }

/* ---------- Math ---------- */
.content .katex { direction: ltr; unicode-bidi: isolate; font-size: 1.05em; }
.content .katex-display { overflow-x: auto; overflow-y: hidden; padding: .35em 0; }

/* ---------- Keyboard & misc inline ---------- */
.content kbd {
  font-family: var(--rtl-mono);
  font-size: .82em;
  padding: .15em .45em;
  border: 1px solid var(--rtl-border);
  border-bottom-width: 2px;
  border-radius: 4px;
  background: var(--rtl-code-bg);
  unicode-bidi: isolate;
}
.content sub, .content sup { line-height: 0; }
.content abbr[title] { border-bottom: 1px dotted currentColor; cursor: help; }

/* ---------- HTML embedded in Markdown ---------- */
.content details {
  margin: 0 0 1.05em;
  padding: .5em .9em;
  border: 1px solid var(--rtl-border);
  border-radius: 6px;
  background: var(--rtl-quote-bg);
}
.content summary { cursor: pointer; font-weight: 600; }
.content details[open] summary { margin-bottom: .6em; }

/* ---------- Scrollbars ---------- */
.content pre::-webkit-scrollbar,
.table-wrap::-webkit-scrollbar { height: 10px; width: 10px; }
.content pre::-webkit-scrollbar-thumb,
.table-wrap::-webkit-scrollbar-thumb {
  background: var(--vscode-scrollbarSlider-background, rgba(128,128,128,0.4));
  border-radius: 5px;
}

/* ---------- Scroll-sync highlight ---------- */
.content .sync-flash { animation: syncFlash 1s ease-out; }
@keyframes syncFlash {
  from { background: var(--vscode-editor-findMatchHighlightBackground, rgba(255,213,0,0.35)); }
  to   { background: transparent; }
}

/* ---------- Print / PDF ---------- */
@media print {
  .toolbar, .toc-panel, .copy-btn { display: none !important; }
  body.rtl-md { background: #fff; color: #000; }
  .content {
    max-width: 100%;
    margin: 0;
    padding: 0;
    direction: ${isRtl ? 'rtl' : 'ltr'};
  }
  .content table, .content pre, .content blockquote { break-inside: avoid; }
  .content h1, .content h2, .content h3 { break-after: avoid; }
  .content a { color: #000; text-decoration: underline; }
  .content table th { background: #eee !important; -webkit-print-color-adjust: exact; }
}
`;
}

/** Client-side script running inside the VS Code webview. */
function webviewRuntime(cfg: RtlMdConfig): string {
  return `
(function () {
  var vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
  var content = document.getElementById('content');
  var syncScroll = ${cfg.syncScroll};
  var suppressScroll = false;

  /* ---- Wrap wide tables so they scroll horizontally without clipping ---- */
  content.querySelectorAll('table').forEach(function (t) {
    if (t.parentElement && t.parentElement.classList.contains('table-wrap')) return;
    var wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    t.parentNode.insertBefore(wrap, t);
    wrap.appendChild(t);
  });

  /* ---- Copy buttons on code blocks ---- */
  content.querySelectorAll('pre.code-block').forEach(function (pre) {
    var btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = 'نسخ';
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var code = pre.querySelector('code');
      var text = code ? code.textContent : pre.textContent;
      if (vscode) vscode.postMessage({ type: 'copy', text: text });
      btn.textContent = 'تم ✓';
      setTimeout(function () { btn.textContent = 'نسخ'; }, 1500);
    });
    pre.appendChild(btn);
  });

  /* ---- Links go through the extension host ---- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.charAt(0) === '#') {
      e.preventDefault();
      var id = decodeURIComponent(href.slice(1));
      var target = document.getElementById(id) ||
                   document.querySelector('[name="' + CSS.escape(id) + '"]');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (href) {
      e.preventDefault();
      if (vscode) vscode.postMessage({ type: 'openLink', href: href });
    }
  });

  /* ---- Toolbar ---- */
  var zoom = 1;
  var zoomLabel = document.getElementById('zoomLabel');
  function applyZoom() {
    document.documentElement.style.setProperty('--rtl-zoom', String(zoom));
    if (zoomLabel) zoomLabel.textContent = Math.round(zoom * 100) + '%';
  }
  var toolbar = document.getElementById('toolbar');
  if (toolbar) {
    toolbar.addEventListener('click', function (e) {
      var btn = e.target.closest('.tb-btn');
      if (!btn) return;
      var action = btn.getAttribute('data-action');
      if (action === 'edit' && vscode) vscode.postMessage({ type: 'editSource' });
      else if (action === 'makeDefault' && vscode) vscode.postMessage({ type: 'makeDefault' });
      else if (action === 'direction' && vscode) vscode.postMessage({ type: 'toggleDirection' });
      else if (action === 'print' && vscode) vscode.postMessage({ type: 'print' });
      else if (action === 'toc') toggleToc();
      else if (action === 'zoom-in') { zoom = Math.min(3, zoom + 0.1); applyZoom(); }
      else if (action === 'zoom-out') { zoom = Math.max(0.5, zoom - 0.1); applyZoom(); }
    });
  }

  /* ---- Table of contents ---- */
  var tocBuilt = false;
  function buildToc() {
    var list = document.getElementById('tocList');
    if (!list) return;
    var heads = content.querySelectorAll('h1, h2, h3, h4, h5, h6');
    heads.forEach(function (h, i) {
      if (!h.id) h.id = 'rtlmd-h-' + i;
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent;
      a.className = 'toc-' + h.tagName.toLowerCase();
      a.setAttribute('dir', 'auto');
      li.appendChild(a);
      list.appendChild(li);
    });
    tocBuilt = true;
  }
  function toggleToc() {
    var panel = document.getElementById('tocPanel');
    if (!panel) return;
    if (!tocBuilt) buildToc();
    panel.hidden = !panel.hidden;
    document.body.classList.toggle('toc-open', !panel.hidden);
  }
  ${cfg.showToc ? 'toggleToc();' : ''}

  /* ---- Mermaid ---- */
  if (typeof mermaid !== 'undefined') {
    var dark = document.body.classList.contains('vscode-dark') ||
               matchMedia('(prefers-color-scheme: dark)').matches;
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: dark ? 'dark' : 'default',
        securityLevel: 'strict',
        fontFamily: getComputedStyle(document.body).fontFamily
      });
      mermaid.run({ querySelector: '.mermaid' }).catch(function () {});
    } catch (err) { /* diagram failures must not break the page */ }
  }

  /* ---- KaTeX ---- */
  if (typeof renderMathInElement === 'function') {
    try {
      renderMathInElement(content, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\\\[', right: '\\\\]', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\\\(', right: '\\\\)', display: false }
        ],
        throwOnError: false,
        ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
      });
    } catch (err) { /* ignore */ }
  }

  /* ---- Scroll sync: preview -> editor ---- */
  var lineElements = [];
  function collectLines() {
    lineElements = Array.prototype.slice
      .call(content.querySelectorAll('[data-line]'))
      .map(function (el) { return { el: el, line: parseInt(el.getAttribute('data-line'), 10) }; })
      .filter(function (x) { return !isNaN(x.line); });
  }
  collectLines();

  var scrollTimer = null;
  window.addEventListener('scroll', function () {
    if (!syncScroll || !vscode || suppressScroll) return;
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () {
      var top = window.scrollY + 60;
      var best = null;
      for (var i = 0; i < lineElements.length; i++) {
        if (lineElements[i].el.offsetTop <= top) best = lineElements[i];
        else break;
      }
      if (best) vscode.postMessage({ type: 'revealLine', line: best.line });
    }, 120);
  }, { passive: true });

  /* ---- Scroll sync: editor -> preview ---- */
  window.addEventListener('message', function (e) {
    var msg = e.data;
    if (!msg) return;
    if (msg.type === 'scrollToLine' && syncScroll) {
      var target = null;
      for (var i = 0; i < lineElements.length; i++) {
        if (lineElements[i].line <= msg.line) target = lineElements[i];
        else break;
      }
      if (target) {
        suppressScroll = true;
        window.scrollTo({ top: Math.max(0, target.el.offsetTop - 60), behavior: 'auto' });
        setTimeout(function () { suppressScroll = false; }, 180);
      }
    }
  });

  /* ---- Keyboard: ctrl +/- zoom, ctrl+0 reset ---- */
  document.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.key === '=' || e.key === '+') { zoom = Math.min(3, zoom + 0.1); applyZoom(); e.preventDefault(); }
    else if (e.key === '-') { zoom = Math.max(0.5, zoom - 0.1); applyZoom(); e.preventDefault(); }
    else if (e.key === '0') { zoom = 1; applyZoom(); e.preventDefault(); }
  });
})();
`;
}

/** Minimal script for the exported standalone HTML file. */
function standaloneRuntime(n: string): string {
  return `<script nonce="${n}">
(function(){
  document.querySelectorAll('#content table').forEach(function(t){
    if (t.parentElement && t.parentElement.classList.contains('table-wrap')) return;
    var w = document.createElement('div');
    w.className = 'table-wrap';
    t.parentNode.insertBefore(w, t);
    w.appendChild(t);
  });
})();
</script>`;
}
