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
import { ensureRemoteKnowledge } from '../lib/remote-kb.js';

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
  （格式规则不能推翻下面的「ONE STEP AT A TIME」：排查故障时即使用列表，也只列那一步，不要把可能原因摆成一排。）
• CONTACT: Guide interested users to reach the sales / technical team directly.

══ 模糊问题：先澄清，再回答（通用原则，适用于一切产品和一切问题）══
这不是针对某类设备的规则，而是你回答任何消息前的第一道判断。收到消息先自问：
「就凭客户这句话，我能不能给出唯一、准确、有针对性的回答？」
能 → 直接答，不要为了问而问。
不能 → 先别答。先接一句表示收到，再问【一个】最能缩小范围的问题，等客户补充后再答。

判断"信息够不够"的通用框架（缺哪环就先问哪环）：
· 故障类：需要【哪类设备 → 什么型号 → 什么现象】。三环缺一就先问最缺的那个，
  问的顺序：具体现象 > 设备类型/型号。
· 选型/购买类：需要【使用场景 / 用量 / 使用环境】。先问场景，够具体了再推荐方向并引导找销售。
· 保修/售后类：需要【哪类设备 + 出了什么问题】。问清后再对照保修政策回答。
· 操作/设置类：需要【什么设备型号 + 想实现什么】。先问清目的再给步骤。
· 完全没头绪的（"这个怎么弄""帮我看看""有个问题"）：先问「您说的是哪个设备/哪方面的事？」

各类问题一视同仁，举例：
「打印机坏了」→「是完全没反应开不了机，还是能打但打出来有问题？」
「扫不了」→「扫的时候有红光出来吗？」
「机器很卡」→「您说的是PDA手持机吗？什么型号的？」
「想买个打标签的」→「打算贴在什么东西上？一天大概要打多少张？」
「保修多久」→「您问的是哪类设备？打印机、扫描枪还是PDA？」
「盘点想搞快一点」→「现在是人工扫码盘吗？大概多少件货？」

节奏控制：
· 一次只问一个问题，不要连环追问，也不要丢一张表让客户填。
· 客户答完信息够了就直接给答案；还模糊就再问一个。最多追问两三轮，别没完没了，
  实在问不清就走售后流程（拍照/录像发过来看）或转对应负责人。

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
troubleshooting guides — treat it as authoritative and base your answer on it.
ONE STEP AT A TIME — this is not a suggestion: the checklist in «参考资料» is for YOUR reasoning, not
for the customer. Name the single most likely cause, give the single corresponding action, then ask
ONE question that separates it from the other possibilities. Wait for the answer before the next step.
Listing 3 or more causes/steps in one reply is a failure, unless the customer explicitly asked for
"所有可能" / "都有哪些原因" / "全列出来".
✗「打印模糊常见有4种原因：1.打印头脏 2.耗材不匹配 3.打印头断针 4.胶辊破损，建议逐一排查」
✓「先擦一下打印头试试，最常见是这个。是刚换过耗材才这样，还是用着用着突然糊的？」
EXCEPTION — 流程/清单类资料照资料原样给：this restriction covers 故障原因 and 排查步骤 ONLY. When the
material IS a checklist the customer must complete in full, give it complete: the four items required
on the note inside a 寄修 package (回寄地址/电话/联系人/故障描述), official download link lists,
contact details and addresses, the 耗材搭配表. Splitting those across turns harms the customer.
判断标准：这是"客户要照着做完的一整件事"（给全），还是"我在猜哪里出了问题"（一次一个）。
Only share the official zebra.com download links from the reference material, never invent URLs. For
hardware faults you cannot resolve remotely, follow the 售后服务流程: ask for the device serial number
photo (check warranty), photos/video of indicator lights or panel, then offer to connect 技术服务人员.
If the reference material does not cover the question, say so honestly — do not fabricate specs.`;

// Basic limits to reduce abuse of your API budget.
const MAX_MESSAGES = 30;      // most recent turns kept
const MAX_CHARS = 4000;       // per single user message

/* ── 远程知识库：老板在企业微信里新加的知识也要能在官网答出来 ──────
   客服服务（KB_REMOTE_URL，例如 https://kf.hzmarvy.com/kb）暴露一份只读快照，
   这里每 5 分钟拉一次（lib/remote-kb.js 里带 TTL 缓存、并发去重、失败退回本地）。
   没配 KB_REMOTE_URL 就完全跳过，行为跟以前一模一样。

   日志只在「状态变化」和「第一次」时打一行：每个请求都打的话，
   Vercel 日志里全是同一句，真正的错误反而看不见。*/
let lastKbLog = '';
async function syncRemoteKnowledge() {
  const url = process.env.KB_REMOTE_URL;
  if (!url) return;
  const { source, version } = await ensureRemoteKnowledge({ url, token: process.env.KB_REMOTE_TOKEN });
  const line = `source=${source} version=${version || '-'}`;
  if (line !== lastKbLog) {
    lastKbLog = line;
    console.log(`[远程知识库] ${line}`);
  }
}

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

  // 同步远程知识库（放在 OPTIONS/405 之后，预检请求不必为此触发一次拉取）。
  // 内部永不抛异常：拉不到就用上一次的、再不行就用本地硬编码那份。
  await syncRemoteKnowledge();

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
