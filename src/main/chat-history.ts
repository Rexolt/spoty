import * as fs from 'fs';
import {
  chatHistoryFile,
  getConfig,
  readJsonFileCapped,
  writeFilePrivate,
} from './config';
import { isPlainObject } from './sanitize';
import type { ChatEntry } from '../shared/types';

const MAX_ENTRIES = 100;

/**
 * AI transcripts are the most sensitive thing Spoty can persist, so the file
 * is bounded on every axis: entry count, per-field length and total read size.
 * It is written 0600 through `writeFilePrivate`, and only ever written while
 * the user has opted into history.
 */
const MAX_FIELD_LENGTH = 16_000;
const MAX_HISTORY_BYTES = 4 * 1024 * 1024;

let chatHistory: ChatEntry[] = [];

export function getChatHistory(): ChatEntry[] {
  if (!getConfig().ai.saveHistory) return [];
  return chatHistory;
}

function clampField(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, MAX_FIELD_LENGTH) : '';
}

/** Accepts only entries that match the expected shape, dropping the rest. */
function sanitizeEntries(parsed: unknown): ChatEntry[] {
  if (!Array.isArray(parsed)) return [];
  const entries: ChatEntry[] = [];
  for (const raw of parsed.slice(-MAX_ENTRIES)) {
    if (!isPlainObject(raw)) continue;
    const id = clampField(raw.id).slice(0, 64);
    const prompt = clampField(raw.prompt);
    const reply = clampField(raw.reply);
    if (!id || (!prompt && !reply)) continue;
    entries.push({
      id,
      prompt,
      reply,
      time: clampField(raw.time).slice(0, 40),
      provider: clampField(raw.provider).slice(0, 32),
    });
  }
  return entries;
}

export function loadChatHistory(): void {
  if (!getConfig().ai.saveHistory) return;
  const parsed = readJsonFileCapped(chatHistoryFile, MAX_HISTORY_BYTES);
  if (parsed === null) {
    chatHistory = [];
    return;
  }
  const sanitized = sanitizeEntries(parsed);
  const changed = !Array.isArray(parsed) || sanitized.length !== parsed.length;
  chatHistory = sanitized;
  // Rewrite when we dropped anything, both to trim the file and to move it to
  // 0600 if it was created by an older version.
  if (changed) saveChatHistory();
}

export function saveChatHistory(): void {
  if (!getConfig().ai.saveHistory) return;
  try {
    writeFilePrivate(chatHistoryFile, JSON.stringify(chatHistory, null, 2));
  } catch (e) {
    console.error('Failed to save chat history:', (e as Error).message);
  }
}

export function addChatEntry(prompt: string, reply: string): void {
  if (!getConfig().ai.saveHistory) return;
  chatHistory.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    prompt: clampField(prompt),
    reply: clampField(reply),
    time: new Date().toISOString(),
    provider: getConfig().ai.provider,
  });
  while (chatHistory.length > MAX_ENTRIES) {
    chatHistory.shift();
  }
  saveChatHistory();
}

export function clearChatHistory(): void {
  chatHistory = [];
  saveChatHistory();
}

export function deleteChatEntry(id: string): boolean {
  if (typeof id !== 'string') return false;
  if (id === '__all__') {
    chatHistory = [];
    // A "delete everything" request should remove the file, not leave an
    // empty JSON array behind that still proves history was once kept.
    clearMemoryAndFile();
    return true;
  }
  chatHistory = chatHistory.filter((e) => e.id !== id);
  saveChatHistory();
  return true;
}

export function clearMemoryAndFile(): void {
  chatHistory = [];
  try {
    if (fs.existsSync(chatHistoryFile)) fs.unlinkSync(chatHistoryFile);
  } catch {
    // ignore
  }
}
