import type { ConversationMessage, Session, SessionPayload, StoredAttachment } from './types';

const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 1000 * 60 * 60 * 24;
const MAX_MESSAGES = 80;

let lastStamp = Date.now();

function nextStamp(): number {
  const current = Date.now();
  if (current <= lastStamp) {
    lastStamp += 1;
    return lastStamp;
  }
  lastStamp = current;
  return current;
}

function makeId(length = 8): string {
  return Math.random().toString(36).slice(2, 2 + length);
}

function newMessage(message: Omit<ConversationMessage, 'id' | 'createdAt'>): ConversationMessage {
  return {
    id: `msg_${makeId(10)}`,
    createdAt: nextStamp(),
    ...message,
  };
}

function buildWelcomeMessage(): ConversationMessage | null {
  return null;
}

export function createSession(): Session {
  cleanupExpiredSessions();
  const now = nextStamp();
  const welcome = buildWelcomeMessage();
  const session: Session = {
    id: `mom-${makeId(6)}`,
    createdAt: now,
    updatedAt: now,
    messages: welcome ? [welcome] : [],
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string): Session | undefined {
  cleanupExpiredSessions();
  const session = sessions.get(id);
  if (!session) return undefined;
  session.updatedAt = nextStamp();
  return session;
}

export function appendUserMessage(session: Session, text: string, attachments: StoredAttachment[]): ConversationMessage {
  const message = newMessage({
    role: 'user',
    text,
    attachments,
  });
  session.messages.push(message);
  trimMessages(session);
  session.updatedAt = message.createdAt;
  return message;
}

export function appendAssistantMessage(session: Session, message: ConversationMessage): ConversationMessage {
  session.messages.push(message);
  trimMessages(session);
  session.updatedAt = message.createdAt;
  return message;
}

export function makeAssistantMessage(message: ConversationMessage['assistant']): ConversationMessage {
  return newMessage({
    role: 'assistant',
    text: message?.text || '',
    assistant: message,
  });
}

export function latestImageDataUrl(session: Session): string | undefined {
  for (let index = session.messages.length - 1; index >= 0; index -= 1) {
    const attachments = session.messages[index].attachments || [];
    const image = attachments.find((attachment) => attachment.kind === 'image' && attachment.dataUrl);
    if (image?.dataUrl) {
      return image.dataUrl;
    }
  }
  return undefined;
}

export function serializeSession(session: Session): SessionPayload {
  return {
    sessionId: session.id,
    messages: session.messages.map((message) => ({
      ...message,
      attachments: (message.attachments || []).map((attachment) => ({
        id: attachment.id,
        kind: attachment.kind,
        name: attachment.name,
        mimeType: attachment.mimeType,
        size: attachment.size,
        note: attachment.note,
        previewUrl: attachment.previewUrl,
      })),
    })),
  };
}

function trimMessages(session: Session): void {
  if (session.messages.length <= MAX_MESSAGES) return;
  session.messages.splice(1, session.messages.length - MAX_MESSAGES);
}

function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.updatedAt > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}
