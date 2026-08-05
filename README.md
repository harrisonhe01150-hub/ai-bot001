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
├─ index.html        # Full-screen chat page
├─ demo.html         # Marketing landing page with floating chat widget
├─ vercel.json       # Vercel config (clean URLs, function timeout)
├─ package.json
├─ .env.example      # Template for the required env var
└─ .gitignore
```

## Deploy to Vercel

1. Push this folder to GitHub.
2. In Vercel, **Add New → Project** and import the repo.
3. Under **Settings → Environment Variables**, add:
   - `DEEPSEEK_API_KEY` = your new key
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
