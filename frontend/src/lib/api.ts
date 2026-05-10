import type { ConversationMessage, SessionPayload, StoredAttachment } from './types';
import { MOCK_IMAGES } from './mockImages';
import { publishSession } from './bus';

// Use mocked scripted backend only on /mom/debug; real /mom uses backend AI.
function useMock(): boolean {
  if (typeof window === 'undefined') return true;
  return window.location.pathname.startsWith('/mom/debug');
}

// Demo-only mock backend. Holds a single in-memory session that scripts a
// stable JD 白条 demo conversation regardless of what the user types.

const SCRIPT: Array<{
  text: string;
  speakText?: string;
  guidanceImageUrl?: string;
  escalation?: 'none' | 'daughter' | 'volunteer';
  escalationReason?: string;
}> = [
  // Turn 1: 妈妈上传短信，AI 检测关键字
  {
    text:
      '妈妈别担心～\n这条短信是「京东金融」发的，里面提到「应还 316.78 元」。\n短信链接不安全，一定不要点哦。\n我们一起打开京东白条看看就知道啦。',
    speakText:
      '妈妈别担心～这条短信是京东金融发的，里面提到应还316.78元。短信链接不安全，一定不要点哦。我们一起打开京东白条看看就知道啦。',
  },
  // Turn 2: 引导打开京东 App + 进入"我的"
  {
    text:
      '妈妈，先打开京东。\n点右下角的「我的」，屏幕左侧就能看到「钱包」。\n里面有一行写着「白条 316.78」，点一下就好啦。',
    speakText:
      '妈妈，先打开京东。点右下角的我的，屏幕左侧就能看到钱包。里面有一行写着白条316.78，点一下就好啦。',
    guidanceImageUrl: MOCK_IMAGES.mine,
  },
  // Turn 3: 妈妈把白条页截图发回来 → 确认欠款 + 直接教点"查账还款"
  {
    text:
      '妈妈，账单是真的，短信不是骗人的。\n看这个页面，「可用额度」右边有「查账还款」，点一下就好啦。',
    speakText:
      '妈妈，账单是真的，短信不是骗人的。看你这个白条页面，可用额度右边有查账还款，点一下就好啦。',
    guidanceImageUrl: MOCK_IMAGES.baitiao,
  },
  // Turn 4 (was Turn 5): 到达还款页，分期 vs 还款，转给女儿
  {
    text:
      '妈妈，到这一步先停一下～\n下面有两个红色按钮：上面写「分期还款」，下面写「还款」。\n这两个不一样，点错会多花钱，让女儿来教你！',
    speakText:
      '妈妈，到这一步先停一下～下面有两个红色按钮，上面写分期还款，下面写还款。这两个不一样，点错会多花钱，让女儿来教你！',
    guidanceImageUrl: MOCK_IMAGES.repay,
    escalation: 'daughter',
    escalationReason: '涉及金钱敏感操作。',
  },
];

interface MockSession {
  sessionId: string;
  messages: ConversationMessage[];
  step: number;
}

let session: MockSession | null = null;

function newSession(): MockSession {
  return {
    sessionId: `mock_${Date.now()}`,
    messages: [],
    step: 0,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function createSession(): Promise<SessionPayload> {
  if (!useMock()) {
    const r = await fetch('/api/session', { method: 'POST' });
    if (!r.ok) throw new Error('创建会话失败');
    const payload = (await r.json()) as SessionPayload;
    session = { sessionId: payload.sessionId, messages: payload.messages, step: 0 };
    publishSession(payload);
    return payload;
  }
  session = newSession();
  const payload = { sessionId: session.sessionId, messages: session.messages };
  publishSession(payload);
  return payload;
}

export async function getSession(sessionId: string): Promise<SessionPayload> {
  if (!useMock()) {
    const r = await fetch(`/api/session/${encodeURIComponent(sessionId)}`);
    if (!r.ok) return createSession();
    const payload = (await r.json()) as SessionPayload;
    session = { sessionId: payload.sessionId, messages: payload.messages, step: 0 };
    publishSession(payload);
    return payload;
  }
  if (!session || session.sessionId !== sessionId) {
    session = newSession();
  }
  const payload = { sessionId: session.sessionId, messages: session.messages };
  publishSession(payload);
  return payload;
}

export async function sendMessage(input: {
  sessionId: string;
  text: string;
  files: File[];
}): Promise<SessionPayload> {
  if (!useMock()) {
    const fd = new FormData();
    fd.append('sessionId', input.sessionId);
    fd.append('text', input.text);
    for (const f of input.files) fd.append('files', f);
    const r = await fetch('/api/chat', { method: 'POST', body: fd });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || '请求失败');
    }
    const payload = (await r.json()) as SessionPayload;
    session = { sessionId: payload.sessionId, messages: payload.messages, step: 0 };
    publishSession(payload);
    return payload;
  }

  if (!session || session.sessionId !== input.sessionId) {
    session = newSession();
  }

  const attachments: StoredAttachment[] = input.files.map((file, index) => ({
    id: `att_${Date.now()}_${index}`,
    kind: file.type.startsWith('video/') ? 'video' : 'image',
    name: file.name,
    mimeType: file.type || 'image/jpeg',
    size: file.size,
    previewUrl: URL.createObjectURL(file),
    note: '',
  }));

  const userMessage: ConversationMessage = {
    id: `user_${Date.now()}`,
    role: 'user',
    text: input.text,
    attachments,
    createdAt: Date.now(),
  };

  const stepIdx = Math.min(session.step, SCRIPT.length - 1);
  const step = SCRIPT[stepIdx];
  session.step = Math.min(session.step + 1, SCRIPT.length - 1);

  await delay(1800 + Math.random() * 1000);

  const assistantMessage: ConversationMessage = {
    id: `assistant_${Date.now()}`,
    role: 'assistant',
    text: step.text,
    createdAt: Date.now(),
    assistant: {
      text: step.text,
      speakText: step.speakText || step.text,
      guidanceImageUrl: step.guidanceImageUrl,
      escalation: step.escalation || 'none',
      escalationReason: step.escalationReason,
      confidence: 'high',
    },
  };

  session.messages = [...session.messages, userMessage, assistantMessage];
  const payload = { sessionId: session.sessionId, messages: session.messages };
  publishSession(payload);
  return payload;
}

// Lets the daughter side push a message into mom's chat.
export function injectDaughterMessage(text: string): SessionPayload | null {
  if (!session) return null;
  const msg: ConversationMessage = {
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
  session.messages = [...session.messages, msg];
  const payload = { sessionId: session.sessionId, messages: session.messages };
  publishSession(payload);
  return payload;
}
