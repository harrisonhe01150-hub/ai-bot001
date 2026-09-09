// tests/run.js
// 零依赖自测：node tests/run.js
// 不联网 —— 远程知识库的 fetch 全部打桩，跑测试不会真访问客服服务。
//
// 覆盖：
//   1. 拉取成功：自定义条目进检索、老板新加的电话不被防护抹掉
//   2. TTL 缓存：第二次调用不再发请求
//   3. 拉取失败：退回本地硬编码知识库，且绝不抛异常
//   4. stale-while-error：成功过一次之后再失败，继续用上一次的快照
//   5. 并发去重：同时来 N 个请求只发一次
//   6. 请求头带上 Bearer token
//   7. 内置条目远程覆盖（远程比本地新时按 id 顶掉）

import assert from 'node:assert/strict';

import {
  retrieveKnowledge, retrieveKnowledgeDetailed, getAllSections,
  setCustomSections, setBuiltinOverrides, applyRemoteKnowledge,
} from '../lib/knowledge.js';
import { sanitizeReply, setExtraContacts, getExtraContacts } from '../lib/guards.js';
import {
  ensureRemoteKnowledge, resetRemoteKnowledgeCache,
  getRemoteKnowledgeFailedAt, FAILURE_BACKOFF_MS,
} from '../lib/remote-kb.js';

/* ── 迷你测试框架 ────────────────────────────────────────── */
let passed = 0;
const failures = [];
const tests = [];
function test(name, fn) { tests.push([name, fn]); }

const realLog = console.log, realWarn = console.warn, realErr = console.error;
function quiet() { console.log = console.warn = console.error = () => {}; }
function loud() { console.log = realLog; console.warn = realWarn; console.error = realErr; }

/* ── 桩件 ────────────────────────────────────────────────── */
const URL_ = 'https://kf.example.com/kb';

// 一份典型的 /kb 快照：一条老板新加的自定义条目 + 它带出来的电话白名单
function samplePayload(over = {}) {
  return {
    version: 'v-abc123',
    generatedAt: '2026-09-09T00:00:00.000Z',
    sections: [
      {
        id: 'custom_1',
        title: '春节值班安排',
        keywords: ['值班', '春节', '放假'],
        content: '【春节值班安排】（公司补充资料）\n除夕到初三值班电话 13800001111，其余时间正常。',
        custom: true,
      },
    ],
    contacts: { phones: ['13800001111'], emails: ['boss@meihui.example'] },
    ...over,
  };
}

function okFetch(payload, calls) {
  return async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200, json: async () => payload };
  };
}

function failFetch(calls, err = new Error('ECONNREFUSED')) {
  return async (url, init) => {
    calls.push({ url, init });
    throw err;
  };
}

// 每个用例开头都把模块级状态清干净（知识库/白名单/缓存都是模块级的）
function reset() {
  resetRemoteKnowledgeCache();
  setCustomSections([]);
  setBuiltinOverrides([]);
  setExtraContacts({ phones: [], emails: [] });
}

/* ── 1. 拉取成功 ─────────────────────────────────────────── */

test('拉取成功：自定义条目进入检索，老板新加的电话不再被防护抹掉', async () => {
  reset();
  // 应用之前：关键词查不到，电话会被拦
  assert.equal(retrieveKnowledge([{ role: 'user', content: '春节值班怎么安排' }]).includes('值班电话'), false);
  assert.ok(sanitizeReply('打 13800001111').text.includes('【请直接在本对话中咨询'), '未应用前新号码必须被拦');

  const calls = [];
  const r = await ensureRemoteKnowledge({ url: URL_, token: 't', fetchFn: okFetch(samplePayload(), calls) });

  assert.deepEqual(r, { source: 'remote', version: 'v-abc123' });
  assert.equal(calls.length, 1);

  const hit = retrieveKnowledgeDetailed([{ role: 'user', content: '春节值班怎么安排' }]);
  assert.ok(hit.text.includes('13800001111'), '自定义条目的正文要能被检索到');
  const sec = hit.sections.find((s) => s.id === 'custom_1');
  assert.ok(sec, '命中的条目里要有 custom_1');
  assert.equal(sec.custom, true);

  const safe = sanitizeReply('值班电话是 13800001111，邮箱 boss@meihui.example');
  assert.ok(safe.text.includes('13800001111'), '白名单里的新号码必须原样放行');
  assert.ok(safe.text.includes('boss@meihui.example'), '新邮箱同理');
  assert.deepEqual(safe.flags, []);

  // 内置条目一条都不能丢
  assert.ok(getAllSections().some((s) => s.id === 'warranty'));
  assert.ok(retrieveKnowledge([{ role: 'user', content: '打印头保修多久' }]).includes('30 公里'));
});

