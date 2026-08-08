// src/guards.js
// 输出防护：AI 回复发给客户之前的最后一道硬闸。
// 提示词只能"劝"模型不要编造；这里是代码级拦截，模型就算犯错也到不了客户眼前。
//
// 拦四类最伤人的幻觉：
//  1. 编造/篡改链接 —— 只放行白名单域名（zebra.com），其余一律摘除
//  2. 编造价格 —— 公司政策本就禁止报价，出现价格直接替换为"联系销售"
//  3. 编造电话号码 —— 客户打过去打不通，最伤信任
//  4. 编造邮箱 —— 同上

const ALLOWED_LINK_HOSTS = ['zebra.com'];

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

  // 3. 电话
  before = text;
  text = text.replace(RE_PHONE, '【请直接在本对话中咨询，我们安排专人对接】');
  if (text !== before) flags.push('blocked-phone');

  // 4. 邮箱
  before = text;
  text = text.replace(RE_EMAIL, '【请直接在本对话中咨询】');
  if (text !== before) flags.push('blocked-email');

  return { text: text.trim(), flags };
}
