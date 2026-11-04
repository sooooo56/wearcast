// 이 파일이 하는 일: 추천 이유 문장을 만든다.
// 1) templateReason: 규칙 기반 문장 (항상 바로 만들 수 있음)
// 2) requestAiReason: /api/explain(LLM)에 요청. 실패/시간 초과(8초)/검증 실패면 null -> 화면은 규칙 기반 문장 유지
// 화면에는 "AI 설명" / "규칙 기반 설명" 라벨로 어느 쪽인지 구분한다. 문장은 입력 수치(facts)에 있는 사실만 쓴다.

import { itemInfo } from '../data/items.js';
import { DAY_PERIODS, TEMP_CHANGE_NOTICE_C } from './thresholds.js';
import { validateReason } from './reasonCheck.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const deg = (v) => `${Math.round(v)}°`;
const one = (v) => String(Math.round(v * 10) / 10);

const periodOf = (hour) => DAY_PERIODS.find((p) => hour < p.until)?.label ?? null;

// 받침 유무로 조사 고르기: 을/를, 이/가, 과/와
function josa(word, withBatchim, without) {
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return word + without; // 한글이 아니면 받침 없음 취급
  return word + ((last - 0xac00) % 28 ? withBatchim : without);
}

const label = (slot, id) => itemInfo(slot, id)?.label ?? id;

// 기준 문구: "오늘 08~19시" / "내일 08~19시"
export function basisLabel(facts) {
  const pad = (h) => String(h).padStart(2, '0');
  return `${facts.isTomorrow ? '내일' : '오늘'} ${pad(facts.startHour)}~${pad(facts.endHour)}시`;
}

/**
 * 규칙 기반 이유 문장 (2~3문장, 존댓말)
 * @param {{outfit, adjustments, facts}} rec  recommendOutfit() 결과
 */
export function templateReason(rec) {
  const { outfit, adjustments, facts } = rec;
  const sentences = [];

  // 1) 기온과 시간대 변화
  const day = facts.isTomorrow ? '내일은' : '오늘은';
  let first = `${day} ${String(facts.startHour).padStart(2, '0')}~${String(facts.endHour).padStart(2, '0')}시 체감온도가 `;
  first += Math.round(facts.feelsMin) === Math.round(facts.feelsMax) ? `${deg(facts.feelsMin)} 안팎이에요.` : `${deg(facts.feelsMin)}~${deg(facts.feelsMax)}예요.`;
  const minP = isNum(facts.feelsMinHour) ? periodOf(facts.feelsMinHour) : null;
  const maxP = isNum(facts.feelsMaxHour) ? periodOf(facts.feelsMaxHour) : null;
  if (facts.feelsMax - facts.feelsMin >= TEMP_CHANGE_NOTICE_C && minP && maxP && minP !== maxP) {
    first = first.replace(/예요\.$/, `로, ${minP}에 가장 낮고 ${maxP}에 가장 높아요.`);
  }
  sentences.push(first);

  // 2) 추천 옷차림
  const clothes = [];
  if (outfit.outer !== 'none') clothes.push(label('outer', outfit.outer) + (outfit.outerOptional ? '(선택)' : ''));
  clothes.push(label('top', outfit.top));
  const bottom = label('bottom', outfit.bottom);
  const list = clothes.length > 1 ? `${clothes.join('에 ')}, ${bottom}` : `${clothes[0]}에 ${bottom}`;
  sentences.push(`${josa(list, '을', '를')} 추천해요.`);

  // 3) 보정 이유: 우선순위 상위 2개까지를 한 문장으로 (전체 3문장 이내 유지)
  //    and = "~고" 연결형, so = "~서" 이유형, item = 챙길 것
  const NOTE_ORDER = ['snow', 'heavyRain', 'windChanged', 'swing', 'cold', 'wind'];
  const notes = {};
  for (const a of adjustments) {
    if (a.rule === 'snow') notes.snow = { and: '눈 예보가 있고', so: '눈 예보가 있어서', item: '미끄럼 방지 신발과 장갑, 목도리' };
    else if (a.rule === 'heavyRain') {
      const p = `비가 ${one(a.precipSum)}mm로 많`;
      notes.heavyRain = { and: `${p}고`, so: `${p}이 와서`, item: '방수 신발' };
    } else if (a.rule === 'wind') {
      const w = `바람이 최대 ${one(a.windMax)}m/s로 강`;
      if (a.changed) notes.windChanged = { and: `${w}하고`, so: `${w}해서`, item: '바람을 막는 겉옷' };
      else notes.wind = { and: `${w}하고`, so: `${w}하니`, item: null, single: `${w}하니 겉옷을 여며 입으세요.` };
    } else if (a.rule === 'swing') {
      const s = `기온 차가 ${Math.round(a.swing)}° 이상 나`;
      notes.swing = { and: `${s}고`, so: `${s}서`, item: '벗기 쉬운 겉옷' };
    } else if (a.rule === 'cold') notes.cold = { and: '많이 춥고', so: '많이 추워서', item: '목도리와 장갑' };
  }
  // 눈 규칙이 장갑/목도리를 이미 말하면 추위 문구는 뺀다
  if (notes.snow) delete notes.cold;

  const picked = NOTE_ORDER.filter((k) => notes[k]).slice(0, 2).map((k) => notes[k]);
  if (picked.length === 1) {
    const n = picked[0];
    sentences.push(n.single ?? `${n.so} ${josa(n.item, '을', '를')} 챙기세요.`);
  } else if (picked.length === 2) {
    const [a, b] = picked;
    const items = [a.item, b.item].filter(Boolean);
    const what = items.length === 2 ? `${josa(items[0], '과', '와')} ${items[1]}` : items[0];
    sentences.push(`${a.and} ${b.so} ${josa(what, '을', '를')} 챙기세요.`);
  }

  return sentences.join(' ');
}

