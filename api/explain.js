// 이 파일이 하는 일: Vercel 서버리스 함수 POST /api/explain. 규칙 엔진이 정한 옷/준비물과 요약 수치를 받아
// LLM에게 "이유 문장"만 쓰게 한다 (항목 선택권은 주지 않음). LLM 키는 이 서버에서만 쓰고 브라우저로 보내지 않는다.
//
// 환경변수 (.env.local 또는 Vercel 프로젝트 설정)
//   LLM_PROVIDER       anthropic(기본) | mock(키 없이 흐름만 확인하는 로컬 테스트용)
//   ANTHROPIC_API_KEY  Anthropic API 키
//   LLM_MODEL          모델 이름 (코드에 넣지 않음. 예시는 .env.example)
//   LLM_EFFORT         low(기본) | medium | high ... 짧은 문장이라 low로 충분
//
// 응답: 200 { reason, source: "ai" } / 실패 시 4xx·5xx { error }. 클라이언트는 실패하면 규칙 기반 문장으로 대체한다.

import Anthropic from '@anthropic-ai/sdk';
import { ITEMS, CHECK_ITEMS } from '../src/data/items.js';
import { validateReason, REASON_MAX_LENGTH } from '../src/logic/reasonCheck.js';

const MAX_BODY_BYTES = 4000;
const LLM_TIMEOUT_MS = 7000; // 클라이언트 제한(8초)보다 짧게

// ---- 간단한 호출 제한 (IP당 10분에 20회) ----
// 서버리스 인스턴스마다 메모리가 따로라 완벽하지 않지만, 한 곳에서 키를 마구 쓰는 것은 막는다.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 20;
const hits = new Map();

function rateLimited(ip, now = Date.now()) {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_MAX;
}

export function resetRateLimit() {
  hits.clear();
}

// ---- 입력 검사: 알려진 ID와 숫자/참거짓만 받는다 (자유 텍스트를 프롬프트에 넣지 않음) ----
const FACT_NUMBERS = ['startHour', 'endHour', 'feelsMin', 'feelsMax', 'feelsMinHour', 'feelsMaxHour', 'dailyRange', 'windMax', 'popMax', 'precipSum', 'snowSum', 'uvMax', 'pm10Max', 'pm25Max', 'dustMax'];
const FACT_BOOLEANS = ['isTomorrow', 'hasThunder', 'hasSnowCode'];

function sanitize(body) {
  if (!body || typeof body !== 'object') return null;
  const { outfit, checklist, facts } = body;
  if (!outfit || !facts || !Array.isArray(checklist)) return null;

  const pick = (slot, id) => (typeof id === 'string' && ITEMS[slot]?.[id] ? id : null);
  const clean = {
    outfit: {
      outer: pick('outer', outfit.outer),
      top: pick('top', outfit.top),
      bottom: pick('bottom', outfit.bottom),
      shoes: pick('shoes', outfit.shoes),
      outerOptional: outfit.outerOptional === true,
      extras: (Array.isArray(outfit.extras) ? outfit.extras : []).filter((id) => pick('extras', id)),
    },
    checklist: checklist.filter((id) => typeof id === 'string' && CHECK_ITEMS[id]).slice(0, 10),
    facts: {},
  };
  if (!clean.outfit.outer || !clean.outfit.top || !clean.outfit.bottom || !clean.outfit.shoes) return null;

  for (const k of FACT_NUMBERS) {
    const v = facts[k];
    clean.facts[k] = typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10) / 10 : null;
  }
  for (const k of FACT_BOOLEANS) clean.facts[k] = facts[k] === true;
  if (clean.facts.feelsMin === null || clean.facts.feelsMax === null) return null;
  if (!Number.isInteger(clean.facts.startHour) || !Number.isInteger(clean.facts.endHour)) return null;
  return clean;
}

// ---- 프롬프트 ----
const SYSTEM_PROMPT = `당신은 날씨 기반 옷차림 추천 앱의 "추천 이유" 문장을 쓰는 역할입니다.
옷차림과 준비물은 앱의 규칙 엔진이 이미 정했습니다. 항목을 바꾸거나, 빼거나, 새로 추천하지 마세요.

규칙:
- 입력 JSON에 있는 수치와 사실만 근거로 씁니다. 입력에 없는 숫자, 날씨 현상, 시간은 만들지 않습니다.
- 숫자를 쓸 때는 입력 값 그대로 쓰거나 정수로 반올림합니다. 값이 null인 항목은 언급하지 않습니다.
- 한국어 존댓말(~요)로 2~3문장, ${REASON_MAX_LENGTH}자 이하로 씁니다.
- isTomorrow가 true면 "내일은", false면 "오늘은"으로 시작합니다.
- feelsMinHour/feelsMaxHour로 아침(0~10시)/낮(11~16시)/저녁(17~23시)의 체감 변화가 드러나면 반영합니다.
- 미세먼지와 dust는 모델 예측값입니다. 언급하면 "예측"이라고 쓰고, 황사 특보라고 표현하지 않습니다.
- 출력은 {"reason": "..."} 형식의 JSON 하나입니다.`;

const REASON_SCHEMA = {
  type: 'object',
  properties: { reason: { type: 'string' } },
  required: ['reason'],
  additionalProperties: false,
};

