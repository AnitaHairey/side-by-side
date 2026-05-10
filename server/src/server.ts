import fs from 'fs';
import path from 'path';
import express, { Request, Response } from 'express';
import multer from 'multer';
import { analyzeConversation } from './openai';
import {
  appendAssistantMessage,
  appendUserMessage,
  createSession,
  getSession,
  latestImageDataUrl,
  makeAssistantMessage,
  serializeSession,
} from './store';
import type { StoredAttachment } from './types';

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 6,
  },
});
const port = Number(process.env.PORT || 8787);

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true, ts: Date.now() });
});

app.post('/api/session', (_req: Request, res: Response) => {
  const session = createSession();
  res.status(201).json(serializeSession(session));
});

app.get('/api/session/:sessionId', (req: Request, res: Response) => {
  const session = getSession(String(req.params.sessionId || ''));
  if (!session) {
    return res.status(404).json({ error: '会话不存在或已过期，请重新开始。' });
  }
  res.json(serializeSession(session));
});

app.post('/api/chat', upload.array('files', 6), async (req: Request, res: Response) => {
  const sessionId = String(req.body.sessionId || '').trim();
  const text = String(req.body.text || '').trim();
  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: '会话已过期，请刷新后重试。' });
  }

  const files = (req.files as Express.Multer.File[] | undefined) || [];
  const attachments = files.map(toStoredAttachment);
  if (!text && attachments.length === 0) {
    return res.status(400).json({ error: '请先输入问题，或者上传图片/视频。' });
  }

  appendUserMessage(session, text || '请帮我看看附件。', attachments);
  const model = await analyzeConversation({
    text,
    attachments,
    recentMessages: session.messages,
    latestImageDataUrl: latestImageDataUrl(session),
  });
  const assistantMessage = makeAssistantMessage({
    text: model.answer,
    speakText: model.speakText,
    guidanceLabel: model.guidanceLabel,
    guidanceImageUrl: (model as any).guidanceImageUrl,
    escalation: model.escalation,
    escalationReason: model.escalationReason,
    confidence: model.confidence,
  });
  appendAssistantMessage(session, assistantMessage);
  res.json(serializeSession(session));
});

const staticRoot = resolveStaticRoot();
if (staticRoot) {
  app.use(express.static(staticRoot));
  app.get('*', (req: Request, res: Response, next) => {
    if (req.path.startsWith('/api/')) {
      next();
      return;
    }
    res.sendFile(path.join(staticRoot, 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
});

function resolveStaticRoot(): string | null {
  const candidates = [
    path.resolve(__dirname, '../../frontend/dist'),
    path.resolve(process.cwd(), 'frontend/dist'),
    path.resolve(__dirname, '../public'),
  ];
  return candidates.find((candidate) => fs.existsSync(path.join(candidate, 'index.html'))) || null;
}

function toStoredAttachment(file: Express.Multer.File): StoredAttachment {
  const isImage = file.mimetype.startsWith('image/');
  const kind = isImage ? 'image' : 'video';
  const encoded = file.buffer.toString('base64');
  const dataUrl = isImage ? `data:${file.mimetype};base64,${encoded}` : undefined;
  const note = isImage
    ? `图片 ${file.originalname}`
    : `视频 ${file.originalname}，格式 ${file.mimetype || 'unknown'}，大小 ${formatFileSize(file.size)}`;

  return {
    id: `file_${Math.random().toString(36).slice(2, 10)}`,
    kind,
    name: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    note,
    previewUrl: dataUrl,
    dataUrl,
  };
}

function formatFileSize(size: number): string {
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)}MB`;
  }
  return `${Math.max(1, Math.round(size / 1024))}KB`;
}
