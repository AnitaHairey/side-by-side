import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createSession, injectDaughterMessage, sendMessage } from './lib/api';
import { publish, subscribe } from './lib/bus';
import type {
  ComposerAttachment,
  ConversationMessage,
  SessionPayload,
  VoiceState,
} from './lib/types';

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type SpeechRecognitionEventLike = {
  results: ArrayLike<{
    isFinal?: boolean;
    0: { transcript: string };
  }>;
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const SESSION_STORAGE_KEY = 'sidebyside.session-id';
const VOICE_STORAGE_KEY = 'sidebyside.voice-enabled';
const VOLUNTEER_PHONE = '12349'; // 全国社区便民服务热线（演示用）
const MOM_PHONE = '13800138000'; // 演示用妈妈电话

function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  // 只要普通话：排除粤语 (yue / zh-HK / cantonese) 和台湾腔可选
  const isMandarin = (v: SpeechSynthesisVoice) =>
    /(^|[-_])zh[-_]?cn|^zh$|cmn|mandarin/i.test(v.lang) ||
    (/zh/i.test(v.lang) && !/yue|hk|tw|hant|cantonese/i.test(v.lang) && !/cantonese|hongkong|taiwan|hanhan/i.test(v.name));
  const isCantonese = (v: SpeechSynthesisVoice) =>
    /yue|zh-?hk|cantonese/i.test(v.lang) || /cantonese|hiugaai|hkmeng|tracy|danny/i.test(v.name);

  const zh = voices.filter((v) => /zh|chinese|cmn/i.test(v.lang) && !isCantonese(v));
  const mandarin = zh.filter(isMandarin);
  const pool = mandarin.length ? mandarin : zh;
  if (pool.length === 0) return null;

  const tiers: RegExp[] = [
    // 微软 Azure Neural 普通话女声（最自然）
    /xiaoxiao|xiaoyi|xiaomeng|xiaomo|xiaoqiu|xiaorui|xiaoshuang|xiaoxuan|xiaohan/i,
    // Apple iOS/macOS 普通话女声
    /tingting|ting-ting|sin-ji|sinji|mei-?jia|meijia|li-?mu|yu-?shu/i,
    // Google 普通话女声
    /google.*(zh-?cn|mandarin|female)|zh-?cn-?standard-?[a-d]/i,
    // 通用关键词
    /(female|woman|女)/i,
  ];
  for (const re of tiers) {
    const hit = pool.find((v) => re.test(v.name));
    if (hit) return hit;
  }
  const notMale = pool.find((v) => !/(male|man|男|kangkang|yunyang|yunxi|yunjian|yunfeng)/i.test(v.name));
  return notMale || pool[0];
}

function speak(text: string) {
  if (!text || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(window.speechSynthesis.getVoices());
  if (voice) utterance.voice = voice;
  utterance.lang = 'zh-CN';
  utterance.rate = 0.92;
  utterance.pitch = 1.18;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
}

// iOS Safari: 必须在用户手势中先「解锁」TTS，否则后续 speak() 会被静默丢弃。
let ttsUnlocked = false;
function unlockTTS() {
  if (ttsUnlocked || typeof window === 'undefined' || !window.speechSynthesis) return false;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance('妈宝已开启声音');
    const voice = pickVoice(window.speechSynthesis.getVoices());
    if (voice) u.voice = voice;
    u.lang = 'zh-CN';
    u.volume = 1;
    u.rate = 0.95;
    u.pitch = 1.15;
    window.speechSynthesis.speak(u);
    ttsUnlocked = true;
    return true;
  } catch {
    return false;
  }
}

function isIOS() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
}

