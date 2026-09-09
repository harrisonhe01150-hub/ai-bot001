// lib/remote-kb.js
// 从微信客服服务拉取知识库快照（GET /kb），应用到本地检索与输出防护里。
//
// 为什么需要：老板在企业微信里口述新增的知识只落在客服服务那边的
// data/knowledge-custom.json。网站是另一套部署（Vercel），代码里那份是硬编码的，
// 不接这一步，官网客服永远答不出老板刚补的内容。
//
// 三条设计原则（serverless 环境下尤其重要）：
//   1. 绝不抛异常 —— 知识库拉不到最多是"少知道点新东西"，不能让整个 /api/chat 挂掉。
//   2. 拉失败就用上一次的（stale-while-error），一次都没成功过就用本地硬编码那份。
//   3. 同一时刻只发一个请求 —— 并发请求共享同一个 in-flight promise，
//      否则冷启动瞬间来 20 个请求就会打出 20 次拉取。
//
// 缓存是模块级的：Vercel 一个热实例里跨请求复用，实例回收就重来（正常，重来也就多拉一次）。

import { applyRemoteKnowledge } from './knowledge.js';
import { setExtraContacts } from './guards.js';

/** 失败之后的冷却期：这段时间内不再重试，直接用手头有什么算什么 */
export const FAILURE_BACKOFF_MS = 30000;

/** @type {{payload:object, fetchedAt:number, version:string}|null} */
let cache = null;
/** @type {Promise<object>|null} 正在飞的那次请求，用于并发去重 */
let inflight = null;
/** 上一次失败的时刻（0 = 没失败过）。负缓存靠它挡住高频重试。 */
let failedAt = 0;

/** 测试用：把模块级状态清干净 */
export function resetRemoteKnowledgeCache() {
  cache = null;
  inflight = null;
  failedAt = 0;
}

/** 测试/诊断用：看一眼当前缓存，不触发任何请求 */
export function getRemoteKnowledgeCache() {
  return cache ? { version: cache.version, fetchedAt: cache.fetchedAt } : null;
}

/** 测试/诊断用：上一次失败的时刻（0 = 没失败过） */
export function getRemoteKnowledgeFailedAt() {
  return failedAt;
}

function applyPayload(payload) {
  applyRemoteKnowledge(payload);
  const contacts = payload?.contacts || {};
  setExtraContacts({
    phones: Array.isArray(contacts.phones) ? contacts.phones : [],
    emails: Array.isArray(contacts.emails) ? contacts.emails : [],
  });
}

async function fetchOnce({ url, token, timeoutMs, fetchFn }) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  // AbortSignal.timeout 在 Node 18+ / Vercel 运行时都有；万一没有就不设超时，
  // 也比因为取不到这个 API 直接抛异常强。
  const signal = typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(timeoutMs) : undefined;

  const res = await fetchFn(url, { method: 'GET', headers, signal });
  if (!res || !res.ok) throw new Error(`知识库接口返回 ${res ? res.status : '空响应'}`);

  const payload = await res.json();
  if (!payload || !Array.isArray(payload.sections)) throw new Error('知识库快照结构不对');
  return payload;
}

/**
 * 确保本地知识库是新的。每次处理请求前调一下即可，命中缓存时几乎零开销。
 *
 * 失败之后有 30 秒负缓存：客服服务挂了的时候，网站每来一个请求就重试一次，
 * 等于把对方按在地上打，自己每个请求还要白等一个超时。冷却期内直接返回，
 * 一次网络都不发。
 *
 * @param {{url?:string, token?:string, ttlMs?:number, timeoutMs?:number,
 *          fetchFn?:Function, nowFn?:Function}} opts nowFn 只为单测注入
 * @returns {Promise<{source:'remote'|'stale'|'local', version:string}>}
 *   remote = 这次拉到了新的（或缓存还新鲜，直接用）
 *   stale  = 这次拉失败（或还在失败冷却期里），沿用上一次成功的快照
 *   local  = 从没成功过 / 没配 url，用代码里硬编码的那份
 */
export async function ensureRemoteKnowledge({
  url,
  token,
  ttlMs = 300000,
  timeoutMs = 2500,
  fetchFn = fetch,
  nowFn = Date.now,
} = {}) {
  if (!url) return { source: 'local', version: '' };

  // 缓存还新鲜：直接用，连 promise 都不新建
  if (cache && nowFn() - cache.fetchedAt < ttlMs) {
    return { source: 'remote', version: cache.version };
  }

  // 刚失败过：冷却期内一次请求都不发。
  // 成功过的还能拿旧快照顶着（stale），一次都没成功过就只能用本地硬编码那份。
  if (failedAt && nowFn() - failedAt < FAILURE_BACKOFF_MS) {
    if (cache) {
      applyPayload(cache.payload);
      return { source: 'stale', version: cache.version };
    }
    return { source: 'local', version: '' };
  }

  // 已经有人在拉了：搭同一班车，别再发一次请求
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const payload = await fetchOnce({ url, token, timeoutMs, fetchFn });
      applyPayload(payload);
      cache = { payload, fetchedAt: nowFn(), version: String(payload.version || '') };
      failedAt = 0; // 通了就把冷却清掉
      return { source: 'remote', version: cache.version };
    } catch (e) {
      // 失败不抛：有旧快照就继续用旧的，没有就用本地硬编码那份。
      // 注意这里不动 cache.fetchedAt —— 冷却期一过还会再试，不会被 TTL 永久挡住。
      console.warn('[远程知识库] 拉取失败，沿用现有知识库：', e && e.message ? e.message : e);
      failedAt = nowFn();
      if (cache) {
        applyPayload(cache.payload); // 保险：万一别处清过状态
        return { source: 'stale', version: cache.version };
      }
      return { source: 'local', version: '' };
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
