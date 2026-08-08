import { dom } from './dom';
import { api } from './electron-api';
import { state } from './state';
import { getDict } from './i18n';
import { renderMarkdown } from './markdown';
import { updateWindowSize } from './window-size';
import { clearResults } from './search-results';

/**
 * The chat view is built from DOM nodes rather than concatenated HTML.
 *
 * Model output and user input both used to be interpolated into template
 * strings and assigned through `innerHTML`, with escaping applied by hand at
 * each site — one missed call away from executing whatever a reply contained.
 * Using `textContent` and `createElement` makes that class of bug impossible
 * instead of merely unlikely.
 */

function createCopyButton(text: string, label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'ai-copy-btn';
  button.dataset.action = 'copy-ai';
  // `dataset` assignment is an attribute value, not markup, so the reply text
  // needs no escaping here — unlike the old string-template version.
  button.dataset.text = text;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', '9');
  rect.setAttribute('y', '9');
  rect.setAttribute('width', '13');
  rect.setAttribute('height', '13');
  rect.setAttribute('rx', '2');
  rect.setAttribute('ry', '2');
  const tail = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  tail.setAttribute('d', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1');
  svg.appendChild(rect);
  svg.appendChild(tail);

  button.appendChild(svg);
  button.appendChild(document.createTextNode(` ${label}`));
  return button;
}

function createUserBubble(content: string, isLast: boolean): HTMLDivElement {
  const bubble = document.createElement('div');
  bubble.className = `ai-user-bubble${isLast ? ' ai-msg-enter' : ''}`;
  const text = document.createElement('div');
  text.className = 'ai-user-text';
  text.textContent = content;
  bubble.appendChild(text);
  return bubble;
}

function createAssistantCard(
  content: string,
  isError: boolean,
  isLast: boolean,
  copyLabel: string
): HTMLDivElement {
  const card = document.createElement('div');
  card.className = [
    'ai-chat-card',
    isLast ? 'ai-response-arrive' : '',
    isError ? 'error' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const avatar = document.createElement('div');
  avatar.className = 'ai-avatar';
  avatar.textContent = isError ? '⚠️' : 'AI';
  card.appendChild(avatar);

  const body = document.createElement('div');
  body.className = 'ai-content';

  const textEl = document.createElement('div');
  textEl.className = 'ai-text';
  if (isError) {
    // Error strings are plain text; keep the line breaks the main process sent.
    content.split('\n').forEach((line, index) => {
      if (index > 0) textEl.appendChild(document.createElement('br'));
      textEl.appendChild(document.createTextNode(line));
    });
  } else {
    renderMarkdown(textEl, content);
  }
  body.appendChild(textEl);

  if (!isError) body.appendChild(createCopyButton(content, copyLabel));
  card.appendChild(body);
  return card;
}

function createLoadingCard(): HTMLDivElement {
  const card = document.createElement('div');
  card.className = 'ai-chat-card loading';

  const avatar = document.createElement('div');
  avatar.className = 'ai-avatar';
  avatar.textContent = 'AI';
  card.appendChild(avatar);

  const body = document.createElement('div');
  body.className = 'ai-content';
  const indicator = document.createElement('div');
  indicator.className = 'typing-indicator';
  for (let i = 0; i < 3; i++) indicator.appendChild(document.createElement('span'));
  body.appendChild(indicator);
  card.appendChild(body);
  return card;
}

export function renderChatMessages(showLoading = false): void {
  const dict = getDict(state.appSettings?.language);
  dom.footer.style.display = 'none';

  const container = document.createElement('div');
  container.className = 'ai-chat-container';

  for (let i = 0; i < state.chatDisplayMessages.length; i++) {
    const msg = state.chatDisplayMessages[i];
    const isLast = i === state.chatDisplayMessages.length - 1 && !showLoading;

    if (msg.role === 'user') {
      container.appendChild(createUserBubble(msg.content, isLast));
    } else {
      container.appendChild(
        createAssistantCard(msg.content, msg.isError === true, isLast, dict.copy)
      );
    }
  }

  if (showLoading) container.appendChild(createLoadingCard());

  dom.resultsContainer.replaceChildren(container);
  container.scrollTop = container.scrollHeight;
  updateWindowSize();
}

export async function startAiChat(query: string): Promise<void> {
  if (!query.trim()) return;

  state.chatDisplayMessages.push({ role: 'user', content: query });
  dom.searchInput.value = '';
  dom.clearButton.style.display = 'none';
  renderChatMessages(true);

  try {
    const reply = await api.invoke('ask-ai', query);
    state.chatDisplayMessages.push({ role: 'assistant', content: reply });
    renderChatMessages(false);
  } catch (err) {
    const dict = getDict(state.appSettings?.language);
    state.chatDisplayMessages.push({
      role: 'assistant',
      content: `${dict.ai_error}: ${(err as Error).message}`,
      isError: true,
    });
    renderChatMessages(false);
  }
}

export function copyAiText(btn: HTMLElement): void {
  const text = btn.dataset.text || '';
  api.send('clipboard-copy', text);
  const dict = getDict(state.appSettings?.language);
  const original = btn.cloneNode(true);
  btn.textContent = dict.copied;
  setTimeout(() => {
    btn.replaceChildren(...Array.from(original.childNodes));
  }, 2000);
}

export function showAiHistoryHint(): void {
  if (!state.appSettings?.ai?.saveHistory) return;
  const dict = getDict(state.appSettings?.language);
  dom.footer.style.display = 'none';

  const hint = document.createElement('div');
  hint.className = 'ai-history-hint fade-in';
  const button = document.createElement('button');
  button.className = 'ai-history-btn primary';
  button.dataset.action = 'open-ai-history';
  button.textContent = dict.ai_history_title;
  hint.appendChild(button);

  dom.resultsContainer.replaceChildren(hint);
  updateWindowSize();
}

export function resetAiContext(): void {
  api.send('reset-ai-context');
  state.chatDisplayMessages = [];
  dom.searchInput.value = '';
  dom.clearButton.style.display = 'none';
  clearResults();

  const dict = getDict(state.appSettings?.language);
  const hint = document.createElement('div');
  hint.className = 'ai-reset-hint fade-in';
  const card = document.createElement('div');
  card.className = 'ai-reset-hint-card';
  card.textContent = `✨ ${dict.ai_new_chat}`;
  hint.appendChild(card);
  dom.resultsContainer.replaceChildren(hint);
  updateWindowSize();

  setTimeout(() => {
    if (state.isAiMode && state.appSettings?.ai?.saveHistory) {
      showAiHistoryHint();
    } else {
      clearResults();
    }
  }, 1200);
}