// ---- AI 이유 문장 (8단계) ----

export const AI_TIMEOUT_MS = 8000;
const CACHE_PREFIX = 'wearcast:explain:';
// 예보가 갱신되면 문장이 달라질 수 있어 짧게 둔다. 내일 기준은 더 짧게
const CACHE_TTL_TODAY_MS = 2 * 60 * 60 * 1000;
const CACHE_TTL_TOMORROW_MS = 60 * 60 * 1000;
const FAILED_RETRY_MS = 5 * 60 * 1000; // 실패한 조합은 5분 동안 다시 묻지 않는다

// 서버로 보낼 내용: 규칙 엔진이 확정한 ID들 + 요약 수치만 (자유 텍스트 없음)
export function buildExplainPayload(rec, summary, checklist) {
  const o = rec.outfit;
  return {
    outfit: { outer: o.outer, top: o.top, bottom: o.bottom, shoes: o.shoes, outerOptional: o.outerOptional, extras: o.extras },
    checklist: checklist.map((i) => i.id),
    facts: {
      isTomorrow: rec.facts.isTomorrow,
      startHour: rec.facts.startHour,
      endHour: rec.facts.endHour,
      feelsMin: rec.facts.feelsMin,
      feelsMax: rec.facts.feelsMax,
      feelsMinHour: rec.facts.feelsMinHour,
      feelsMaxHour: rec.facts.feelsMaxHour,
      dailyRange: rec.facts.dailyRange,
      windMax: rec.facts.windMax,
      popMax: rec.facts.popMax,
      precipSum: rec.facts.precipSum,
      snowSum: rec.facts.snowSum,
      uvMax: summary.uvMax,
      pm10Max: summary.pm10Max,
      pm25Max: summary.pm25Max,
      dustMax: summary.dustMax,
      hasThunder: summary.hasThunder,
      hasSnowCode: summary.hasSnowCode,
    },
  };
}

// 같은 (지역, 대상 날짜, 시간대, 요약 수치) 조합이면 같은 키 -> 캐시 재사용
function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function explainCacheKey(regionKey, targetDate, payload) {
  return `${CACHE_PREFIX}${targetDate}:${hash(`${regionKey}|${JSON.stringify(payload)}`)}`;
}

function readCache(key, storage, now) {
  try {
    const v = JSON.parse(storage.getItem(key));
    if (v && typeof v.text === 'string' && now < v.expiresAt) return v.text;
    if (v) storage.removeItem(key);
  } catch {
    // 저장소를 못 쓰면 캐시 없이 동작
  }
  return null;
}

function writeCache(key, text, ttl, storage, now) {
  try {
    storage.setItem(key, JSON.stringify({ text, expiresAt: now + ttl }));
  } catch {
    // 무시
  }
}

const inFlight = new Map(); // key -> Promise
const failedAt = new Map(); // key -> 실패 시각

/**
 * 화면에 바로 쓸 이유 문장. 캐시에 AI 문장이 있으면 그것을, 없으면 규칙 기반 문장을 준다.
 * pending: true면 AI 문장을 아직 기다리는 중 (requestAiReason을 부르면 됨)
 */
export function getReason(rec, { cacheKey = null, storage = globalThis.localStorage, now = Date.now() } = {}) {
  const cached = cacheKey && storage ? readCache(cacheKey, storage, now) : null;
  if (cached) return { text: cached, source: 'ai', pending: false };
  const recentlyFailed = cacheKey && now - (failedAt.get(cacheKey) ?? -Infinity) < FAILED_RETRY_MS;
  return { text: templateReason(rec), source: 'template', pending: Boolean(cacheKey) && !recentlyFailed };
}

/**
 * /api/explain에 AI 문장을 요청한다. 성공하면 { text, source: 'ai' }, 어떤 이유로든 실패하면 null.
 * 실패해도 예외를 던지지 않는다 (화면은 규칙 기반 문장을 그대로 쓴다).
 */
export function requestAiReason(payload, cacheKey, {
  fetchImpl = globalThis.fetch,
  storage = globalThis.localStorage,
  timeoutMs = AI_TIMEOUT_MS,
  endpoint = '/api/explain',
} = {}) {
  if (inFlight.has(cacheKey)) return inFlight.get(cacheKey);

  const job = (async () => {
    try {
      const res = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      // 서버가 검사했더라도 클라이언트에서 한 번 더 확인
      const checked = validateReason(body?.reason, payload.facts);
      if (!checked.ok) throw new Error(checked.error);
      const ttl = payload.facts.isTomorrow ? CACHE_TTL_TOMORROW_MS : CACHE_TTL_TODAY_MS;
      if (storage) writeCache(cacheKey, checked.text, ttl, storage, Date.now());
      failedAt.delete(cacheKey);
      return { text: checked.text, source: 'ai', pending: false };
    } catch (err) {
      console.info('[explain] AI 문장 대신 규칙 기반 문장 사용:', err.name === 'TimeoutError' ? '시간 초과' : err.message);
      failedAt.set(cacheKey, Date.now());
      return null;
    } finally {
      inFlight.delete(cacheKey);
    }
  })();
  inFlight.set(cacheKey, job);
  return job;
}

// 지난 날짜의 이유 문장 캐시를 지운다
export function pruneExplainCache(today, storage = globalThis.localStorage) {
  try {
    const keys = [];
    for (let i = 0; i < storage.length; i += 1) keys.push(storage.key(i));
    keys.filter((k) => k?.startsWith(CACHE_PREFIX) && k.slice(CACHE_PREFIX.length, CACHE_PREFIX.length + 10) < today).forEach((k) => storage.removeItem(k));
  } catch {
    // 무시
  }
}
