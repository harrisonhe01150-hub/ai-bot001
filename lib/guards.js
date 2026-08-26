// src/guards.js
// 输出防护：AI 回复发给客户之前的最后一道硬闸。
// 提示词只能"劝"模型不要编造；这里是代码级拦截，模型就算犯错也到不了客户眼前。
//
// 拦四类最伤人的幻觉：
//  1. 编造/篡改链接 —— 只放行白名单域名（zebra.com），其余一律摘除
//  2. 编造价格 —— 公司政策本就禁止报价，出现价格直接替换为"联系销售"
//  3. 编造电话号码 —— 客户打过去打不通，最伤信任
//  4. 编造邮箱 —— 同上

const ALLOWED_LINK_HOSTS = ['zebra.com', 'hzmarvy.com'];

// 官方联系方式白名单 —— 只有这些号码/邮箱允许出现在回复里，其余一律拦截。
// 新增官方号码时改这里，同时记得同步 knowledge.js。
const ALLOWED_PHONES = new Set([
  '13615815336', // 技术问题 张琦
  '13757131105', // 销售微信（官网页脚同号）
  '13456828195', // 寄修收货 翟工
  '18758117499', // 退货 陈斌
]);
const ALLOWED_EMAILS = new Set([
  '3002971732@qq.com', // 官网页脚公开邮箱
]);

const RE_URL = /https?:\/\/[^\s一-鿿，。；：、""''（）()<>\[\]]+/g;
// ¥1234 / 1234元 / 1234.5万元 / 1234块（钱）/ 1234人民币
const RE_PRICE = /([¥￥]\s*\d[\d,，]*(\.\d+)?)|(\d[\d,，]*(\.\d+)?\s*(万?元|块钱?|人民币))/g;
// 手机号 1xx-xxxx-xxxx、座机 0xx-xxxxxxxx、400/800 热线
const RE_PHONE = /(?<!\d)(1[3-9]\d[\s-]?\d{4}[\s-]?\d{4}|0\d{2,3}[\s-]?\d{7,8}|[48]00[\s-]?\d{3}[\s-]?\d{4})(?!\d)/g;
const RE_EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function hostAllowed(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return ALLOWED_LINK_HOSTS.some((h) => host === h || host.endsWith('.' + h));
  } catch {
    return false;
  }
}

/**
 * 过滤 AI 回复。返回 { text, flags }，flags 非空表示拦到了内容（记日志用）。
 */
export function sanitizeReply(raw) {
  let text = String(raw || '');
  const flags = [];

  // 1. 链接白名单
  text = text.replace(RE_URL, (url) => {
    if (hostAllowed(url)) return url;
    flags.push('blocked-url');
    return '【链接已省略，可联系我们获取】';
  });

  // 2. 价格（用替换前后对比判断，避免全局正则 lastIndex 跨调用漏检）
  let before = text;
  text = text.replace(RE_PRICE, '（具体价格请联系销售团队获取专属报价）');
  if (text !== before) flags.push('blocked-price');

  // 3. 电话 —— 官方号码放行，其余拦截
  text = text.replace(RE_PHONE, (m) => {
    if (ALLOWED_PHONES.has(m.replace(/[\s-]/g, ''))) return m;
    flags.push('blocked-phone');
    return '【请直接在本对话中咨询，我们安排专人对接】';
  });

  // 4. 邮箱 —— 官方邮箱放行，其余拦截
  text = text.replace(RE_EMAIL, (m) => {
    if (ALLOWED_EMAILS.has(m.toLowerCase())) return m;
    flags.push('blocked-email');
    return '【请直接在本对话中咨询】';
  });

  return { text: text.trim(), flags };
}