test('applyRemoteKnowledge：老板删掉的条目也要从网站消失（全量替换）', async () => {
  reset();
  applyRemoteKnowledge(samplePayload());
  assert.ok(getAllSections().some((s) => s.id === 'custom_1'));

  applyRemoteKnowledge({ sections: [] });
  assert.equal(getAllSections().some((s) => s.id === 'custom_1'), false);

  // 快照结构不对（没有 sections）就当没收到，保持现状，绝不清空
  applyRemoteKnowledge(samplePayload());
  applyRemoteKnowledge({ version: 'x' });
  assert.ok(getAllSections().some((s) => s.id === 'custom_1'), '坏快照不能把已有知识清掉');
});

/* ── 2. TTL 缓存 ─────────────────────────────────────────── */

test('TTL：缓存新鲜时第二次调用一次请求都不发', async () => {
  reset();
  const calls = [];
  const fetchFn = okFetch(samplePayload(), calls);

  const a = await ensureRemoteKnowledge({ url: URL_, token: 't', fetchFn });
  const b = await ensureRemoteKnowledge({ url: URL_, token: 't', fetchFn });
  assert.equal(calls.length, 1, '第二次必须走缓存');
  assert.deepEqual(b, a);

  // ttlMs=0 → 缓存立刻过期，会再拉一次
  await ensureRemoteKnowledge({ url: URL_, token: 't', ttlMs: 0, fetchFn });
  assert.equal(calls.length, 2);
});

test('没配 KB_REMOTE_URL：直接返回 local，一次请求都不发', async () => {
  reset();
  const calls = [];
  const r = await ensureRemoteKnowledge({ url: '', token: 't', fetchFn: okFetch(samplePayload(), calls) });
  assert.deepEqual(r, { source: 'local', version: '' });
  assert.equal(calls.length, 0);
});

/* ── 3. 失败退回本地 ─────────────────────────────────────── */

test('拉取失败（网络错 / 非 2xx / 脏 JSON）：退回本地知识库，绝不抛异常', async () => {
  for (const fetchFn of [
    failFetch([]),
    async () => ({ ok: false, status: 401, json: async () => ({}) }),
    async () => ({ ok: true, status: 200, json: async () => ({ version: 'x' }) }), // 缺 sections
    async () => ({ ok: true, status: 200, json: async () => { throw new Error('bad json'); } }),
  ]) {
    reset();
    const r = await ensureRemoteKnowledge({ url: URL_, token: 't', fetchFn });
    assert.deepEqual(r, { source: 'local', version: '' });
    // 本地硬编码那份照常可用
    assert.ok(retrieveKnowledge([{ role: 'user', content: '打印头保修多久' }]).includes('30 公里'));
    // 没成功过就不该有任何自定义条目
    assert.equal(getAllSections().some((s) => String(s.id).startsWith('custom_')), false);
  }
});

test('负缓存：连着 5 次调用只打一次接口，30 秒冷却期过了才再试', async () => {
  reset();
  const calls = [];
  const fetchFn = failFetch(calls);
  let now = 1000000;
  const nowFn = () => now;

  // 客服服务挂了：5 个请求接连打进来，不能每个都去重试一次、每个都白等一个超时
  for (let i = 0; i < 5; i++) {
    const r = await ensureRemoteKnowledge({ url: URL_, token: 't', fetchFn, nowFn });
    assert.deepEqual(r, { source: 'local', version: '' }, `第 ${i + 1} 次`);
  }
  assert.equal(calls.length, 1, '冷却期内只该真的打一次接口');
  assert.equal(getRemoteKnowledgeFailedAt(), 1000000);

  // 还差 1 秒出冷却 → 仍然不发
  now += FAILURE_BACKOFF_MS - 1000;
  await ensureRemoteKnowledge({ url: URL_, token: 't', fetchFn, nowFn });
  assert.equal(calls.length, 1);

  // 31 秒后 → 再试一次
  now = 1000000 + 31000;
  await ensureRemoteKnowledge({ url: URL_, token: 't', fetchFn, nowFn });
  assert.equal(calls.length, 2, '冷却期过了必须再试');
  assert.equal(getRemoteKnowledgeFailedAt(), now, '又失败一次，冷却重新计时');
});

