import { useEffect, useMemo, useRef, useState } from 'react';
import type { ConversationMessage, SessionPayload } from '../lib/types';
import { loadSnapshot, publish, subscribe } from '../lib/bus';

type Tab = 'mom' | 'community';

interface CommunityRequest {
  id: string;
  name: string;
  age: number;
  city: string;
  preview: string;
  detail: string;
  minutesAgo: number;
  tag: '诈骗咨询' | '操作引导' | '账户安全' | '健康';
  phone?: string;
}

const COMMUNITY_SEED: CommunityRequest[] = [
  {
    id: 'req_001',
    name: '李阿姨',
    age: 52,
    city: '河北·秦皇岛',
    preview: '收到一条说我中奖的短信，要不要点链接？',
    detail:
      '今天上午收到一条短信，说我抽到了某品牌洗衣机大奖，让我点链接领取。我有点心动，但又怕是骗人的。志愿者能帮我看看吗？',
    minutesAgo: 27,
    tag: '诈骗咨询',
    phone: '13703456789',
  },
  {
    id: 'req_002',
    name: '王大伯',
    age: 68,
    city: '北京·海淀',
    preview: '微信支付密码忘了，怎么改？',
    detail:
      '我老伴住院要交费，结果微信支付密码记不清了，输错三次现在登不上，急着用。有没有人能教我一步步改回来？',
    minutesAgo: 12,
    tag: '操作引导',
    phone: '13802345678',
  },
    {
    id: 'req_003',
    name: '徐奶奶',
    age: 71,
    city: '上海·徐汇',
    preview: '银行 App 提示要做人脸识别才能转账',
    detail:
      '我用的是工行手机银行，要转账时弹出要做人脸识别。我戴眼镜识别不出来，反复三次说我账户有风险。这是不是骗子搞的？',
    minutesAgo: 3,
    tag: '账户安全',
    phone: '13901234567',
  },
];

function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const isCantonese = (v: SpeechSynthesisVoice) =>
    /yue|zh-?hk|cantonese/i.test(v.lang) || /cantonese|hiugaai|hkmeng|tracy|danny/i.test(v.name);
  const zh = voices.filter((v) => /zh|chinese|cmn/i.test(v.lang) && !isCantonese(v));
  if (!zh.length) return null;
  const tiers: RegExp[] = [
    /xiaoxiao|xiaoyi|xiaomeng|xiaomo/i,
    /tingting|sinji|meijia/i,
    /(female|woman|女)/i,
  ];
  for (const re of tiers) {
    const hit = zh.find((v) => re.test(v.name));
    if (hit) return hit;
  }
  return zh[0];
}