function userContent(input) {
  const label = (slot, id) => ITEMS[slot][id].label;
  const { outfit, checklist, facts } = input;
  return JSON.stringify(
    {
      기준: { isTomorrow: facts.isTomorrow, startHour: facts.startHour, endHour: facts.endHour },
      옷차림: {
        아우터: outfit.outer === 'none' ? '없음' : label('outer', outfit.outer) + (outfit.outerOptional ? '(선택)' : ''),
        상의: label('top', outfit.top),
        하의: label('bottom', outfit.bottom),
        신발: label('shoes', outfit.shoes),
        방한용품: outfit.extras.map((id) => label('extras', id)),
      },
      준비물: checklist.map((id) => CHECK_ITEMS[id].label),
      수치: {
        체감최저_C: facts.feelsMin,
        체감최고_C: facts.feelsMax,
        feelsMinHour: facts.feelsMinHour,
        feelsMaxHour: facts.feelsMaxHour,
        일교차_C: facts.dailyRange,
        최대풍속_ms: facts.windMax,
        최대강수확률_퍼센트: facts.popMax,
        강수량합계_mm: facts.precipSum,
        적설합계_cm: facts.snowSum,
        최대자외선지수: facts.uvMax,
        PM10최대_예측: facts.pm10Max,
        PM25최대_예측: facts.pm25Max,
        dust최대_예측: facts.dustMax,
        천둥번개: facts.hasThunder,
        눈: facts.hasSnowCode,
      },
    },
    null,
    1,
  );
}

// ---- 제공자 ----
// 서버 쪽 거부(refusal)를 다른 모델로 다시 처리해 주는 기능을 지원하는 모델
const SERVER_FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5']);

class LlmError extends Error {
  constructor(code, status = 502) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

async function callAnthropic(input, env) {
  if (!env.ANTHROPIC_API_KEY) throw new LlmError('llm_not_configured', 503);
  if (!env.LLM_MODEL) throw new LlmError('llm_model_not_configured', 503);

  // 키를 명시해서 넘긴다 (컴퓨터에 저장된 다른 로그인 정보가 대신 쓰이지 않게)
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: LLM_TIMEOUT_MS, maxRetries: 0 });
  const effort = env.LLM_EFFORT || 'low';
  const params = {
    model: env.LLM_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent(input) }],
    output_config: { effort, format: { type: 'json_schema', schema: REASON_SCHEMA } },
  };
  if (SERVER_FALLBACK_MODELS.has(env.LLM_MODEL)) {
    params.betas = ['server-side-fallback-2026-07-01'];
    params.fallbacks = 'default';
  }

  let message;
  try {
    message = await client.beta.messages.create(params);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new LlmError('llm_auth_failed');
    if (err instanceof Anthropic.RateLimitError) throw new LlmError('llm_rate_limited', 503);
    if (err instanceof Anthropic.APIConnectionTimeoutError) throw new LlmError('llm_timeout', 504);
    if (err instanceof Anthropic.APIConnectionError) throw new LlmError('llm_unreachable');
    if (err instanceof Anthropic.APIError) throw new LlmError(`llm_api_error_${err.status ?? 'unknown'}`);
    throw err;
  }

  if (message.stop_reason === 'refusal') throw new LlmError('llm_refused');
  if (message.stop_reason === 'max_tokens') throw new LlmError('llm_truncated');
  const text = message.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new LlmError('llm_empty');
  try {
    return JSON.parse(text).reason;
  } catch {
    throw new LlmError('llm_bad_json');
  }
}

// 키 없이 흐름(검증/캐시/화면 라벨)을 확인하는 로컬 테스트용. 실제 배포에서는 쓰지 않는다.
async function callMock(input) {
  const f = input.facts;
  const day = f.isTomorrow ? '내일은' : '오늘은';
  return `${day} 체감온도가 ${Math.round(f.feelsMin)}~${Math.round(f.feelsMax)}°로 예상돼요. (모의 AI 응답) 규칙 엔진이 고른 옷차림이 이 기온에 맞아요.`;
}

// ---- 핸들러 ----
function readBody(req) {
  const raw = req.body;
  if (raw && typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw; // Vercel이 이미 JSON으로 읽은 경우
  const str = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw ?? '');
  if (Buffer.byteLength(str) > MAX_BODY_BYTES) throw new LlmError('body_too_large', 413);
  return JSON.parse(str);
}

// Vercel이 부르는 진입점. 환경변수는 process.env에서 읽는다.
export default function handler(req, res) {
  return handleExplain(req, res, process.env);
}

// env를 직접 받는 버전 (로컬 개발 서버가 .env.local 값을 넘길 때 사용)
export async function handleExplain(req, res, env) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const ip = String(req.headers?.['x-forwarded-for'] ?? req.socket?.remoteAddress ?? 'unknown').split(',')[0].trim();
  if (rateLimited(ip)) return res.status(429).json({ error: 'too_many_requests' });

  let input;
  try {
    input = sanitize(readBody(req));
  } catch (err) {
    return res.status(err.status ?? 400).json({ error: err.code ?? 'bad_json' });
  }
  if (!input) return res.status(400).json({ error: 'bad_request' });

  try {
    const provider = (env.LLM_PROVIDER || 'anthropic').toLowerCase();
    const reason = provider === 'mock' ? await callMock(input) : await callAnthropic(input, env);
    const checked = validateReason(reason, input.facts);
    if (!checked.ok) {
      console.warn('[explain] 검증 실패:', checked.error);
      return res.status(502).json({ error: 'llm_invalid_output' });
    }
    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json({ reason: checked.text, source: 'ai' });
  } catch (err) {
    const code = err instanceof LlmError ? err.code : 'internal_error';
    console.warn('[explain] 실패:', code);
    return res.status(err instanceof LlmError ? err.status : 500).json({ error: code });
  }
}
