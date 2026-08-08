import { getConfig } from './config';
import { addChatEntry } from './chat-history';
import { isLoopbackHost, privacyFetch } from './net';
import type { ChatMessage } from '../shared/types';

const OPENAI_TIMEOUT_MS = 30_000;
const GEMINI_TIMEOUT_MS = 30_000;
const OLLAMA_TIMEOUT_MS = 60_000;
const MAX_CONTEXT_MESSAGES = 20;
const MAX_PROMPT_LENGTH = 10_000;
const MAX_RESPONSE_BYTES = 2_000_000;

let conversationMessages: ChatMessage[] = [];
let aiRequestCounter = 0;
const pendingAiContextRequests = new Map<string, number>();
let aiRequestQueue: Promise<unknown> = Promise.resolve();

// Periodic cleanup for stale request mappings (e.g. if a request somehow hangs forever)
setInterval(() => {
  const now = Date.now();
  for (const [id] of pendingAiContextRequests.entries()) {
    const timestamp = parseInt(id.split('-')[0], 36);
    if (now - timestamp > 300_000) {
      pendingAiContextRequests.delete(id);
    }
  }
}, 600_000);

export function resetContext(): void {
  conversationMessages = [];
}

export function getContextSnapshot(): ReadonlyArray<ChatMessage> {
  return conversationMessages;
}

/**
 * Validates and self-heals the conversation context. Ensures that roles
 * strictly alternate (user -> assistant -> user...) and that the sequence
 * always ends on an assistant reply before a new user request is added.
 */
function healConversationContext(sourceTag: string): void {
  const config = getConfig();
  if (!config.ai.useContext || conversationMessages.length === 0) return;

  const originalCount = conversationMessages.length;
  const healed: ChatMessage[] = [];

  for (let i = 0; i < conversationMessages.length; i++) {
    const msg = conversationMessages[i];
    const expectedRole = healed.length % 2 === 0 ? 'user' : 'assistant';

    if (msg.role === expectedRole) {
      healed.push(msg);
    } else {
      console.warn(
        `[AI context heal] @${sourceTag}: Dropping message at index ${i} (expected ${expectedRole}, got ${msg.role})`
      );
    }
  }

  // If the sequence now ends on a 'user' message, it means we have a trailing
  // user prompt without an assistant reply. Since `askAi` is about to add a
  // *new* user prompt, we must drop this trailing one to maintain alternation.
  if (healed.length > 0 && healed[healed.length - 1].role === 'user') {
    console.warn(`[AI context heal] @${sourceTag}: Dropping trailing user message to maintain alternation.`);
    healed.pop();
  }

  if (healed.length !== originalCount) {
    conversationMessages = healed;
    console.log(`[AI context heal] @${sourceTag}: Context repaired (${originalCount} -> ${healed.length} messages)`);
  }
}

interface OpenAiResponse {
  choices: { message: { content: string } }[];
  error?: { message?: string };
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text: string }[] } }[];
  error?: { message?: string };
}

interface OllamaResponse {
  response?: string;
  message?: { content?: string };
}

function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function callOpenAI(prompt: string): Promise<string> {
  const config = getConfig();
  if (!config.ai.openaiApiKey) {
    throw new Error('Nincs megadva OpenAI API kulcs a beállításokban.');
  }

  const messages = config.ai.useContext
    ? [...conversationMessages]
    : [{ role: 'user' as const, content: prompt }];

  const response = await privacyFetch('https://api.openai.com/v1/chat/completions', {
    purpose: 'OpenAI request',
    method: 'POST',
    timeoutMs: OPENAI_TIMEOUT_MS,
    maxBytes: MAX_RESPONSE_BYTES,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.ai.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: config.ai.openaiModel || 'gpt-4o-mini',
      messages,
    }),
  });

  const data = parseJson<OpenAiResponse>(response.text);
  if (!response.ok) {
    throw new Error(data?.error?.message || `OpenAI Hiba: ${response.status}`);
  }
  const reply = data?.choices?.[0]?.message?.content;
  if (!reply) {
    throw new Error('Nem értelmezhető válasz érkezett az OpenAI API-tól.');
  }
  return reply;
}

async function callGemini(prompt: string): Promise<string> {
  const config = getConfig();
  if (!config.ai.geminiApiKey) {
    throw new Error('Nincs megadva Google Gemini API kulcs a beállításokban.');
  }

  const model = config.ai.geminiModel || 'gemini-2.5-flash';
  const apiKey = config.ai.geminiApiKey;

  let contents: { role?: string; parts: { text: string }[] }[];
  if (config.ai.useContext) {
    contents = conversationMessages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));
  } else {
    contents = [{ parts: [{ text: prompt }] }];
  }

  const response = await privacyFetch(
    // The model name is user-selectable, so keep it out of the path structure
    // by encoding it; `:generateContent` must stay literal.
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      purpose: 'Gemini request',
      method: 'POST',
      timeoutMs: GEMINI_TIMEOUT_MS,
      maxBytes: MAX_RESPONSE_BYTES,
      headers: {
        'Content-Type': 'application/json',
        // Passed as a header rather than the `?key=` query parameter Google's
        // quickstart suggests: query strings end up in proxy logs, crash
        // dumps and error messages.
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({ contents }),
    }
  );

  const data = parseJson<GeminiResponse>(response.text);
  if (!response.ok) {
    throw new Error(data?.error?.message || `Gemini Hiba: ${response.status}`);
  }
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Nem értelmezhető válasz érkezett a Gemini API-tól.');
  }
  return text;
}

