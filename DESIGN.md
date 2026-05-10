# 设计说明

## 1. 产品目标

妈宝 Side By Side 是一个适老化的双端协作演示:

- 妈妈端负责提问、拍图、上传附件、接收 AI 指导
- 女儿端负责接收同步对话、补充指导、承接求助
- 社区志愿列表用于展示升级路径

核心价值是把复杂操作拆成可执行的下一步，并在高风险场景及时升级给真人。

## 2. 用户流

### 妈妈端主流程

1. 打开 /mom
2. 输入文字或上传附件
3. 服务端调用模型返回结构化建议
4. 前端展示 AI 文本并进行语音播报
5. 如有风险，显示升级建议

### 调试演示流程

1. 打开 /mom/debug
2. 使用前端内置脚本化对白
3. 演示固定的白条场景与引导图

### 女儿端流程

1. 打开 /daughter
2. 实时查看妈妈会话同步
3. 给妈妈发送文本提示
4. 在社区志愿标签页中查看求助单、接单、拨号

## 3. 信息架构

### 路由分发

- / 或空路径: 自动 replaceState 到 /mom
- /daughter* : 渲染 DaughterApp
- 其他路径: 渲染妈妈端 App（包含 /mom 与 /mom/debug）

### 端内结构

妈妈端:

- 顶栏: 呼叫入口、标题、设置
- 消息流: 用户消息、AI 消息、升级提示
- 输入区: 语音、拍照/相册、文本发送

女儿端:

- 顶栏: 呼叫与设置
- 双标签: 我的妈妈 / 社区志愿
- 消息区: 同步会话与女儿回发
- 求助详情弹层: 接单、电话回拨

## 4. 技术架构

### 前端

- 技术栈: React 18 + Vite 5 + TypeScript
- 关键模块:
  - main.tsx: 路由分发
  - App.tsx: 妈妈端主逻辑
  - pages/Daughter.tsx: 女儿端
  - lib/api.ts: mock 与真实后端切换
  - lib/bus.ts: BroadcastChannel + localStorage 快照

### 服务端

- 技术栈: Express 4 + TypeScript + multer + openai SDK
- 关键模块:
  - server.ts: API、文件接收、静态资源托管
  - openai.ts: 多模态请求、结果规范化、降级策略
  - prompt.ts: 系统提示词
  - store.ts: 会话内存存储与序列化

### 会话与同步

- 服务端 session 存在内存 Map
- 妈妈端创建 session 后广播给其他标签页
- Daughter 端默认从 localStorage 快照恢复
- 双端同机同步使用 BroadcastChannel("mama-bao")

## 5. AI 策略

### 模式切换

- /mom/debug: 使用前端脚本化 mock
- /mom: 请求后端 /api/chat，走 Azure OpenAI

### 模型输入

- 最近对话上下文
- 当前文本
- 图片附件 data URL（最多 2 张）
- 视频附件仅作为说明文本

### 模型输出

后端期望 JSON 字段:

- answer
- speakText
- guidanceLabel
- escalation
- escalationReason
- confidence
- needsImage
- imagePrompt

注意:

- 当前版本已暂时禁用真实模式图片生成功能
- 即使模型返回 needsImage=true，也不会触发生成
- /mom/debug 的引导图由前端内置 mockImages 提供

### 升级规则

- none: 常规可继续操作
- daughter: 表述模糊、多次失败、需要家属协助
- volunteer: 资金/身份/验证码等高风险场景

## 6. 语音与可访问性

- 语音输入: Web Speech API（SpeechRecognition 或 webkitSpeechRecognition）
- 语音播报: speechSynthesis，优先中文女声并规避粤语音色
- iOS 首次播报限制通过用户手势与解锁机制处理

## 7. 部署设计

线上目标为 Azure App Service（Linux, Node 20+）。

采用稳定流程:

1. 前后端构建
2. 组装 deploy.zip（含 frontend/dist 与 server/dist）
3. 上传 Kudu /home/deploy.zip
4. SSH 解压到 /home/site/wwwroot
5. 重启站点并检查 /api/health

详细操作在 DEPLOY.md。

## 8. 已知边界

- 服务端会话为内存态，重启即清空
- 图片生成逻辑代码保留但功能禁用
- 浏览器与系统差异会影响语音输入和播报体验
- 跨设备实时同步不在当前范围（当前是同机多标签同步）
