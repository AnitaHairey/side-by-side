// Cross-tab bus to sync mom <-> daughter UI on the same machine.
// Uses BroadcastChannel + a localStorage snapshot so a tab opened later
// can still see the latest state immediately.

import type { ConversationMessage, SessionPayload } from './types';

export type BusEvent =
  | { type: 'session'; payload: SessionPayload }
  | { type: 'daughter-message'; payload: { sessionId: string; text: string } }
  | { type: 'volunteer-claim'; payload: { requestId: string } }
  | { type: 'mom-help'; payload: { sessionId: string; question: string; createdAt: number; phone?: string } };

const CHANNEL_NAME = 'mama-bao';
const SNAPSHOT_KEY = 'mama-bao.session-snapshot';

let channel: BroadcastChannel | null = null;
function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null;
  if (channel) return channel;
  if (typeof BroadcastChannel === 'undefined') return null;
  channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

export function publishSession(payload: SessionPayload): void {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
  getChannel()?.postMessage({ type: 'session', payload } satisfies BusEvent);
}

export function loadSnapshot(): SessionPayload | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionPayload;
  } catch {
    return null;
  }
}

export function publish(event: BusEvent): void {
  getChannel()?.postMessage(event);
}

export function subscribe(handler: (event: BusEvent) => void): () => void {
  const ch = getChannel();
  if (!ch) return () => {};
  const onMessage = (e: MessageEvent<BusEvent>) => handler(e.data);
  ch.addEventListener('message', onMessage);
  return () => ch.removeEventListener('message', onMessage);
}

export function appendDaughterMessageLocal(text: string): ConversationMessage {
  return {
    id: `daughter_${Date.now()}`,
    role: 'assistant',
    text,
    createdAt: Date.now(),
    from: 'daughter',
    assistant: {
      text,
      speakText: text,
      escalation: 'none',
      confidence: 'high',
    },
  };
}