function speak(text: string) {
  if (!text || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice(window.speechSynthesis.getVoices());
  if (v) u.voice = v;
  u.lang = 'zh-CN';
  u.rate = 0.95;
  u.pitch = 1.05;
  window.speechSynthesis.speak(u);
}

export default function DaughterApp() {
  const [tab, setTab] = useState<Tab>('mom');
  const [session, setSession] = useState<SessionPayload | null>(() => loadSnapshot());
  const [draft, setDraft] = useState('');
  const [toast, setToast] = useState('');
  const [activeRequest, setActiveRequest] = useState<CommunityRequest | null>(null);
  const [claimed, setClaimed] = useState<Record<string, boolean>>({});
  const [momRequests, setMomRequests] = useState<CommunityRequest[]>([]);
  const [unread, setUnread] = useState(0);
  const [communityUnread, setCommunityUnread] = useState(0);
  const [clock, setClock] = useState(() => new Date());
  const feedRef = useRef<HTMLDivElement>(null);
  const lastSpokenRef = useRef<string>('');

  const messages = session?.messages ?? [];

  const lastUserMessage = useMemo<ConversationMessage | null>(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'user') return messages[i];
    }
    return null;
  }, [messages]);

  useEffect(() => {
    return subscribe((event) => {
      if (event.type === 'session') {
        setSession(event.payload);
        if (tab !== 'mom') setUnread((n) => n + 1);
      } else if (event.type === 'mom-help') {
        const newReq: CommunityRequest = {
          id: `mom_${event.payload.createdAt}`,
          name: '你的妈妈',
          age: 60,
          city: '家里',
          preview: event.payload.question.slice(0, 32),
          detail: event.payload.question,
          minutesAgo: 0,
          tag: '操作引导',
          phone: event.payload.phone,
        };
        setMomRequests((list) => [newReq, ...list]);
        if (tab !== 'community') setCommunityUnread((n) => n + 1);
      }
    });
  }, [tab]);

  useEffect(() => {
    if (tab === 'community') setCommunityUnread(0);
  }, [tab]);

  useEffect(() => {
    if (tab === 'mom') setUnread(0);
  }, [tab]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, tab]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(''), 1800);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // 自动朗读新到的妈妈消息（女儿可能在做别的事）
  useEffect(() => {
    if (tab !== 'mom' || !lastUserMessage) return;
    if (lastUserMessage.id === lastSpokenRef.current) return;
    lastSpokenRef.current = lastUserMessage.id;
    if (lastUserMessage.text) speak(`妈妈说：${lastUserMessage.text}`);
  }, [lastUserMessage, tab]);

  function sendToMom() {
    const text = draft.trim();
    if (!text) {
      setToast('先打几个字');
      return;
    }
    if (!session) {
      setToast('妈妈那边还没开始会话');
      return;
    }
    publish({
      type: 'daughter-message',
      payload: { sessionId: session.sessionId, text },
    });
    setDraft('');
    setToast('已发到妈妈手机');
  }

  function callMom() {
    try {
      window.location.href = 'facetime://';
    } catch {
      /* ignore */
    }
    setToast('正在拨打 FaceTime…');
  }

  function claimRequest(req: CommunityRequest) {
    setClaimed((c) => ({ ...c, [req.id]: true }));
    publish({ type: 'volunteer-claim', payload: { requestId: req.id } });
    setToast(`已接单：${req.name}`);
    setActiveRequest(null);
  }

  function callRequester(req: CommunityRequest) {
    if (!req.phone) {
      setToast('该求助人没有留电话');
      return;
    }
    try {
      window.location.href = `tel:${req.phone}`;
    } catch {
      /* ignore */
    }
    setToast(`正在拨打 ${req.name} ${req.phone}`);
  }

  return (
    <PhoneShell clock={clock}>
      <div className="db-app">
        <header className="db-topbar db-topbar-daughter">
          <button
            className="db-top-btn"
            type="button"
            aria-label="呼叫妈妈"
            onClick={callMom}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </button>
          <div className="db-title">
            <div className="db-title-main">妈宝</div>
          </div>
          <button
            className="db-top-btn"
            type="button"
            aria-label="设置"
            onClick={() => setToast('设置开发中')}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </header>

        <div className="dt-tabs">
          <button
            type="button"
            className={`dt-tab ${tab === 'mom' ? 'is-active' : ''}`}
            onClick={() => setTab('mom')}
          >
            我的妈妈
            {unread > 0 ? <span className="dt-tab-badge">{unread}</span> : null}
          </button>
          <button
            type="button"
            className={`dt-tab ${tab === 'community' ? 'is-active' : ''}`}
            onClick={() => setTab('community')}
          >
            社区志愿
            <span className={`dt-tab-count ${communityUnread > 0 ? 'is-hot' : ''}`}>
              {COMMUNITY_SEED.length + momRequests.length - Object.keys(claimed).length}
            </span>
          </button>
        </div>

        {tab === 'mom' ? (
          <>
            <main className="db-feed dt-feed" ref={feedRef}>
              {messages.length === 0 ? (
                <div className="dt-empty">
                  <div className="dt-empty-emoji">💛</div>
                  <div className="dt-empty-title">妈妈那边还很安静</div>
                  <div className="dt-empty-sub">她一开始用「妈宝」，这里就会同步显示对话。</div>
                </div>
              ) : (
                messages.map((m) => <DaughterRow key={m.id} message={m} />)
              )}
            </main>

            <footer className="db-composer dt-composer">
              <button
                className="db-comp-icon db-comp-mic"
                type="button"
                aria-label="语音（占位）"
                onClick={() => setToast('女儿端语音暂未开放')}
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
              </button>
              <button
                className="db-comp-icon db-comp-cam"
                type="button"
                aria-label="拍照或选图（占位）"
                onClick={() => setToast('图片功能暂未开放')}
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
              </button>
              <div className="db-comp-input">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      sendToMom();
                    }
                  }}
                  placeholder="给妈妈一句提示"
                  rows={1}
                />
              </div>
              <button
                className="db-comp-send"
                type="button"
                aria-label="发送"
                onClick={sendToMom}
                disabled={!draft.trim()}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </footer>
          </>
        ) : (
          <main className="db-feed dt-feed">
            {[...momRequests, ...COMMUNITY_SEED].map((req) => {
              const isDone = claimed[req.id];
              const isMom = req.id.startsWith('mom_');
              return (
                <button
                  key={req.id}
                  type="button"
                  className={`dt-req-card ${isDone ? 'is-done' : ''} ${isMom ? 'is-mom' : ''}`}
                  onClick={() => !isDone && setActiveRequest(req)}
                  disabled={isDone}
                >
                  <div className="dt-req-row">
                    <div className="dt-req-avatar">{req.name.charAt(0)}</div>
                    <div className="dt-req-meta">
                      <div className="dt-req-name">
                        {req.name} · {req.age}岁
                        <span className={`dt-req-tag dt-req-tag-${
                          req.tag === '诈骗咨询' ? 'warn' :
                          req.tag === '账户安全' ? 'warn' :
                          req.tag === '操作引导' ? 'info' : 'soft'
                        }`}>{req.tag}</span>
                      </div>
                      <div className="dt-req-city">{req.city} · {req.minutesAgo} 分钟前</div>
                    </div>
                    <div className="dt-req-state">{isDone ? '已接' : '查看 ›'}</div>
                  </div>
                  <div className="dt-req-preview">「{req.preview}」</div>
                </button>
              );
            })}
          </main>
        )}

        {toast ? <div className="db-toast">{toast}</div> : null}

        {activeRequest ? (
          <div className="db-modal" role="dialog" aria-modal onClick={() => setActiveRequest(null)}>
            <div className="db-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="dt-modal-head">
                <div className="dt-req-avatar dt-req-avatar-lg">{activeRequest.name.charAt(0)}</div>
                <div>
                  <div className="db-modal-title" style={{ marginBottom: 2 }}>{activeRequest.name}（{activeRequest.age}岁）</div>
                  <div className="db-modal-text" style={{ fontSize: 12 }}>{activeRequest.city} · {activeRequest.minutesAgo} 分钟前</div>
                </div>
              </div>
              <div className="dt-modal-detail">{activeRequest.detail}</div>
              {activeRequest.phone ? (
                <button className="dt-modal-call" type="button" onClick={() => callRequester(activeRequest)}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  <span>打电话给 {activeRequest.name} {activeRequest.phone}</span>
                </button>
              ) : null}
              <button className="db-modal-primary" type="button" onClick={() => claimRequest(activeRequest)}>
                ✋ 我来帮她
              </button>
              <button className="db-modal-secondary" type="button" onClick={() => setActiveRequest(null)}>
                先看看其它的
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </PhoneShell>
  );
}

