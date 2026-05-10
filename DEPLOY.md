# 部署到 Azure App Service

当前版本采用 `frontend + server` 两包结构，目标 App Service：

- 资源组：`sidebyside-rg`
- 站点：`sidebyside-app`（Linux，Node 20+）
- 站点地址：https://sidebyside-app.azurewebsites.net

实际跑通的部署流程是「打 zip → 上传到 /home → SSH 解压到 wwwroot → 重启」。
`az webapp deploy` 走 OneDeploy 经常 502/504，这条路径稳定可控。

## 一、必要环境变量

App Service → Configuration 设置：

```text
AZURE_OPENAI_ENDPOINT
AZURE_OPENAI_API_KEY
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_API_VERSION=2024-08-01-preview
USE_MOCK_AI=false
WEBSITES_PORT=8787
SCM_DO_BUILD_DURING_DEPLOYMENT=false
```

启动命令（Configuration → General settings → Startup Command）：

```text
node server/dist/server.js
```

一次性 CLI 设置（PowerShell）：

```powershell
az webapp config appsettings set -g sidebyside-rg -n sidebyside-app --settings `
  AZURE_OPENAI_ENDPOINT="https://<your>.openai.azure.com/" `
  AZURE_OPENAI_API_KEY="<key>" `
  AZURE_OPENAI_DEPLOYMENT="gpt-4o-mini" `
  AZURE_OPENAI_API_VERSION="2024-08-01-preview" `
  USE_MOCK_AI="false" `
  WEBSITES_PORT="8787" `
  SCM_DO_BUILD_DURING_DEPLOYMENT="false"

az webapp config set -g sidebyside-rg -n sidebyside-app `
  --startup-file "node server/dist/server.js"
```

## 二、本地构建

```powershell
cd C:\Users\sunmeng\Downloads\SideBySide
npm install
npm run build
```

产物：`frontend/dist`、`server/dist`。

## 三、打 deploy.zip

```powershell
cd C:\Users\sunmeng\Downloads\SideBySide
if (Test-Path .\.deploy) { Remove-Item .\.deploy -Recurse -Force }
if (Test-Path .\deploy.zip) { Remove-Item .\deploy.zip -Force }
New-Item -ItemType Directory -Path .\.deploy\server | Out-Null
New-Item -ItemType Directory -Path .\.deploy\frontend | Out-Null

Copy-Item -Recurse .\server\dist .\.deploy\server\dist
Copy-Item .\server\package.json .\.deploy\server\package.json
Push-Location .\.deploy\server
npm install --omit=dev --no-audit --no-fund --silent
Pop-Location

Copy-Item -Recurse .\frontend\dist .\.deploy\frontend\dist

@'
{
  "name": "sidebyside-runtime",
  "version": "0.1.0",
  "private": true,
  "scripts": { "start": "node server/dist/server.js" },
  "engines": { "node": ">=20" }
}
'@ | Set-Content -Encoding UTF8 .\.deploy\package.json

Compress-Archive -Path .\.deploy\* -DestinationPath .\deploy.zip -Force
```

zip 内部结构：

```text
package.json
server/package.json
server/dist/**
server/node_modules/**
frontend/dist/**
```

## 四、上传 zip 到 /home

```powershell
$cred = az webapp deployment list-publishing-credentials `
  -g sidebyside-rg -n sidebyside-app `
  --query "{u:publishingUserName,p:publishingPassword}" -o json | ConvertFrom-Json

curl.exe -u "$($cred.u):$($cred.p)" -H "If-Match: *" `
  -X PUT --data-binary "@deploy.zip" `
  "https://sidebyside-app.scm.azurewebsites.net/api/vfs/home/deploy.zip"
```

返回 `201 Created` 即文件已落到 `/home/deploy.zip`。

## 五、SSH 解压到 wwwroot

Azure Portal → App Service → Development Tools → SSH，进容器执行：

```bash
cd /home/site/wwwroot
rm -rf ./* ./.[!.]* 2>/dev/null
unzip -o ~/home/deploy.zip

ls                    # 期望: package.json  frontend  server
ls server/dist        # 期望: server.js openai.js store.js ...
ls frontend/dist      # 期望: index.html  assets/
```

目录结构对了再走下一步。

## 六、重启站点

```powershell
az webapp restart -g sidebyside-rg -n sidebyside-app
```

或在 Portal 里点 Restart。

## 七、验证

```powershell
curl.exe https://sidebyside-app.azurewebsites.net/api/health
# 预期: {"ok":true,"ts":...}
```

浏览器打开：

- 妈妈端：https://sidebyside-app.azurewebsites.net/mom
- 女儿端：https://sidebyside-app.azurewebsites.net/daughter

根路径 `/` 会自动跳转到 `/mom`。两端会通过 `BroadcastChannel('mama-bao')` + `localStorage` 在同一台设备上的两个浏览器标签页之间实时同步对话。

## 排错速查

- `az webapp deploy` 报 502/504：直接走「四 + 五」。
- `/api/health` 200 但首页 404：确认 `frontend/dist/index.html` 已在 wwwroot 中。
- `/daughter` 路由 404：检查启动命令仍是 `node server/dist/server.js`，并确认 `server.ts` 中的 `app.get('*', …)` SPA 兜底未被改动；也确认前端构建产物已上传到 `frontend/dist`。
- 启动失败：`az webapp log tail -g sidebyside-rg -n sidebyside-app`，核对 `WEBSITES_PORT=8787` 与启动命令。
- 演示模式：`USE_MOCK_AI=true` 即可，无需改代码。

## 一键全流程速记（妈妈端 + 女儿端）

```powershell
# 1. 构建
cd C:\Users\sunmeng\Downloads\SideBySide
npm install
npm run build

# 2. 打包 deploy.zip（同上「三」）

# 3. 上传到 /home
$cred = az webapp deployment list-publishing-credentials `
  -g sidebyside-rg -n sidebyside-app `
  --query "{u:publishingUserName,p:publishingPassword}" -o json | ConvertFrom-Json
curl.exe -u "$($cred.u):$($cred.p)" -H "If-Match: *" `
  -X PUT --data-binary "@deploy.zip" `
  "https://sidebyside-app.scm.azurewebsites.net/api/vfs/home/deploy.zip"
# 期望 HTTP 201（首次）或 204（覆盖）
```

```bash
# 4. SSH 进容器执行
cd /home/site/wwwroot
rm -rf ./* ./.[!.]* 2>/dev/null
unzip -o ~/home/deploy.zip
ls && ls server/dist && ls frontend/dist
```

```powershell
# 5. 重启
az webapp restart -g sidebyside-rg -n sidebyside-app
```
