# 帮妈妈问 AI

这是一个从头重写后的版本：只保留文档，代码收敛成 `frontend + server` 两个包。

目标很直接：妈妈遇到电子产品不会用的问题时，可以持续向 AI 追问；AI 先用文字、引导图和女声朗读回答；当问题边界不清或有风险时，界面会提示联系女儿，或进一步转给志愿者。女儿端暂不实现，分享入口先在前端 mock。

## 当前能力

- 单页妈妈端，只有一个长上下文会话
- 文字提问
- 拍照上传
- 相册图片上传
- MP4 视频上传
- 浏览器语音输入
- AI 文本回复
- AI 引导图回复
- 浏览器 TTS 女声播报
- 模糊问题自动建议联系女儿/志愿者
- 分享按钮可把当前建议发给别人

## 目录

```text
SideBySide/
├── README.md
├── DESIGN.md
├── DEPLOY_AZURE_APP_SERVICE.md
├── package.json
├── frontend/
│   ├── package.json
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── styles.css
│       └── lib/
│           ├── api.ts
│           └── types.ts
└── server/
    ├── package.json
    └── src/
        ├── server.ts
        ├── openai.ts
        ├── prompt.ts
        ├── store.ts
        └── types.ts
```

## 本地开发

前提：本机已安装 Node.js 20+。

```powershell
cd C:\Users\sunmeng\Downloads\SideBySide
npm install
npm run dev:frontend
npm run dev:server
```

默认约定：

- 前端开发地址：`http://localhost:5173`
- 服务端地址：`http://localhost:8787`
- 前端会把 `/api/*` 代理到服务端

也可以只启动服务端：

```powershell
npm run dev
```

## 环境变量

服务端支持 Azure OpenAI，也支持 mock 模式。

```env
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_API_VERSION=2024-08-01-preview
USE_MOCK_AI=true
PORT=8787
```

说明：

- `USE_MOCK_AI=true` 或缺少 Azure OpenAI 配置时，服务端自动走 mock 结果
- 图片会作为多模态输入发送给模型
- 视频目前作为附件摘要进入上下文，不做逐帧分析

## API

- `POST /api/session` 创建单一会话
- `GET /api/session/:sessionId` 读取当前会话
- `POST /api/chat` 发送文字和附件，返回完整会话
- `GET /api/health` 健康检查

## 已知限制

- 女儿端未实现，当前只保留分享入口和升级提示
- 视频仅上传给服务端并进入模型上下文摘要，不做视觉拆帧
- 语音输入依赖浏览器 `SpeechRecognition`，不支持时自动退回打字
- 语音播报依赖浏览器 `speechSynthesis`，不同设备音色会有差异
