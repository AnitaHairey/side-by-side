import { AzureOpenAI } from 'openai';
import { SYSTEM_PROMPT } from './prompt';
import type { ConversationMessage, ModelResponse, StoredAttachment } from './types';

const VALID_ESCALATION = new Set(['none', 'daughter', 'volunteer']);
const VALID_CONFIDENCE = new Set(['high', 'medium', 'low']);

let client: AzureOpenAI | null = null;

function getModel(): string {
  return process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini';
}

function getClient(): AzureOpenAI {
  if (client) return client;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview';
  const deployment = getModel();
  if (!endpoint || !apiKey) throw new Error('Azure OpenAI 未配置');
  client = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });
  return client;
}

function isMock(): boolean {
  const setting = (process.env.USE_MOCK_AI || '').toLowerCase();
  return setting === 'true' || !process.env.AZURE_OPENAI_ENDPOINT || !process.env.AZURE_OPENAI_API_KEY;
}

export async function analyzeConversation(input: {
  text: string;
  attachments: StoredAttachment[];
  recentMessages: ConversationMessage[];
  latestImageDataUrl?: string;
}): Promise<ModelResponse> {
  if (isMock()) return mockResult(input.text, input.attachments, input.recentMessages);

  try {
    const oai = getClient();
    const model = getModel();
    const imageAttachments = input.attachments.filter((attachment) => attachment.kind === 'image' && attachment.dataUrl);
    const videoAttachments = input.attachments.filter((attachment) => attachment.kind === 'video');
    const imageDataUrls = [
      ...imageAttachments.map((attachment) => attachment.dataUrl).filter(Boolean),
      ...(imageAttachments.length === 0 && input.latestImageDataUrl ? [input.latestImageDataUrl] : []),
    ].slice(0, 2) as string[];

    const context = input.recentMessages.slice(-12).map((message) => {
      if (message.role === 'user') {
        const notes = (message.attachments || []).map((attachment) => attachment.note).join('；');
        return `妈妈：${message.text || '（没打字）'}${notes ? `；附件：${notes}` : ''}`;
      }
      return `助手：${message.assistant?.text || message.text}`;
    }).join('\n');

    const userContent: any[] = [
      {
        type: 'text',
        text: `最近对话：\n${context || '（这是第一轮）'}\n\n妈妈这次说：${input.text || '（主要靠附件表达）'}\n本轮图片数量：${imageAttachments.length}；视频数量：${videoAttachments.length}\n视频说明：${videoAttachments.map((attachment) => attachment.note).join('；') || '无'}\n请结合全部信息，给出下一步建议。`,
      },
    ];

    imageDataUrls.forEach((dataUrl) => {
      userContent.push({ type: 'image_url', image_url: { url: dataUrl, detail: 'low' } });
    });

    const response = await oai.chat.completions.create({
      model,
      temperature: 0.3,
      max_tokens: 260,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent as any },
      ],
    });

    const raw = response.choices?.[0]?.message?.content || '{}';
    const parsed = parseResult(raw, input.text, input.attachments);
    // Image generation disabled for now.
    return parsed;
  } catch (error: any) {
    console.error('[analyzeConversation] OpenAI 调用失败:', error?.status, error?.message, error?.error?.message || '');
    return {
      answer: '我这会儿没连稳，你把页面再发一遍，我继续陪你看。',
      speakText: '我这会儿没连稳，你把页面再发一遍，我继续陪你看。',
      guidanceLabel: '请再发一张图',
      escalation: 'daughter',
      escalationReason: '如果一直没成功，建议把当前页面转给女儿看看。',
      confidence: 'low',
    };
  }
}