async function callOllama(prompt: string): Promise<string> {
  const config = getConfig();
  const baseUrl = config.ai.ollamaUrl || 'http://localhost:11434';

  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error('Érvénytelen Ollama URL formátum.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || !isLoopbackHost(parsed.hostname)) {
    throw new Error('Invalid Ollama URL: only localhost is allowed');
  }

  const endpoint = config.ai.useContext ? '/api/chat' : '/api/generate';
  const body = config.ai.useContext
    ? {
        model: config.ai.ollamaModel || 'llama3.2',
        messages: conversationMessages,
        stream: false,
      }
    : {
        model: config.ai.ollamaModel || 'llama3.2',
        prompt,
        stream: false,
      };

  const response = await privacyFetch(`${baseUrl}${endpoint}`, {
    purpose: 'Ollama request',
    method: 'POST',
    timeoutMs: OLLAMA_TIMEOUT_MS,
    maxBytes: MAX_RESPONSE_BYTES,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    // Ollama runs on the machine; it is the one provider that stays local and
    // therefore the one that still works in offline mode.
    loopbackOnly: true,
  });

  if (!response.ok) {
    throw new Error(`Ollama Hiba: ${response.status}`);
  }
  const data = parseJson<OllamaResponse>(response.text);
  const reply = config.ai.useContext ? data?.message?.content : data?.response;
  if (!reply) {
    throw new Error('Üres válasz érkezett az Ollamától.');
  }
  return reply;
}

/**
 * Serialized AI dispatcher. All providers share a single in-flight queue so
 * conversation context manipulation is race-free.
 */
export function askAi(prompt: string): Promise<string> {
  const next = aiRequestQueue.then(async () => {
    const config = getConfig();
    if (!config.ai || !config.ai.provider) {
      throw new Error('Nincs kiválasztva AI szolgáltató a beállításokban.');
    }

    const requestId = `${Date.now().toString(36)}-${(++aiRequestCounter).toString(36)}`;

    if (typeof prompt !== 'string' || !prompt.trim()) {
      throw new Error('Üres kérdést nem lehet elküldeni.');
    }
    if (prompt.length > MAX_PROMPT_LENGTH) {
      throw new Error('A megadott szöveg túl hosszú.');
    }

    // Refuse before the prompt is added to the context, so a blocked request
    // leaves no trace in the conversation. Ollama is exempt: it never leaves
    // the machine.
    if (config.privacy.offlineMode && config.ai.provider !== 'ollama') {
      throw new Error(
        config.language === 'hu'
          ? 'Offline mód aktív: a felhős AI szolgáltatók le vannak tiltva. Használj Ollamát, vagy kapcsold ki az offline módot az Adatvédelem fülön.'
          : 'Offline mode is on: cloud AI providers are disabled. Use Ollama, or turn offline mode off in the Privacy tab.'
      );
    }

    if (config.ai.useContext) {
      conversationMessages.push({ role: 'user', content: prompt });
      pendingAiContextRequests.set(requestId, conversationMessages.length - 1);

      if (conversationMessages.length > MAX_CONTEXT_MESSAGES) {
        const trimCount = conversationMessages.length - MAX_CONTEXT_MESSAGES;
        conversationMessages = conversationMessages.slice(-MAX_CONTEXT_MESSAGES);
        for (const [id, idx] of pendingAiContextRequests.entries()) {
          const nextIdx = idx - trimCount;
          if (nextIdx < 0) pendingAiContextRequests.delete(id);
          else pendingAiContextRequests.set(id, nextIdx);
        }
      }
      healConversationContext(`pre-request:${requestId}`);
    }

    try {
      let reply: string;
      switch (config.ai.provider) {
        case 'openai':
          reply = await callOpenAI(prompt);
          break;
        case 'gemini':
          reply = await callGemini(prompt);
          break;
        case 'ollama':
          reply = await callOllama(prompt);
          break;
        default:
          throw new Error('Ismeretlen AI szolgáltató.');
      }

      if (config.ai.useContext) {
        conversationMessages.push({ role: 'assistant', content: reply });
        pendingAiContextRequests.delete(requestId);
        healConversationContext(`success:${requestId}`);
      }

      addChatEntry(prompt, reply);
      return reply;
    } catch (e) {
      if (config.ai.useContext) {
        const failedUserIndex = pendingAiContextRequests.get(requestId);
        if (
          typeof failedUserIndex === 'number' &&
          failedUserIndex >= 0 &&
          failedUserIndex < conversationMessages.length
        ) {
          const failedMsg = conversationMessages[failedUserIndex];
          if (failedMsg && failedMsg.role === 'user' && failedMsg.content === prompt) {
            conversationMessages.splice(failedUserIndex, 1);
          } else {
            console.warn(
              `[AI context cleanup] mapped request ${requestId} points to unexpected message; index=${failedUserIndex}`
            );
          }
        } else {
          console.warn(`[AI context cleanup] missing or invalid mapping for failed request ${requestId}`);
        }
        pendingAiContextRequests.delete(requestId);
        healConversationContext(`error:${requestId}`);
      }
      console.error('AI API error:', e);
      throw e;
    }
  });

  // Keep the queue chain regardless of success/failure so subsequent calls
  // serialize correctly.
  aiRequestQueue = next.catch(() => undefined);
  return next;
}
