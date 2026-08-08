/**
 * Minimal Markdown renderer for AI replies.
 *
 * This replaces the previous `marked` + `DOMPurify` pair, which were pulled
 * from a CDN at run time. That arrangement had two problems: every launch of
 * the app announced itself to jsdelivr.net (a third party that never needed to
 * know Spoty was running), and whoever controls that script controls the
 * renderer — including the settings form the API keys used to be typed into.
 *
 * The parser below covers the subset of Markdown that chat models actually
 * emit, and it builds DOM nodes directly: text always arrives through
 * `textContent`, so there is no HTML string for markup to be injected into and
 * nothing to sanitize afterwards.
 *
 * Links are rendered as text rather than as anchors. A model-authored link is
 * untrusted content, and a clickable one in a launcher window is a ready-made
 * phishing surface; showing the URL inline lets the user read it and copy it
 * deliberately.
 */

/** Hard caps so a pathological reply cannot lock up the renderer. */
const MAX_SOURCE_LENGTH = 200_000;
const MAX_LINES = 4_000;

const INLINE_PATTERN =
  /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(~~[^~\n]+~~)|(\[[^\]\n]*\]\([^)\s]+\))/g;

const LINK_PATTERN = /^\[([^\]]*)\]\(([^)\s]+)\)$/;

function appendText(target: Node, text: string): void {
  if (text) target.appendChild(document.createTextNode(text));
}

function appendWrapped(target: Node, tag: keyof HTMLElementTagNameMap, text: string): void {
  const el = document.createElement(tag);
  el.textContent = text;
  target.appendChild(el);
}

/** Renders a link as `label (https://example.com)` in plain text. */
function appendLink(target: Node, raw: string): void {
  const match = raw.match(LINK_PATTERN);
  if (!match) {
    appendText(target, raw);
    return;
  }
  const [, label, url] = match;
  let safeUrl = '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      safeUrl = parsed.toString();
    }
  } catch {
    // Not a URL we are willing to show as one.
  }

  const text = label.trim();
  if (!safeUrl) {
    appendText(target, text || url);
    return;
  }
  const span = document.createElement('span');
  span.className = 'ai-link';
  span.textContent = text && text !== safeUrl ? `${text} (${safeUrl})` : safeUrl;
  target.appendChild(span);
}

/** Applies inline formatting (code, emphasis, links) to a single line. */
function appendInline(target: Node, line: string): void {
  let lastIndex = 0;
  INLINE_PATTERN.lastIndex = 0;

  for (let match = INLINE_PATTERN.exec(line); match; match = INLINE_PATTERN.exec(line)) {
    appendText(target, line.slice(lastIndex, match.index));
    const token = match[0];

    if (token.startsWith('`')) {
      appendWrapped(target, 'code', token.slice(1, -1));
    } else if (token.startsWith('**') || token.startsWith('__')) {
      appendWrapped(target, 'strong', token.slice(2, -2));
    } else if (token.startsWith('~~')) {
      appendWrapped(target, 'del', token.slice(2, -2));
    } else if (token.startsWith('[')) {
      appendLink(target, token);
    } else {
      appendWrapped(target, 'em', token.slice(1, -1));
    }

    lastIndex = match.index + token.length;
  }
  appendText(target, line.slice(lastIndex));
}

function appendParagraph(target: HTMLElement, lines: string[]): void {
  if (lines.length === 0) return;
  const p = document.createElement('p');
  lines.forEach((line, index) => {
    if (index > 0) p.appendChild(document.createElement('br'));
    appendInline(p, line);
  });
  target.appendChild(p);
  lines.length = 0;
}

interface ListState {
  el: HTMLUListElement | HTMLOListElement;
  ordered: boolean;
}

/**
 * Parses `source` and appends the result to `target`. The container is not
 * cleared — callers decide what else lives in it.
 */
export function appendMarkdown(target: HTMLElement, source: string): void {
  const text = (source ?? '').slice(0, MAX_SOURCE_LENGTH).replace(/\r\n?/g, '\n');
  const lines = text.split('\n').slice(0, MAX_LINES);

  const pending: string[] = [];
  let list: ListState | null = null;
  let codeBlock: HTMLElement | null = null;
  let codeLines: string[] = [];

  const closeList = (): void => {
    list = null;
  };

  for (const line of lines) {
    const fence = line.match(/^\s*```(.*)$/);
    if (fence) {
      if (codeBlock) {
        // Closing fence: commit the collected lines in one go.
        codeBlock.textContent = codeLines.join('\n');
        codeBlock = null;
        codeLines = [];
      } else {
        appendParagraph(target, pending);
        closeList();
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        const language = fence[1].trim();
        if (/^[A-Za-z0-9+#._-]{1,24}$/.test(language)) {
          // Class name only, never interpolated into markup.
          code.className = `language-${language}`;
        }
        pre.appendChild(code);
        target.appendChild(pre);
        codeBlock = code;
      }
      continue;
    }

    if (codeBlock) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      appendParagraph(target, pending);
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      appendParagraph(target, pending);
      closeList();
      const level = Math.min(heading[1].length + 2, 6);
      const el = document.createElement(`h${level}` as keyof HTMLElementTagNameMap);
      appendInline(el, heading[2].trim());
      target.appendChild(el);
      continue;
    }

    if (/^\s*(?:---|\*\*\*|___)\s*$/.test(line)) {
      appendParagraph(target, pending);
      closeList();
      target.appendChild(document.createElement('hr'));
      continue;
    }

    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      appendParagraph(target, pending);
      closeList();
      const blockquote = document.createElement('blockquote');
      appendInline(blockquote, quote[1]);
      target.appendChild(blockquote);
      continue;
    }

    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    const ordered = line.match(/^\s*\d{1,3}[.)]\s+(.*)$/);
    if (bullet || ordered) {
      appendParagraph(target, pending);
      const wantOrdered = !!ordered;
      if (!list || list.ordered !== wantOrdered) {
        const el: HTMLUListElement | HTMLOListElement = wantOrdered
          ? document.createElement('ol')
          : document.createElement('ul');
        target.appendChild(el);
        list = { el, ordered: wantOrdered };
      }
      const li = document.createElement('li');
      appendInline(li, (bullet ?? ordered)![1]);
      list.el.appendChild(li);
      continue;
    }

    closeList();
    pending.push(line);
  }

  if (codeBlock) {
    // Unterminated fence: keep whatever the model produced.
    codeBlock.textContent = codeLines.join('\n');
  }
  appendParagraph(target, pending);
}

/** Convenience wrapper: replaces the container's contents. */
export function renderMarkdown(target: HTMLElement, source: string): void {
  target.replaceChildren();
  appendMarkdown(target, source);
}
