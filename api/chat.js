// api/chat.js — Vercel Serverless Function (Node.js runtime)
//
// This is the secure backend proxy for the Meihui AI chatbot.
// The DeepSeek API key lives ONLY here, as an environment variable, and is
// never sent to the browser. The front-end talks to this endpoint instead of
// calling DeepSeek directly.
//
// Set the key in Vercel:  Project → Settings → Environment Variables
//   DEEPSEEK_API_KEY = sk-...your-NEW-rotated-key...

import { retrieveKnowledge } from '../lib/knowledge.js';

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const MODEL = 'deepseek-chat';

// The system prompt lives on the server so it can't be seen or tampered with
// from the browser, and so both pages share one source of truth.
const SYSTEM_PROMPT = `You are 美辉客服助手 (Meihui AI Customer Service Assistant), the official bilingual AI assistant for 美辉科技有限公司 (Meihui Technology Co., Ltd.).

══ COMPANY OVERVIEW ══
美辉科技有限公司 is a professional technology company specialising in three core solution areas:

1. 条码系统集成 (Barcode System Integration)
   - Handheld barcode scanners (手持式条码扫描枪) — brands: Zebra (DS4608 2D, LI2208 1D), Honeywell; wireless guns; fixed-mount scanners (232/485/Ethernet)
   - Barcode label printers (条码打印机) — brands: Zebra (ZT211, ZT510, Xi4 industrial; ZD888T desktop; ZC100/ZC300 card printers), Honeywell, TSC
   - Label & ribbon consumables (标签/碳带耗材), barcode label design and management systems
   - POS integration, inventory management system integration
   - System installation, configuration, training, and after-sales support

2. RFID智能方案设计 (RFID Intelligent Solution Design)
   - UHF / HF / NFC RFID system design and deployment
   - Warehouse inventory management (仓储盘点), asset tracking (资产追踪)
   - Supply chain visibility (供应链可视化) and production line tracking
   - Retail loss prevention and smart shelf solutions
   - Access control (门禁) and personnel management
   - Full project scope: consultation → hardware supply → software integration → go-live support

3. 无线应用系统 (Wireless Application Systems)
   - Industrial-grade WiFi network planning and deployment
   - Wireless handheld terminals (无线手持终端) and mobile data collection
   - Warehouse mobile WMS (仓库管理系统) applications
   - Enterprise wireless network infrastructure consulting

══ INDUSTRIES SERVED ══
物流仓储 (Logistics & Warehousing) | 制造业 (Manufacturing) | 零售 (Retail) | 医疗 (Healthcare) | 政府 (Government) | 教育 (Education) | 餐饮 (Food & Beverage)

══ YOUR BEHAVIOUR RULES ══
• LANGUAGE: Detect and match the user's language exactly. Chinese → respond in Chinese. English → respond in English. Mixed → use the dominant language.
• TONE: Professional, warm, solution-focused, concise. Like a knowledgeable senior sales engineer.
• PRICING: Never state specific prices. Say: "请联系我们的销售团队获取专属报价 (Please contact our sales team for a customised quotation)."
• CONSULTATION: Proactively offer a free technical consultation (免费技术咨询) for complex requirements.
• UNKNOWN INFO: If unsure, say so honestly and offer to connect them with the right expert.
• FORMAT: Use bullet points for lists. Keep responses focused — ideally under 200 words per reply unless detail is required.
• CONTACT: Guide interested users to reach the sales / technical team directly.

══ KNOWLEDGE BASE (参考资料) ══
When a «参考资料» block is appended below, it contains Meihui's internal product knowledge and
troubleshooting guides — treat it as authoritative and base your answer on it. For troubleshooting,
walk the customer through ONE most-likely diagnostic step at a time rather than dumping the whole
checklist. Only share the official zebra.com download links from the reference material, never invent
URLs. For hardware faults you cannot resolve remotely, follow the 售后服务流程: ask for the device
serial number photo (check warranty), photos/video of indicator lights or panel, then offer to
connect 技术服务人员. If the reference material does not cover the question, say so honestly — do
not fabricate specs.`;

// Basic limits to reduce abuse of your API budget.
const MAX_MESSAGES = 30;      // most recent turns kept
const MAX_CHARS = 4000;       // per single user message

export default async function handler(req, res) {
  // --- CORS (same-origin by default; adjust ALLOW_ORIGIN if you embed cross-domain) ---
  const allowOrigin = process.env.ALLOW_ORIGIN || '';
  if (allowOrigin) res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error('DEEPSEEK_API_KEY is not set');
    return res.status(500).json({ error: 'Server not configured.' });
  }

  // --- Parse & validate body ---
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON.' }); }
  }
  let messages = Array.isArray(body?.messages) ? body.messages : null;
  if (!messages || messages.length === 0) {
    return res.status(400).json({ error: 'Missing "messages".' });
  }

  // Sanitize: only keep user/assistant turns, drop any client-supplied system
  // prompt, cap length, and trim over-long content.
  const clean = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));

  // Retrieve relevant product-knowledge sections for the current question
  const kb = retrieveKnowledge(clean);
  const system = kb ? `${SYSTEM_PROMPT}\n\n«参考资料»\n${kb}` : SYSTEM_PROMPT;

  const payload = {
    model: MODEL,
    messages: [{ role: 'system', content: system }, ...clean],
    temperature: 0.72,
    max_tokens: 900,
    stream: false,
  };

  // --- Call DeepSeek ---
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const upstream = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      console.error('DeepSeek error', upstream.status, errText);
      // Do not leak upstream error details to the client.
      return res.status(502).json({ error: 'Upstream AI service error.' });
    }

    const data = await upstream.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() || '';
    return res.status(200).json({ reply });
  } catch (e) {
    const aborted = e && e.name === 'AbortError';
    console.error('Proxy failure', aborted ? 'timeout' : e);
    return res.status(504).json({ error: aborted ? 'Request timed out.' : 'Proxy failure.' });
  }
}
