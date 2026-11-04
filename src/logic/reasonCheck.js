// 이 파일이 하는 일: 이유 문장(AI/규칙 공통)이 규칙에 맞는지 검사한다. 서버(/api/explain)와 테스트가 함께 쓴다.
// 규칙: 문자열, 300자 이하, 한글 포함, 문장 속 숫자는 모두 입력 수치(facts)에서 나온 값이어야 한다 (없는 수치 금지).

export const REASON_MAX_LENGTH = 300;
export const REASON_MIN_LENGTH = 10;

// facts 안의 숫자로 "써도 되는 숫자" 목록을 만든다 (원래 값, 정수 반올림, 소수 한 자리, 두 자리 시각 표기)
export function allowedNumbers(facts) {
  const nums = Object.values(facts ?? {}).flatMap((v) => (Array.isArray(v) ? v : [v]));
  const out = new Set();
  for (const v of nums) {
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    out.add(String(v));
    out.add(String(Math.round(v)));
    out.add(String(Math.round(v * 10) / 10));
    out.add(String(Math.round(v)).padStart(2, '0'));
  }
  // 체감 최고-최저 차이 (예: "기온 차가 10° 이상")
  if (typeof facts?.feelsMax === 'number' && typeof facts?.feelsMin === 'number') {
    out.add(String(Math.round(facts.feelsMax - facts.feelsMin)));
  }
  return out;
}

/**
 * @returns {{ ok: true, text: string } | { ok: false, error: string }}
 */
export function validateReason(text, facts) {
  if (typeof text !== 'string') return { ok: false, error: 'not_string' };
  const t = text.trim();
  if (t.length < REASON_MIN_LENGTH) return { ok: false, error: 'too_short' };
  if (t.length > REASON_MAX_LENGTH) return { ok: false, error: 'too_long' };
  if (!/[가-힣]/.test(t)) return { ok: false, error: 'not_korean' };
  const allowed = allowedNumbers(facts);
  // 숫자 앞의 "-"는 영하일 때만 의미가 있으니 함께 본다 (예: "-5°", 단 "08~19"의 "~"는 구분자)
  for (const n of t.match(/-?\d+(?:\.\d+)?/g) ?? []) {
    const plain = n.replace(/^-/, '');
    if (!allowed.has(n) && !allowed.has(plain)) return { ok: false, error: `unknown_number:${n}` };
  }
  return { ok: true, text: t };
}