test('负缓存：有旧快照时冷却期内继续返回 stale，一次请求都不发', async () => {
  reset();
  const calls = [];
  let now = 5000000;
  const nowFn = () => now;

  await ensureRemoteKnowledge({ url: URL_, token: 't', fetchFn: okFetch(samplePayload(), calls), nowFn });
  assert.equal(calls.length, 1);

  // ttlMs=0 让缓存立刻过期，第一次真去拉、拉失败 → stale
  const fail = failFetch(calls);
  assert.deepEqual(
    await ensureRemoteKnowledge({ url: URL_, token: 't', ttlMs: 0, fetchFn: fail, nowFn }),
    { source: 'stale', version: 'v-abc123' },
  );
  assert.equal(calls.length, 2);

  // 冷却期内再来：还是 stale，但一次接口都不打
  for (let i = 0; i < 4; i++) {
    assert.deepEqual(
      await ensureRemoteKnowledge({ url: URL_, token: 't', ttlMs: 0, fetchFn: fail, nowFn }),
      { source: 'stale', version: 'v-abc123' },
    );
  }
  assert.equal(calls.length, 2, '冷却期内一次都不该再打');
  // 老板补的知识和白名单照常生效，客户完全无感
  assert.ok(retrieveKnowledge([{ role: 'user', content: '春节值班' }]).includes('13800001111'));
  assert.ok(sanitizeReply('打 13800001111').text.includes('13800001111'));

  now += 31000;
  await ensureRemoteKnowledge({ url: URL_, token: 't', ttlMs: 0, fetchFn: fail, nowFn });
  assert.equal(calls.length, 3);
});

test('负缓存：拉通之后冷却清零，下一次失败重新从头计时', async () => {
  reset();
  const calls = [];
  let now = 9000000;
  const nowFn = () => now;

  await ensureRemoteKnowledge({ url: URL_, token: 't', fetchFn: failFetch(calls), nowFn });
  assert.equal(getRemoteKnowledgeFailedAt(), 9000000);

  now += 31000;
  await ensureRemoteKnowledge({ url: URL_, token: 't', ttlMs: 0, fetchFn: okFetch(samplePayload(), calls), nowFn });
  assert.equal(getRemoteKnowledgeFailedAt(), 0, '通了就该把冷却清掉');
  assert.equal(calls.length, 2);

  // 通了之后再来一次成功的：TTL 还新鲜，不发请求
  await ensureRemoteKnowledge({ url: URL_, token: 't', fetchFn: okFetch(samplePayload(), calls), nowFn });
  assert.equal(calls.length, 2);
});

/* ── 4. stale-while-error ────────────────────────────────── */

test('stale-while-error：成功过一次之后再失败，继续用上一次的快照', async () => {
  reset();
  const calls = [];
  await ensureRemoteKnowledge({ url: URL_, token: 't', fetchFn: okFetch(samplePayload(), calls) });

  const r = await ensureRemoteKnowledge({ url: URL_, token: 't', ttlMs: 0, fetchFn: failFetch(calls) });
  assert.deepEqual(r, { source: 'stale', version: 'v-abc123' });

  // 知识和白名单都还在，客户问同一个问题答案不变
  assert.ok(retrieveKnowledge([{ role: 'user', content: '春节值班' }]).includes('13800001111'));
  assert.ok(sanitizeReply('打 13800001111').text.includes('13800001111'));
  assert.deepEqual(getExtraContacts().phones, ['13800001111']);
});

/* ── 5. 并发去重 ─────────────────────────────────────────── */

