# 妈宝 Side By Side

这是一个双端联动的演示项目，核心目标是帮助不熟悉智能手机的妈妈处理复杂页面操作。


项目采用 Monorepo 结构，前端与服务端分离:

- frontend: React + Vite + TypeScript
- server: Express + TypeScript + Azure OpenAI

## 界面截图

![妈妈端 1](./image/Snipaste_2026-05-10_16-44-19.png)
![妈妈端 2](./image/Snipaste_2026-05-10_16-44-56.png)
![女儿端 3](./image/Snipaste_2026-05-10_16-45-45.png)
![女儿端 4](./image/Snipaste_2026-05-10_16-45-56.png)

## 当前功能

- 双端联动聊天: 妈妈端与女儿端通过 BroadcastChannel + localStorage 快照同步
- 妈妈端输入方式: 打字、语音转文字、上传图片/视频
- 妈妈端语音播报: 浏览器 TTS 自动播报 AI 回复
- 女儿端能力: 给妈妈发消息、查看社区志愿求助、接单与电话回拨
- AI 风险分级: none / daughter / volunteer
- 真实模式已关闭自动引导图生成: 服务端只返回文本建议，不自动生成图片

## 目录结构

```text
SideBySide/
├── README.md
├── DESIGN.md
├── DEPLOY.md
├── package.json
├── frontend/
│   ├── package.json
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── styles.css
│       ├── pages/
│       │   └── Daughter.tsx
│       └── lib/
│           ├── api.ts
│           ├── bus.ts
│           ├── mockImages.ts
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

前提:

- Node.js 20+
- npm 10+

安装依赖:

```powershell
cd C:\Users\sunmeng\Downloads\SideBySide
npm install
```

启动前端:

```powershell
npm run dev:frontend
```

启动服务端:

```powershell
npm run dev:server
```

默认地址:

- 妈妈端：http://localhost:5173/mom
- 女儿端：http://localhost:5173/daughter
- 测试端：http://localhost:5173/mom/debug

## 构建与运行

全量构建:

```powershell
npm run build
```

生产方式启动服务端:

```powershell
npm run start
```

## 环境变量

服务端在 server/.env 读取配置，核心变量如下:

```env
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_API_VERSION=2024-08-01-preview
USE_MOCK_AI=false
PORT=8787
```

说明:

- USE_MOCK_AI=true 时，服务端返回 mock 结果
- 如果缺少 Azure 配置，服务端也会自动进入 mock
- 图片会作为多模态输入进入模型
- 视频仅作为附件说明文本，不做逐帧分析

## API

- POST /api/session: 创建会话
- GET /api/session/:sessionId: 获取会话
- POST /api/chat: 发送文本和附件，返回完整会话
- GET /api/health: 健康检查

## 部署

Azure App Service 部署步骤见 DEPLOY.md。

当前线上流程是:

1. 本地 build
2. 组装 deploy.zip
3. 上传到 Kudu /home/deploy.zip
4. SSH 解压到 /home/site/wwwroot
5. 重启站点

## 已知限制

- 前端仍保留 guidanceImageUrl 渲染逻辑，主要用于 /mom/debug 演示
- 会话存储为内存 Map，服务重启会丢失
- 语音输入依赖浏览器 SpeechRecognition，部分 iOS 环境不可用
- TTS 依赖浏览器 speechSynthesis，实际音色随设备变化