function DaughterRow({ message }: { message: ConversationMessage }) {
  if (message.role === 'user') {
    const images = (message.attachments || []).filter((a) => a.previewUrl && a.kind === 'image');
    return (
      <div className="db-row db-row-ai">
        <div className="db-avatar dt-avatar-mom" aria-hidden>妈</div>
        <div className="db-ai-card dt-card-mom">
          {message.text ? <p className="db-ai-text">{message.text}</p> : null}
          {images.length > 0 ? (
            <div className="db-image-grid">
              {images.map((a) => <img key={a.id} src={a.previewUrl} alt={a.name} />)}
            </div>
          ) : null}
        </div>
      </div>
    );
  }
  const isDaughter = message.from === 'daughter';
  const text = message.assistant?.text || message.text;
  if (isDaughter) {
    return (
      <div className="db-row db-row-user">
        <div className="db-bubble db-bubble-daughter">
          <p>{text}</p>
        </div>
        <div className="db-avatar db-avatar-daughter" aria-hidden>我</div>
      </div>
    );
  }
  return (
    <div className="db-row db-row-ai">
      <div className="db-avatar db-avatar-ai" aria-hidden>AI</div>
      <div className="db-ai-card">
        <div className="db-ai-from">AI 助手</div>
        <p className="db-ai-text">{text}</p>
        {message.assistant?.guidanceImageUrl ? (
          <img src={message.assistant.guidanceImageUrl} alt="引导图" className="db-guidance" />
        ) : null}
      </div>
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
