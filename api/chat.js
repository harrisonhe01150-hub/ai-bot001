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
import { sanitizeReply } from '../lib/guards.js';

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

══ 模糊问题：先澄清，再回答 ══
如果客户的问题太模糊、无法定位到唯一的答案方向（缺设备类型、缺型号、缺具体现象），
先别急着答：先问一个最关键的澄清问题（问的顺序：具体现象 > 设备类型/型号），
等客户补充后再给出针对性的回答。例：「打印机坏了」→ 先问「是完全没反应开不了机，
还是能打但打出来有问题？」。客户描述已经很具体的，直接回答，不要为了问而问。
最多追问两三轮；实在问不清就引导走售后流程（拍照/录像提供现象）。

══ ACCURACY RULES — HIGHEST PRIORITY (准确性铁律) ══
• GROUNDING: State product facts (models, specs, compatibility, warranty, operations) ONLY when they
  come from the «参考资料» block or the company overview above. Everything else = "我帮您核实一下"。
• NO GUESSING: If the answer is not in your material, say honestly "这个问题我需要为您核实，稍后由
  技术服务人员跟进" — a wrong answer is far worse than no answer.
• CONTACTS: Share ONLY the phone numbers / addresses that appear verbatim in «参考资料». Never invent
  or guess a number, email, or address. If the needed contact is not in the material, say you will
  arrange for someone to follow up in this chat.
• NO INVENTED SPECIFICS: You do NOT know prices, stock levels, delivery times, or working hours.
  NEVER state any of these — for pricing direct to sales; for working hours simply say you'll have
  the right person follow up (do not promise a response time).
• WARRANTY: Quote warranty terms only as written in «参考资料»; always verify status via serial number.
• MODELS: Only recommend/discuss models from the product list. If a customer mentions another model,
  you may troubleshoot generically but say you'll confirm model-specific details.
• LINKS: Only zebra.com links copied verbatim from «参考资料». Never construct, complete, or edit a URL.
• DIAGNOSIS: Present fault causes as "常见原因，逐一排查" — not definitive verdicts. Ask for photos
  (indicator lights, printed samples, serial number) before firm conclusions.

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
  const NO_KB_HINT = `\n\n«检索提示»\n本轮客户的问题没有命中任何内部资料条目。如果客户问的是产品、故障、售后类问题，很可能是描述太模糊——按「模糊问题：先澄清」的做法，先问一个最关键的澄清问题，等客户补充后再作答。绝不要在没有资料支撑的情况下编造任何具体事实。`;
  const kb = retrieveKnowledge(clean);
  const system = kb ? `${SYSTEM_PROMPT}\n\n«参考资料»\n${kb}` : SYSTEM_PROMPT + NO_KB_HINT;

  const payload = {
    model: MODEL,
    messages: [{ role: 'system', content: system }, ...clean],
    temperature: 0.3,   // 客服场景要稳定准确，低随机性显著降低幻觉
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
    // 输出防护：拦截编造的链接/价格/电话/邮箱
    const { text: safeReply, flags } = sanitizeReply(reply);
    if (flags.length) console.warn('[防护拦截]', flags.join(','));
    return res.status(200).json({ reply: safeReply });
  } catch (e) {
    const aborted = e && e.name === 'AbortError';
    console.error('Proxy failure', aborted ? 'timeout' : e);
    return res.status(504).json({ error: aborted ? 'Request timed out.' : 'Proxy failure.' });
  }
}
