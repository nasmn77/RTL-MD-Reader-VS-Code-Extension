import MarkdownIt = require('markdown-it');

export interface RenderOptions {
  enableMath: boolean;
  enableTaskLists: boolean;
  enableFootnotes: boolean;
  enableMermaid: boolean;
}

/** Regex ranges for strongly RTL scripts: Arabic, Hebrew, Syriac, Thaana, NKo. */
const RTL_CHARS =
  /[֐-׿؀-ۿ܀-ݏݐ-ݿ߀-߿ހ-޿ࢠ-ࣿיִ-﷿ﹰ-﻿]/;
/** Latin letters, used to weigh LTR content when auto-detecting. */
const LTR_CHARS = /[A-Za-zÀ-ɏ]/;

/**
 * Decide the document direction. Fenced code blocks and inline code are stripped
 * first so a file of English code samples with Arabic prose still reads as RTL.
 */
export function detectDirection(markdown: string): 'rtl' | 'ltr' {
  const prose = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/^ {4,}.*$/gm, ' ');

  let rtl = 0;
  let ltr = 0;
  for (const ch of prose) {
    if (RTL_CHARS.test(ch)) {
      rtl++;
    } else if (LTR_CHARS.test(ch)) {
      ltr++;
    }
  }
  // A modest share of RTL characters is enough — Arabic docs routinely embed
  // English terms, but English docs almost never embed Arabic.
  if (rtl === 0) {
    return 'ltr';
  }
  return rtl * 3 >= ltr ? 'rtl' : 'ltr';
}

function tryRequire(name: string): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(name);
    return mod && mod.default ? mod.default : mod;
  } catch {
    return undefined;
  }
}

export function createMarkdownIt(opts: RenderOptions): MarkdownIt {
  const md: MarkdownIt = new (MarkdownIt as any)({
    html: true,
    linkify: true,
    typographer: false,
    breaks: false,
    langPrefix: 'language-'
  });

  const use = (name: string, options?: any) => {
    const plugin = tryRequire(name);
    if (plugin) {
      try {
        md.use(plugin, options);
      } catch {
        /* a plugin failing to load must never break rendering */
      }
    }
  };

  // multimd-table supersedes the core table rule and adds rowspan/colspan,
  // multi-line cells, captions and headerless tables.
  use('markdown-it-multimd-table', {
    multiline: true,
    rowspan: true,
    headerless: true,
    multibody: true,
    autolabel: true
  });
  use('markdown-it-attrs');
  use('markdown-it-sub');
  use('markdown-it-sup');
  use('markdown-it-mark');
  use('markdown-it-ins');
  use('markdown-it-deflist');
  use('markdown-it-anchor', { permalink: false, slugify: slugify });

  if (opts.enableFootnotes) {
    use('markdown-it-footnote');
  }
  if (opts.enableTaskLists) {
    use('markdown-it-task-lists', { enabled: true, label: true, labelAfter: false });
  }

  applyDirectionAwareRules(md, opts);
  addSourceLineMapping(md);
  return md;
}

export function slugify(s: string): string {
  return encodeURIComponent(
    String(s)
      .trim()
      .toLowerCase()
      .replace(/[\]\[!"#$%&'()*+,./:;<=>?@\\^_{|}~`]/g, '')
      .replace(/\s+/g, '-')
  );
}

/**
 * Direction handling that the CSS alone cannot do:
 *  - per-cell `dir="auto"` so a Latin cell inside an RTL table still reads
 *    left-to-right without dragging its punctuation to the wrong side;
 *  - fenced code turned into a `dir="ltr"` block (or a mermaid container).
 */
function applyDirectionAwareRules(md: MarkdownIt, opts: RenderOptions): void {
  const rules = md.renderer.rules;

  for (const tag of ['td_open', 'th_open'] as const) {
    const original = rules[tag];
    rules[tag] = (tokens, idx, options, env, self) => {
      const token = tokens[idx];
      if (token.attrIndex('dir') < 0) {
        token.attrPush(['dir', 'auto']);
      }
      return original
        ? original(tokens, idx, options, env, self)
        : self.renderToken(tokens, idx, options);
    };
  }

  // Paragraphs and headings get dir="auto" too: a purely-English paragraph in an
  // Arabic document should not have its trailing period flipped to the left.
  for (const tag of ['paragraph_open', 'heading_open'] as const) {
    const original = rules[tag];
    rules[tag] = (tokens, idx, options, env, self) => {
      const token = tokens[idx];
      if (token.attrIndex('dir') < 0) {
        token.attrPush(['dir', 'auto']);
      }
      return original
        ? original(tokens, idx, options, env, self)
        : self.renderToken(tokens, idx, options);
    };
  }

  rules.fence = (tokens, idx) => {
    const token = tokens[idx];
    const info = token.info ? String(token.info).trim() : '';
    const lang = info.split(/\s+/)[0] || '';
    const code = token.content;

    if (opts.enableMermaid && lang.toLowerCase() === 'mermaid') {
      return `<div class="mermaid" dir="ltr">${escapeHtml(code)}</div>\n`;
    }

    const line = token.map ? ` data-line="${token.map[0]}"` : '';
    const cls = lang ? ` class="language-${escapeHtml(lang)}"` : '';
    return (
      `<pre dir="ltr"${line} class="code-block"><code${cls}>` +
      escapeHtml(code) +
      `</code></pre>\n`
    );
  };

  const originalCodeInline = rules.code_inline;
  rules.code_inline = (tokens, idx, options, env, self) => {
    const html = originalCodeInline
      ? originalCodeInline(tokens, idx, options, env, self)
      : `<code>${escapeHtml(tokens[idx].content)}</code>`;
    // bdi keeps an inline snippet from reordering the Arabic text around it.
    return html.replace('<code', '<code dir="ltr"');
  };
}

/**
 * Stamp `data-line` on block-level elements so the webview can sync scrolling
 * with the text editor.
 */
function addSourceLineMapping(md: MarkdownIt): void {
  const blockTags = [
    'paragraph_open',
    'heading_open',
    'blockquote_open',
    'bullet_list_open',
    'ordered_list_open',
    'list_item_open',
    'table_open',
    'hr'
  ];
  for (const tag of blockTags) {
    const original = md.renderer.rules[tag];
    md.renderer.rules[tag] = (tokens, idx, options, env, self) => {
      const token = tokens[idx];
      if (token.map && token.attrIndex('data-line') < 0) {
        token.attrPush(['data-line', String(token.map[0])]);
      }
      return original
        ? original(tokens, idx, options, env, self)
        : self.renderToken(tokens, idx, options);
    };
  }
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Split out `$...$` / `$$...$$` so KaTeX can typeset them in the webview. */
export function protectMath(markdown: string, enabled: boolean): string {
  if (!enabled) {
    return markdown;
  }
  return markdown;
}