function App() {
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [pendingFiles, setPendingFiles] = useState<ComposerAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState('');
  const [facetimeOpen, setFacetimeOpen] = useState(false);
  const [callMenuOpen, setCallMenuOpen] = useState(false);
  const [communityRequested, setCommunityRequested] = useState(false);
  const [communityHelpOpen, setCommunityHelpOpen] = useState(false);
  const [helpDraft, setHelpDraft] = useState('');
  const [helpListening, setHelpListening] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(
    () => localStorage.getItem(VOICE_STORAGE_KEY) !== 'off',
  );
  const [pttActive, setPttActive] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const [needTtsUnlock, setNeedTtsUnlock] = useState<boolean>(() => false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const voiceTargetRef = useRef<'composer' | 'help'>('composer');
  const spokenMessageIdRef = useRef('');
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const latestAssistant = useMemo(
    () => [...messages].reverse().find((message) => message.role === 'assistant') || null,
    [messages],
  );

  useEffect(() => {
    const SpeechRecognitionApi = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognitionApi) {
      const recognition = new SpeechRecognitionApi();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'zh-CN';
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0]?.transcript || '')
          .join('')
          .trim();
        if (voiceTargetRef.current === 'help') {
          setHelpDraft(transcript);
        } else {
          setDraft(transcript);
        }
      };
      recognition.onerror = (event) => {
        if (event?.error === 'not-allowed') setToast('请允许麦克风权限');
        setVoiceState('error');
      };
      recognition.onend = () =>
        setVoiceState((current) => (current === 'listening' ? 'idle' : current));
      recognitionRef.current = recognition;
    }

    void (async () => {
      try {
        const created = await createSession();
        localStorage.setItem(SESSION_STORAGE_KEY, created.sessionId);
        setSessionId(created.sessionId);
        setMessages(created.messages);
      } catch {
        // ignore; user can retry by sending a message
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      recognitionRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem(VOICE_STORAGE_KEY, voiceEnabled ? 'on' : 'off');
  }, [voiceEnabled]);

  // 监听女儿端通过 BroadcastChannel 推过来的消息
  useEffect(() => {
    return subscribe((event) => {
      if (event.type === 'daughter-message') {
        const updated = injectDaughterMessage(event.payload.text);
        if (updated) setMessages(updated.messages);
      }
    });
  }, []);

  // iOS Safari 解锁：第一次 pointerdown 触发一次静音 utterance
  useEffect(() => {
    const handler = () => {
      if (unlockTTS()) {
        setNeedTtsUnlock(false);
      }
      window.removeEventListener('pointerdown', handler, true);
      window.removeEventListener('touchstart', handler, true);
      window.removeEventListener('keydown', handler, true);
    };
    window.addEventListener('pointerdown', handler, true);
    window.addEventListener('touchstart', handler, true);
    window.addEventListener('keydown', handler, true);
    return () => {
      window.removeEventListener('pointerdown', handler, true);
      window.removeEventListener('touchstart', handler, true);
      window.removeEventListener('keydown', handler, true);
    };
  }, []);

  useEffect(() => {
    if (!voiceEnabled || !latestAssistant || latestAssistant.id === spokenMessageIdRef.current) {
      return;
    }
    const speechText = latestAssistant.assistant?.speakText || latestAssistant.assistant?.text;
    if (!speechText || !window.speechSynthesis) return;
    spokenMessageIdRef.current = latestAssistant.id;
    const trigger = () => speak(speechText);
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        trigger();
        window.speechSynthesis.onvoiceschanged = null;
      };
    } else {
      trigger();
    }
  }, [latestAssistant, voiceEnabled]);

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(''), 1800);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, 120)}px`;
  }, [draft]);

  async function ensureFreshSession(): Promise<SessionPayload> {
    const created = await createSession();
    localStorage.setItem(SESSION_STORAGE_KEY, created.sessionId);
    setSessionId(created.sessionId);
    setMessages(created.messages);
    return created;
  }

  function startPushToTalk() {
    if (!recognitionRef.current) {
      setToast('当前浏览器不支持语音，iPhone 请用输入');
      setVoiceState('unsupported');
      return;
    }
    if (pttActive) return;
    setPttActive(true);
    setDraft('');
    setVoiceState('listening');
    try {
      recognitionRef.current.start();
    } catch {
      try {
        recognitionRef.current.stop();
        recognitionRef.current.start();
      } catch {
        /* ignore */
      }
    }
  }

  function toggleVoice() {
    if (pttActive) endPushToTalk(true);
    else startPushToTalk();
  }

  function endPushToTalk(commit = true) {
    if (!pttActive) return;
    setPttActive(false);
    const rec = recognitionRef.current;
    if (rec) {
      // 阻止 stop 之后还可能到来的 onresult 回写 draft
      rec.onresult = null;
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
    setVoiceState('idle');
    if (commit) {
      const text = (textareaRef.current?.value ?? draft).trim();
      setDraft('');
      if (text) {
        window.setTimeout(() => {
          void handleSubmit(text);
        }, 200);
      }
    }
    // 恢复 onresult 以便下次语音输入可用
    window.setTimeout(() => {
      if (rec) {
        rec.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map((result) => result[0]?.transcript || '')
            .join('')
            .trim();
          setDraft(transcript);
        };
      }
    }, 400);
  }

  function appendFiles(fileList: FileList | null) {
    if (!fileList) return;
    const next: ComposerAttachment[] = Array.from(fileList).slice(0, 6).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      file,
      kind: file.type.startsWith('video/') ? 'video' : 'image',
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
    }));
    setPendingFiles((current) => [...current, ...next].slice(0, 6));
  }

  function removePendingFile(id: string) {
    setPendingFiles((current) => {
      const target = current.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  }

  async function handleSubmit(overrideText?: string) {
    if (sending) return;
    const text = (overrideText ?? draft).trim();
    if (!text && pendingFiles.length === 0) {
      setToast('先说一句话，或加张图');
      return;
    }
    if (!sessionId) await ensureFreshSession();

    const filesSnapshot = pendingFiles;
    const optimisticAttachments = filesSnapshot.map((item) => ({
      id: item.id,
      name: item.file.name,
      kind: item.kind,
      size: item.file.size,
      mimeType: item.file.type,
      previewUrl: item.previewUrl,
      note: '',
    }));
    const optimisticMessage: ConversationMessage = {
      id: `local_${Date.now()}`,
      role: 'user',
      text,
      attachments: optimisticAttachments,
      createdAt: Date.now(),
    };
    setMessages((current) => [...current, optimisticMessage]);
    setDraft('');
    setPendingFiles([]);

    setSending(true);
    try {
      const response = await sendMessage({
        sessionId,
        text,
        files: filesSnapshot.map((item) => item.file),
      });
      setMessages(response.messages);
      filesSnapshot.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
    } catch {
      const fallback = await ensureFreshSession();
      setMessages(fallback.messages);
      setToast('网络有点慢，已重新开始会话');
    } finally {
      setSending(false);
    }
  }

  function openFaceTime() {
    setCallMenuOpen(false);
    setFacetimeOpen(true);
  }

  function openCallMenu() {
    setCallMenuOpen(true);
  }

  function requestCommunity() {
    setCallMenuOpen(false);
    const lastUserText = [...messages].reverse().find((m) => m.role === 'user')?.text || '';
    setHelpDraft(lastUserText);
    setCommunityHelpOpen(true);
  }

  function startHelpVoice() {
    if (!recognitionRef.current) {
      setToast('当前浏览器不支持语音，请直接打字');
      return;
    }
    if (helpListening) {
      stopHelpVoice();
      return;
    }
    voiceTargetRef.current = 'help';
    setHelpListening(true);
    setHelpDraft('');
    try {
      recognitionRef.current.start();
    } catch {
      try {
        recognitionRef.current.stop();
        recognitionRef.current.start();
      } catch {
        /* ignore */
      }
    }
  }

  function stopHelpVoice() {
    setHelpListening(false);
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
    voiceTargetRef.current = 'composer';
  }

  function submitCommunityHelp() {
    const text = helpDraft.trim();
    if (!text) {
      setToast('先说一句你想求助的内容');
      return;
    }
    stopHelpVoice();
    setCommunityRequested(true);
    publish({
      type: 'mom-help',
      payload: {
        sessionId: sessionId || `mock_${Date.now()}`,
        question: text,
        createdAt: Date.now(),
        phone: MOM_PHONE,
      },
    });
    setCommunityHelpOpen(false);
    setHelpDraft('');
    setToast('已发送社区求助，志愿者看到会联系你');
  }

  function callVolunteer() {
    try {
      window.location.href = `tel:${VOLUNTEER_PHONE}`;
    } catch {
      /* ignore */
    }
    setToast(`正在拨打社区热线 ${VOLUNTEER_PHONE}`);
  }

  function launchFaceTime() {
    // Try to open FaceTime app via URL scheme. On non-Apple devices this
    // simply does nothing visible — the modal stays up so the user can read
    // the steps.
    try {
      window.location.href = 'facetime://';
    } catch {
      /* ignore */
    }
  }

  async function handleShare(text?: string) {
    const last = latestAssistant?.assistant?.text || '';
    const escalation = latestAssistant?.assistant?.escalation || 'none';
    const tail =
      escalation === 'volunteer'
        ? '\n（AI 建议：转给志愿者继续看）'
        : escalation === 'daughter'
          ? '\n（AI 建议：联系女儿继续看）'
          : '';
    const payload = `帮妈妈问 AI\n\n${text || last || '我正在请 AI 帮妈妈解决手机使用问题。'}${tail}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: '帮妈妈问 AI', text: payload });
        return;
      } catch {
        /* fall through */
      }
    }
    try {
      await navigator.clipboard.writeText(payload);
      setToast('已复制建议，可以发给女儿或志愿者');
    } catch {
      setToast('当前浏览器不支持自动复制');
    }
  }


  if (loading) {
    return (
      <PhoneShell clock={clock}>
        <div className="db-app">
          <div className="db-loading">正在准备会话…</div>
        </div>
      </PhoneShell>
    );
  }

  const canSend = draft.trim().length > 0 || pendingFiles.length > 0;

  return (
    <PhoneShell clock={clock}>
    <div className="db-app">
      {needTtsUnlock && voiceEnabled ? (
        <div
          className="db-tts-unlock"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            unlockTTS();
            setNeedTtsUnlock(false);
          }}
        >
          <div className="db-tts-unlock-card" onClick={(e) => e.stopPropagation()}>
            <div className="db-tts-unlock-emoji">🔊</div>
            <div className="db-tts-unlock-title">点一下，开启朗读</div>
            <div className="db-tts-unlock-sub">
              苹果手机要先点一下才能让妈宝出声，<br />开启后 AI 回复会自动念给妈妈听。
            </div>
            <button
              type="button"
              className="db-tts-unlock-btn"
              onClick={() => {
                unlockTTS();
                setNeedTtsUnlock(false);
              }}
            >
              开启朗读
            </button>
          </div>
        </div>
      ) : null}
      <header className="db-topbar">
        <button
          className="db-top-btn db-top-btn-left"
          type="button"
          aria-label="打电话求助"
          onClick={openCallMenu}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        </button>
        <div className="db-title">
          <div className="db-title-main">妈宝</div>
        </div>
        <button
          className="db-top-btn db-top-btn-right"
          type="button"
          aria-label="设置"
          onClick={() => setToast('设置功能开发中')}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
      </header>

      <main className="db-feed">
        {!messages.some((m) => m.role === 'user') ? (
          <div className="db-hero">
            <div className="db-hero-greeting">妈妈，我是妈宝</div>
            <div className="db-hero-sub">点相机传图片，点麦克风问我，我一步一步陪你解决<span className="db-hero-heart-inline">♡</span></div>
            <div className="db-hero-divider" />
            <div className="db-hero-tip">你可以这样问</div>
            <div className="db-hero-suggests">
              <button
                type="button"
                className="db-hero-chip"
                onClick={() => setDraft('这条短信是真的吗？')}
              >这条短信是真的吗？</button>
              <button
                type="button"
                className="db-hero-chip"
                onClick={() => setDraft('微信支付密码忘了怎么改？')}
              >微信支付密码忘了怎么改？</button>
              <button
                type="button"
                className="db-hero-chip"
                onClick={() => setDraft('找不到路怎么办？')}
              >找不到路怎么办？</button>
            </div>
          </div>
        ) : null}

        {(messages.some((m) => m.role === 'user') ? messages : []).map((message) => {
          const isUser = message.role === 'user';
          const images = (message.attachments || []).filter((item) => item.previewUrl && item.kind === 'image');
          const videos = (message.attachments || []).filter((item) => item.kind === 'video');
          if (isUser) {
            return (
              <div key={message.id} className="db-row db-row-user">
                <div className="db-bubble db-bubble-user">
                  {message.text ? <p>{message.text}</p> : null}
                  {images.length > 0 ? (
                    <div className="db-image-grid">
                      {images.map((attachment) => (
                        <img key={attachment.id} src={attachment.previewUrl} alt={attachment.name} />
                      ))}
                    </div>
                  ) : null}
                  {videos.length > 0 ? (
                    <div className="db-attach-tags">
                      {videos.map((attachment) => (
                        <span key={attachment.id}>🎬 {attachment.name}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="db-avatar db-avatar-user" aria-hidden>妈</div>
              </div>
            );
          }
          const text = message.assistant?.text || message.text;
          const escalation = message.assistant?.escalation || 'none';
          const isDaughter = message.from === 'daughter';
          return (
            <div key={message.id} className="db-row db-row-ai">
              <div className={`db-avatar ${isDaughter ? 'db-avatar-daughter' : 'db-avatar-ai'}`} aria-hidden>
                {isDaughter ? '女' : 'AI'}
              </div>
              <div className={`db-ai-card ${isDaughter ? 'db-ai-card-daughter' : ''}`}>
                {isDaughter ? null : null}
                <p className="db-ai-text">{text}</p>
                {message.assistant?.guidanceImageUrl ? (
                  <GuidanceImage src={message.assistant.guidanceImageUrl} />
                ) : null}
                {escalation !== 'none' ? (
                  <div className={`db-escalation db-escalation-${escalation}`}>
                    <div className="db-escalation-title">
                      {escalation === 'volunteer' ? '建议转给志愿者' : '建议联系女儿'}
                    </div>
                    {message.assistant?.escalationReason ? (
                      <div className="db-escalation-reason">{message.assistant.escalationReason}</div>
                    ) : null}
                    <button className="db-escalation-btn" type="button" onClick={openFaceTime}>
                      📞 用 FaceTime 联系女儿
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}

        {sending ? (
          <div className="db-row db-row-ai">
            <div className="db-avatar db-avatar-ai" aria-hidden>AI</div>
            <div className="db-ai-card db-ai-typing">
              <span className="db-dot" />
              <span className="db-dot" />
              <span className="db-dot" />
            </div>
          </div>
        ) : null}

        <div ref={messagesEndRef} />
      </main>

      {pendingFiles.length > 0 ? (
        <div className="db-pending">
          {pendingFiles.map((item) => (
            <div key={item.id} className="db-pending-item">
              {item.previewUrl ? (
                <img src={item.previewUrl} alt={item.file.name} />
              ) : (
                <div className="db-pending-video">MP4</div>
              )}
              <button type="button" aria-label="移除" onClick={() => removePendingFile(item.id)}>×</button>
            </div>
          ))}
        </div>
      ) : null}

      <footer className="db-composer">
        <button
          className={`db-comp-icon db-comp-mic ${pttActive ? 'is-listening' : ''}`}
          type="button"
          aria-label={pttActive ? '点击发送' : '点击说话'}
          onClick={toggleVoice}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
        </button>

        <button
          className="db-comp-icon db-comp-cam"
          type="button"
          aria-label="拍照或选图"
          onClick={() => galleryInputRef.current?.click()}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
        </button>

        <div className="db-comp-input">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder="也可以在这里打字"
            rows={1}
          />
        </div>

        <button
          className="db-comp-send"
          type="button"
          aria-label="发送"
          onClick={() => handleSubmit()}
          disabled={sending || !canSend}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
        </button>
      </footer>

      {pttActive ? (
        <div className="db-ptt-hint">
          <span className="db-ptt-wave" />
          请说话，再点麦克风发送
        </div>
      ) : null}

      <input
        ref={galleryInputRef}
        className="db-file-input"
        type="file"
        accept="image/*"
        multiple
        onChange={(event) => {
          appendFiles(event.target.files);
          event.target.value = '';
        }}
      />

      {toast ? <div className="db-toast">{toast}</div> : null}

      {callMenuOpen ? (
        <div className="db-modal" role="dialog" aria-modal="true" onClick={() => setCallMenuOpen(false)}>
          <div className="db-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="db-modal-title">想找谁帮忙？</div>
            <div className="db-modal-text">先打给女儿；如果她在忙，就发一条到社区，志愿者会很快回你。</div>
            <button className="db-call-option db-call-option-daughter" type="button" onClick={openFaceTime}>
              <span className="db-call-option-icon" aria-hidden>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              </span>
              <span className="db-call-option-text">
                <span className="db-call-option-title">打给女儿</span>
                <span className="db-call-option-sub">用 FaceTime 视频</span>
              </span>
            </button>
            <button className="db-call-option db-call-option-community" type="button" onClick={requestCommunity}>
              <span className="db-call-option-icon" aria-hidden>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </span>
              <span className="db-call-option-text">
                <span className="db-call-option-title">{communityRequested ? '再发一次社区求助' : '社区求助'}</span>
                <span className="db-call-option-sub">{communityRequested ? '志愿者已收到，可再补一句' : '女儿没空时，志愿者来帮你'}</span>
              </span>
            </button>
            <button className="db-modal-secondary" type="button" onClick={() => setCallMenuOpen(false)}>
              先不用了
            </button>
          </div>
        </div>
      ) : null}

      {communityHelpOpen ? (
        <div
          className="db-modal"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            stopHelpVoice();
            setCommunityHelpOpen(false);
          }}
        >
          <div className="db-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="db-modal-title">找社区志愿者帮你</div>
            <div className="db-modal-text">
              说一句话告诉志愿者你遇到的问题，发出去之后他们会回你；急的话也可以直接打电话。
            </div>
            <button
              type="button"
              className={`db-help-mic ${helpListening ? 'is-on' : ''}`}
              onClick={startHelpVoice}
              aria-label={helpListening ? '停止录音' : '按住说话'}
            >
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
              <span>{helpListening ? '正在听…再点一下结束' : '点一下，说出你要问的话'}</span>
            </button>
            <textarea
              className="db-help-text"
              value={helpDraft}
              onChange={(e) => setHelpDraft(e.target.value)}
              placeholder="也可以直接打字，比如：我收到一条短信说我中奖了，能帮我看看是不是骗人的吗？"
              rows={3}
            />
            <div className="db-help-actions">
              <button className="db-help-call" type="button" onClick={callVolunteer}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                <span>打热线 {VOLUNTEER_PHONE}</span>
              </button>
              <button className="db-help-send" type="button" onClick={submitCommunityHelp}>
                发送求助
              </button>
            </div>
            <button
              className="db-modal-secondary"
              type="button"
              onClick={() => {
                stopHelpVoice();
                setCommunityHelpOpen(false);
              }}
            >
              先不发了
            </button>
          </div>
        </div>
      ) : null}

      {facetimeOpen ? (
        <div className="db-modal" role="dialog" aria-modal="true" onClick={() => setFacetimeOpen(false)}>
          <div className="db-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="db-ft-icon" aria-hidden>
              <svg viewBox="0 0 24 24" width="36" height="36" fill="#fff"><path d="M17 10.5V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3.5l5 4v-11l-5 4z"/></svg>
            </div>
            <div className="db-modal-title">用 FaceTime 联系女儿</div>
            <div className="db-modal-text">
              拿不准就让女儿陪你看。
            </div>
            <ol className="db-modal-steps">
              <li>点下面「打开 FaceTime」</li>
              <li>在联系人里选「女儿」</li>
              <li>点绿色的「视频」按钮</li>
            </ol>
            <button className="db-modal-primary" type="button" onClick={launchFaceTime}>
              打开 FaceTime
            </button>
            <button className="db-modal-secondary" type="button" onClick={() => setFacetimeOpen(false)}>
              不用了
            </button>
          </div>
        </div>
      ) : null}
    </div>
    </PhoneShell>
  );
}

function DaughterAvatar() {
  return (
    <div className="db-hero-placeholder" aria-label="女儿头像占位">
      <span>女儿</span>
    </div>
  );
}

function GuidanceImage({ src }: { src: string }) {
  const [showImg, setShowImg] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setShowImg(false);
    setLoaded(false);
    const t = window.setTimeout(() => setShowImg(true), 2200);
    return () => window.clearTimeout(t);
  }, [src]);

  return (
    <div className={`db-guidance-wrap ${loaded ? 'is-loaded' : 'is-loading'}`}>
      {!loaded ? (
        <div className="db-guidance-skeleton" aria-hidden>
          <div className="db-guidance-skeleton-shimmer" />
          <div className="db-guidance-skeleton-text">引导图加载中…</div>
        </div>
      ) : null}
      {showImg ? (
        <img
          className="db-guidance"
          src={src}
          alt="引导图"
          onLoad={() => setLoaded(true)}
          style={loaded ? undefined : { position: 'absolute', opacity: 0, pointerEvents: 'none' }}
        />
      ) : null}
    </div>
  );
}

function PhoneShell({ clock, children }: { clock: Date; children: React.ReactNode }) {
  const time = new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(clock);
  return (
    <div className="phone-shell">
      <div className="phone-frame">
        <div className="phone-statusbar">
          <span className="phone-time">{time}</span>
          <span className="phone-island" />
          <span className="phone-status-right">
            <svg viewBox="0 0 18 12" width="18" height="11" aria-hidden>
              <rect x="0" y="8" width="3" height="4" rx="0.6" fill="currentColor" />
              <rect x="4.5" y="6" width="3" height="6" rx="0.6" fill="currentColor" />
              <rect x="9" y="3.5" width="3" height="8.5" rx="0.6" fill="currentColor" />
              <rect x="13.5" y="0.5" width="3" height="11.5" rx="0.6" fill="currentColor" />
            </svg>
            <svg viewBox="0 0 16 12" width="16" height="11" aria-hidden>
              <path
                d="M8 11.2 a1 1 0 1 1 0-2 a1 1 0 0 1 0 2 z M3.4 7.4 a6.5 6.5 0 0 1 9.2 0 l-1.1 1.1 a5 5 0 0 0-7 0z M0.8 4.8 a10.2 10.2 0 0 1 14.4 0 l-1.1 1.1 a8.7 8.7 0 0 0-12.2 0z"
                fill="currentColor"
              />
            </svg>
            <span className="phone-battery">
              <span className="phone-battery-level" />
            </span>
          </span>
        </div>
        <div className="phone-screen">{children}</div>
        <div className="phone-home" />
      </div>
    </div>
  );
}

export default App;
