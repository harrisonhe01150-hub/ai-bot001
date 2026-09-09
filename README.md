# 美辉科技 AI 客服 · ai-bot001

Bilingual (中文 / English) AI customer-service chatbot for 美辉科技有限公司
(Meihui Technology Co., Ltd.), covering barcode systems, RFID, and wireless
solutions. Powered by DeepSeek through a **secure backend proxy** — no API key
is ever exposed to the browser.

## ⚠️ Read this first — rotate the old key

The previous version of this project hard-coded a DeepSeek API key
(`sk-d71be64a...`) directly in the front-end of a **public** repo. That key is
compromised. Before anything else:

1. Log in to the DeepSeek console and **delete / revoke** that key.
2. Create a **new** key.
3. Set the new key as the `DEEPSEEK_API_KEY` environment variable (see below).

Deleting the key from the code is not enough — it still lives in git history and
has been publicly readable, so it must be revoked at the source.

## What changed

- The API key moved out of `index.html` / `demo.html` and into a server-side
  environment variable, read only by `api/chat.js`.
- The browser now calls `POST /api/chat` instead of DeepSeek directly.
- The system prompt lives on the server (one source of truth, un-tamperable).
- The proxy sanitizes input, caps message count / length, hides upstream error
  detail, and times out after 30s.

## Project structure

```
ai-bot001/
├─ api/
│  └─ chat.js        # Vercel serverless function — holds the key, proxies DeepSeek
├─ lib/
│  ├─ knowledge.js   # 产品知识库 + 关键词检索（meihui-wecom-kf 的副本 + 远程快照接入）
│  ├─ guards.js      # 输出防护：拦编造的链接/价格/电话/邮箱（meihui-wecom-kf 的副本）
│  └─ remote-kb.js   # 拉取客服服务的 /kb 快照（TTL 缓存 + 失败退回本地）
├─ tests/
│  └─ run.js         # 零依赖自测：node tests/run.js
├─ index.html        # Full-screen chat page
├─ demo.html         # Marketing landing page with floating chat widget
├─ vercel.json       # Vercel config (clean URLs, function timeout)
├─ package.json
├─ .env.example      # Template for the required env vars
└─ .gitignore
```

## 远程知识库：老板新加的知识自动同步到官网

老板在企业微信里口述新增的知识（`meihui-wecom-kf` 服务的管理员通道）只落在**那台服务器**的
`data/knowledge-custom.json` 里。官网是另一套部署，本来只能用 `lib/knowledge.js` 里硬编码的那份。

现在官网每 5 分钟去客服服务拉一次只读快照：

```
GET https://kf.hzmarvy.com/kb        Authorization: Bearer <KB_REMOTE_TOKEN>
```

- 自定义条目（`custom: true`）全量替换本地的自定义条目 —— 老板删掉的也会跟着消失。
- 快照里的**内置**条目按 id 覆盖本地同名条目，这样客服服务先发版、官网还没发版时，
  官网也能立刻用上新版正文（id 对不上的一律忽略，不会凭空多出条目）。
- 快照里的 `contacts` 是老板新条目里自动抽出来的电话/邮箱白名单，必须一并应用，
  否则新号码会被 `lib/guards.js` 当成模型编造的内容抹掉。
- 拉失败**不影响回答**：有上一次的快照就继续用（stale），一次都没成功过就用本地硬编码那份。
  超时 2.5 秒，永不抛异常。并发请求共享同一次拉取。
- 只在「状态变化」或首次加载时打一行 `[远程知识库] source=… version=…`，不做逐请求日志。

不配 `KB_REMOTE_URL` 就完全跳过这一步，行为与接入前一模一样。

实现见 `lib/remote-kb.js`；服务端接口见 `meihui-wecom-kf/src/kb-endpoint.js`。

## 自测

```bash
npm test          # node tests/run.js —— 不联网，fetch 全部打桩
```

## Deploy to Vercel

1. Push this folder to GitHub.
2. In Vercel, **Add New → Project** and import the repo.
3. Under **Settings → Environment Variables**, add:
   - `DEEPSEEK_API_KEY` = your new key
   - `KB_REMOTE_URL` = `https://kf.hzmarvy.com/kb`（可选。设了官网才会同步老板
     在企业微信里新加的知识；不设就只用代码里硬编码的那份）
   - `KB_REMOTE_TOKEN` = 与客服服务 `.env` 里的 `KB_SHARED_TOKEN` **完全相同**的那个串
     （客服服务那边留空的话 `/kb` 会返回 404，两边要一起配）
4. Deploy. Your pages will be live at:
   - `https://<your-project>.vercel.app/`         → `index.html`
   - `https://<your-project>.vercel.app/demo`     → `demo.html`
   - `https://<your-project>.vercel.app/api/chat` → the proxy endpoint

The front-end calls `/api/chat` as a relative path, so it works automatically on
whatever domain you deploy to — no code change needed.

## Run locally

```bash
npm i -g vercel
cp .env.example .env      # then edit .env and paste your new key
vercel dev                # serves the pages + the /api/chat function
```

Open http://localhost:3000 (index) or http://localhost:3000/demo.

> A plain static server (e.g. `python -m http.server`) will serve the HTML but
> **not** the `/api/chat` function, so the chat will fail. Use `vercel dev`.

## Hosting somewhere other than Vercel

`api/chat.js` is a standard `(req, res)` handler. The same logic ports easily to
a Cloudflare Worker, Netlify Function, or a small Express/Node server — keep the
key in an environment variable and expose a `POST /api/chat` route.

---

© 2025 美辉科技有限公司 · Meihui Technology Co., Ltd.