async function generateGuidanceImage(prompt: string): Promise<string | null> {
  const oai = getClient();
  const model = process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT || 'dall-e-3';
  const size = (process.env.OPENAI_IMAGE_SIZE || '1024x1024') as '1024x1024' | '1024x1792' | '1792x1024';
  const fullPrompt = `${prompt}\n\nStyle: simple flat illustration for elderly users, soft warm colors, friendly cartoon, large red circles or yellow arrows pointing to the key UI element, large readable Chinese labels next to highlighted parts. No photo realism, no clutter.`;
  const res = await oai.images.generate({
    model,
    prompt: fullPrompt,
    size,
    n: 1,
  });
  const item: any = res?.data?.[0];
  if (!item) return null;
  if (item.url) return item.url as string;
  if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
  return null;
}

export function buildGuidanceImage(label: string, answer: string, escalation: ModelResponse['escalation']): string {
  const title = escapeXml(label || '下一步这样做');
  const body = escapeXml(answer || '把现在的页面重新发给我。');
  const footer = escalation === 'volunteer'
    ? 'AI 建议：也可以请志愿者接手'
    : escalation === 'daughter'
      ? 'AI 建议：可以联系女儿继续看'
      : 'AI 会继续在当前对话里陪你走完';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720">
    <defs>
      <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#eff4ff" />
        <stop offset="100%" stop-color="#ffffff" />
      </linearGradient>
      <linearGradient id="badge" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#4a7cff" />
        <stop offset="100%" stop-color="#7ba2ff" />
      </linearGradient>
    </defs>
    <rect width="1200" height="720" rx="48" fill="#f4f6fc" />
    <circle cx="140" cy="118" r="84" fill="#ffefe7" />
    <circle cx="1030" cy="88" r="62" fill="#e7efff" />
    <rect x="64" y="76" width="1072" height="568" rx="40" fill="url(#card)" stroke="#dfe6fb" />
    <rect x="112" y="126" width="224" height="56" rx="28" fill="url(#badge)" />
    <text x="224" y="162" text-anchor="middle" font-size="28" font-weight="700" fill="#ffffff">AI 引导图</text>
    <text x="112" y="248" font-size="62" font-weight="800" fill="#1f2432">${title}</text>
    <foreignObject x="112" y="292" width="976" height="220">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-size:36px;line-height:1.6;color:#384152;font-family:PingFang SC, Microsoft YaHei, sans-serif;">${body}</div>
    </foreignObject>
    <rect x="112" y="548" width="976" height="64" rx="24" fill="#fff4ee" />
    <text x="148" y="590" font-size="28" font-weight="600" fill="#c9562c">${escapeXml(footer)}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function parseResult(raw: string, userText: string, attachments: StoredAttachment[]): ModelResponse {
  try {
    const parsed = JSON.parse(raw) as Partial<ModelResponse>;
    const answer = normalizeSentence(parsed.answer, '我先陪你看着做，必要时我们再找女儿。');
    const speakText = normalizeSentence(parsed.speakText, answer);
    const guidanceLabel = normalizeSentence(parsed.guidanceLabel, '照着这一步做');
    const escalation = VALID_ESCALATION.has(String(parsed.escalation)) ? (parsed.escalation as ModelResponse['escalation']) : heuristicEscalation(userText, attachments);
    const escalationReason = typeof parsed.escalationReason === 'string' ? parsed.escalationReason.trim().slice(0, 80) : defaultEscalationReason(escalation);
    const confidence = VALID_CONFIDENCE.has(String(parsed.confidence)) ? (parsed.confidence as ModelResponse['confidence']) : (escalation === 'none' ? 'medium' : 'low');
    const needsImage = parsed.needsImage === true;
    const imagePrompt = typeof parsed.imagePrompt === 'string' ? parsed.imagePrompt.trim().slice(0, 600) : '';
    return {
      answer,
      speakText,
      guidanceLabel,
      escalation,
      escalationReason,
      confidence,
      needsImage,
      imagePrompt,
    };
  } catch {
    const escalation = heuristicEscalation(userText, attachments);
    return {
      answer: normalizeSentence(raw, '我先给你一个简单做法，不行我们再找真人帮忙。'),
      speakText: normalizeSentence(raw, '我先给你一个简单做法，不行我们再找真人帮忙。'),
      guidanceLabel: '先按提示试一下',
      escalation,
      escalationReason: defaultEscalationReason(escalation),
      confidence: escalation === 'none' ? 'medium' : 'low',
    };
  }
}

function normalizeSentence(value: unknown, fallback: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return (text || fallback).slice(0, 120);
}

function heuristicEscalation(userText: string, attachments: StoredAttachment[]): ModelResponse['escalation'] {
  const text = userText || '';
  if (/银行卡|转账|扣费|诈骗|验证码|身份证|医保|报错代码|冻结/.test(text)) {
    return 'volunteer';
  }
  if (/还是|不懂|不会|看不明白|没找到|失败|不行|卡住|不确定/.test(text)) {
    return 'daughter';
  }
  if (!text.trim() && attachments.length === 0) {
    return 'daughter';
  }
  return 'none';
}

function defaultEscalationReason(escalation: ModelResponse['escalation']): string {
  if (escalation === 'volunteer') {
    return '这类信息可能涉及风险，建议请女儿或志愿者一起确认。';
  }
  if (escalation === 'daughter') {
    return '如果你试了还是不顺，转给女儿继续看会更稳。';
  }
  return '';
}

function mockResult(userText: string, attachments: StoredAttachment[], recentMessages: ConversationMessage[]): ModelResponse {
  const fallbackRecent = recentMessages.length > 0 ? recentMessages[recentMessages.length - 1].text : '';
  const text = userText || fallbackRecent;
  if (/验证码|转账|银行卡|医保/.test(text)) {
    return {
      answer: '先别急着继续，牵涉到账户信息，建议把这页转给女儿确认。',
      speakText: '先别急着继续，牵涉到账户信息，建议把这页转给女儿确认。',
      guidanceLabel: '账户信息先确认',
      escalation: 'volunteer',
      escalationReason: '涉及身份或资金信息，最好请真人一起核对。',
      confidence: 'low',
    };
  }
  if (/还是|看不懂|不会|没找到/.test(text)) {
    return {
      answer: '我怕说得还不够准，你把这条建议顺手分享给女儿，一起看会更快。',
      speakText: '我怕说得还不够准，你把这条建议顺手分享给女儿，一起看会更快。',
      guidanceLabel: '建议联系女儿',
      escalation: 'daughter',
      escalationReason: '问题边界还不够清楚，可以让女儿接着看。',
      confidence: 'low',
    };
  }
  if (/付款|支付|交钱/.test(text)) {
    return {
      answer: '先看页面右下角，按一下写着“确认付款”的按钮。',
      speakText: '先看页面右下角，按一下写着确认付款的按钮。',
      guidanceLabel: '右下角确认付款',
      escalation: 'none',
      escalationReason: '',
      confidence: 'high',
    };
  }
  if (/快递|取件|盒子|包裹/.test(text)) {
    return {
      answer: '先把快递单号最清楚的那一面拍稳一点，我再帮你看下一步。',
      speakText: '先把快递单号最清楚的那一面拍稳一点，我再帮你看下一步。',
      guidanceLabel: '重拍快递单号',
      escalation: attachments.length > 0 ? 'none' : 'daughter',
      escalationReason: attachments.length > 0 ? '' : '如果不会拍，直接发给女儿代看也可以。',
      confidence: attachments.length > 0 ? 'medium' : 'low',
    };
  }
  return {
    answer: '先按页面里最显眼的蓝色按钮试一下，不行你再把新页面发给我。',
    speakText: '先按页面里最显眼的蓝色按钮试一下，不行你再把新页面发给我。',
    guidanceLabel: '先按蓝色按钮',
    escalation: 'none',
    escalationReason: '',
    confidence: 'medium',
  };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