test('并发去重：同时来 5 个请求只发一次，且都拿到同一个结果', async () => {
  reset();
  const calls = [];
  let release;
  const gate = new Promise((r) => { release = r; });
  const fetchFn = async (url, init) => {
    calls.push({ url, init });
    await gate;
    return { ok: true, status: 200, json: async () => samplePayload() };
  };

  const all = Promise.all(Array.from({ length: 5 }, () => ensureRemoteKnowledge({ url: URL_, token: 't', fetchFn })));
  release();
  const results = await all;

  assert.equal(calls.length, 1, '5 个并发只能打一次接口');
  for (const r of results) assert.deepEqual(r, { source: 'remote', version: 'v-abc123' });

  // in-flight 释放干净：过期后还能正常再拉
  await ensureRemoteKnowledge({ url: URL_, token: 't', ttlMs: 0, fetchFn });
  assert.equal(calls.length, 2);
});

test('并发去重：这一次失败了，5 个调用都拿到 local 且不抛', async () => {
  reset();
  const calls = [];
  const results = await Promise.all(
    Array.from({ length: 5 }, () => ensureRemoteKnowledge({ url: URL_, token: 't', fetchFn: failFetch(calls) }))
  );
  assert.equal(calls.length, 1);
  for (const r of results) assert.deepEqual(r, { source: 'local', version: '' });
});

/* ── 6. 鉴权头 ───────────────────────────────────────────── */

test('请求带上 Authorization: Bearer <token>，没 token 就不带这个头', async () => {
  reset();
  const calls = [];
  await ensureRemoteKnowledge({ url: URL_, token: 'super-secret', fetchFn: okFetch(samplePayload(), calls) });
  assert.equal(calls[0].url, URL_);
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer super-secret');

  reset();
  const calls2 = [];
  await ensureRemoteKnowledge({ url: URL_, fetchFn: okFetch(samplePayload(), calls2) });
  assert.equal('Authorization' in calls2[0].init.headers, false, '没配 token 就别带空头');
});

/* ── 7. 内置条目远程覆盖 ─────────────────────────────────── */

test('setBuiltinOverrides：同 id 的内置条目以远程为准，未知 id 忽略，清空可回退', async () => {
  reset();
  const before = getAllSections().find((s) => s.id === 'warranty').content;

  const n = setBuiltinOverrides([
    { id: 'warranty', title: '保修政策', keywords: ['保修', '质保'], content: '打印头保修 9 个月（新政策）' },
    { id: '不存在的条目', title: 'x', keywords: ['x'], content: 'x' },
  ]);
  assert.equal(n, 1, '未知 id 不能凭空插进来');
  assert.equal(getAllSections().find((s) => s.id === 'warranty').content, '打印头保修 9 个月（新政策）');
  assert.ok(retrieveKnowledge([{ role: 'user', content: '保修多久' }]).includes('9 个月'));
  assert.equal(getAllSections().length, 10, '条目总数不变（是覆盖不是追加）');

  setBuiltinOverrides([]);
  assert.equal(getAllSections().find((s) => s.id === 'warranty').content, before, '清空覆盖要能回到本地版本');
});

test('applyRemoteKnowledge：一份同时含 custom 和内置的快照，两边都要生效', async () => {
  reset();
  const applied = applyRemoteKnowledge({
    version: 'v2',
    sections: [
      { id: 'custom_9', title: '新条目', keywords: ['新条目'], content: '这是老板新加的', custom: true },
      { id: 'warranty', title: '保修政策', keywords: ['保修'], content: 'PDA 保修 2 年（远程更新）', custom: false },
    ],
  });
  assert.deepEqual(applied, { custom: 1, builtin: 1 });
  assert.ok(retrieveKnowledge([{ role: 'user', content: '新条目' }]).includes('老板新加的'));
  assert.ok(retrieveKnowledge([{ role: 'user', content: '保修' }]).includes('远程更新'));
});

/* ── 跑 ──────────────────────────────────────────────────── */
for (const [name, fn] of tests) {
  quiet();
  try {
    await fn();
    loud();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    loud();
    failures.push([name, e]);
    console.log(`  ✗ ${name}`);
    console.log(`      ${e.message.split('\n').slice(0, 20).join('\n      ')}`);
  }
}

console.log(`\n${passed}/${tests.length} 通过`);
if (failures.length) process.exit(1);
