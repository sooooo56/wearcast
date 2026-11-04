// 이 파일이 하는 일: AI 이유 문장 흐름(서버 /api/explain + 클라이언트 대체 로직)을 네트워크 없이 검사한다. 실행: npm test

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import handler, { resetRateLimit } from '../api/explain.js';
import { validateReason } from '../src/logic/reasonCheck.js';
import { buildExplainPayload, explainCacheKey, requestAiReason, getReason, templateReason } from '../src/logic/explain.js';
import { summarize } from '../src/logic/summarize.js';
import { recommendOutfit } from '../src/logic/outfit.js';
import { recommendChecklist } from '../src/logic/checklist.js';
import { makeDemoWeather } from '../src/data/demoWeather.js';

function samplePayload(key = 'chilly-windy') {
  const demo = makeDemoWeather(key);
  const s = summarize(demo.forecast, demo.air);
  const rec = recommendOutfit(s);
  return { rec, payload: buildExplainPayload(rec, s, recommendChecklist(s, rec)) };
}

// Vercel의 req/res 흉내
async function call(body, { method = 'POST', env = {}, ip = '1.1.1.1' } = {}) {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k];
  const res = {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    setHeader() {},
    json(o) { this.body = o; return this; },
  };
  try {
    await handler({ method, headers: { 'x-forwarded-for': ip }, body: typeof body === 'string' ? body : JSON.stringify(body) }, res);
  } finally {
    process.env = saved;
  }
  return res;
}

beforeEach(() => resetRateLimit());

// ---- 서버 ----
test('서버: POST가 아니면 405, 잘못된 JSON/형식이면 400', async () => {
  assert.equal((await call({}, { method: 'GET' })).statusCode, 405);
  assert.equal((await call('{broken')).statusCode, 400);
  assert.equal((await call({ outfit: { outer: 'rocket' }, checklist: [], facts: {} })).statusCode, 400);
});

test('서버: 키가 없으면 LLM을 부르지 않고 503', async () => {
  const { payload } = samplePayload();
  const res = await call(payload, { env: { LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: undefined, LLM_MODEL: 'claude-opus-5-5' } });
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error, 'llm_not_configured');
});

test('서버: 모델 이름이 없으면 503 (코드에 기본 모델을 넣지 않음)', async () => {
  const { payload } = samplePayload();
  const res = await call(payload, { env: { LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'test', LLM_MODEL: undefined } });
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error, 'llm_model_not_configured');
});

test('서버: mock 제공자로 흐름 확인 -> 200, 검증 통과한 문장', async () => {
  const { payload } = samplePayload();
  const res = await call(payload, { env: { LLM_PROVIDER: 'mock' } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.source, 'ai');
  assert.ok(validateReason(res.body.reason, payload.facts).ok);
});

test('서버: 같은 IP에서 10분에 20회 넘게 부르면 429', async () => {
  const { payload } = samplePayload();
  for (let i = 0; i < 20; i += 1) assert.equal((await call(payload, { env: { LLM_PROVIDER: 'mock' } })).statusCode, 200);
  assert.equal((await call(payload, { env: { LLM_PROVIDER: 'mock' } })).statusCode, 429);
  assert.equal((await call(payload, { env: { LLM_PROVIDER: 'mock' }, ip: '2.2.2.2' })).statusCode, 200);
});

test('검증: 입력에 없는 숫자, 300자 초과, 한글 없는 문장은 거부', () => {
  const { payload } = samplePayload();
  const f = payload.facts;
  assert.ok(validateReason(`오늘은 체감온도가 ${Math.round(f.feelsMin)}~${Math.round(f.feelsMax)}°예요.`, f).ok);
  assert.equal(validateReason('오늘은 체감온도가 37°로 무더워요.', f).ok, false);
  assert.equal(validateReason('가'.repeat(301), f).ok, false);
  assert.equal(validateReason('It is cold today, wear a coat.', f).ok, false);
  // 규칙 기반 문장도 같은 검사를 통과해야 한다
  assert.ok(validateReason(templateReason(samplePayload().rec), f).ok);
});

// ---- 클라이언트 ----
function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
}
const okFetch = (reason) => async () => ({ ok: true, json: async () => ({ reason, source: 'ai' }) });

test('클라이언트: AI 성공 -> 캐시에 저장, 다음엔 바로 AI 문장 (재요청 없음)', async () => {
  const { rec, payload } = samplePayload();
  const storage = memoryStorage();
  const key = explainCacheKey('r1', '2026-11-05', payload);
  const text = `오늘은 체감온도가 ${Math.round(payload.facts.feelsMin)}~${Math.round(payload.facts.feelsMax)}°라 바람막이가 좋아요.`;
  const ai = await requestAiReason(payload, key, { fetchImpl: okFetch(text), storage });
  assert.equal(ai.source, 'ai');
  const again = getReason(rec, { cacheKey: key, storage });
  assert.equal(again.source, 'ai');
  assert.equal(again.text, text);
  assert.equal(again.pending, false);
});

test('클라이언트: 서버 오류/틀린 키(502)/검증 실패 -> null (규칙 기반 문장 유지)', async () => {
  const { rec, payload } = samplePayload();
  const storage = memoryStorage();
  const fail = async () => ({ ok: false, status: 502, json: async () => ({ error: 'llm_auth_failed' }) });
  assert.equal(await requestAiReason(payload, 'k-fail', { fetchImpl: fail, storage }), null);
  assert.equal(await requestAiReason(payload, 'k-num', { fetchImpl: okFetch('오늘은 체감 99°예요. 반팔이 좋아요.'), storage }), null);
  assert.equal(await requestAiReason(payload, 'k-net', { fetchImpl: async () => { throw new TypeError('offline'); }, storage }), null);
  // 실패한 조합은 잠시 다시 묻지 않고, 규칙 기반 문장을 준다
  const r = getReason(rec, { cacheKey: 'k-fail', storage });
  assert.equal(r.source, 'template');
  assert.equal(r.pending, false);
});

test('클라이언트: 응답이 늦으면 제한 시간 후 null', async () => {
  const { payload } = samplePayload();
  const hang = (_url, opts) => new Promise((_, rej) => opts.signal.addEventListener('abort', () => rej(opts.signal.reason)));
  const t0 = Date.now();
  assert.equal(await requestAiReason(payload, 'k-slow', { fetchImpl: hang, storage: memoryStorage(), timeoutMs: 100 }), null);
  assert.ok(Date.now() - t0 < 1000);
});

test('클라이언트: 캐시 키는 지역/날짜/시간대/수치가 같을 때만 같다', () => {
  const { payload } = samplePayload();
  const k = explainCacheKey('r1', '2026-11-05', payload);
  assert.equal(k, explainCacheKey('r1', '2026-11-05', structuredClone(payload)));
  assert.notEqual(k, explainCacheKey('r2', '2026-11-05', payload));
  assert.notEqual(k, explainCacheKey('r1', '2026-11-06', payload));
  const evening = structuredClone(payload);
  evening.facts.startHour = 18;
  assert.notEqual(k, explainCacheKey('r1', '2026-11-05', evening));
});
