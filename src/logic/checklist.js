// 이 파일이 하는 일: summary(외출 시간대 요약)로 외출 전 준비물 목록을 만든다 (CLAUDE.md 8번).
// 각 항목은 { id, reason } 이다. reason은 요약 수치에 있는 사실만 쓴다. 값이 null인 규칙은 건너뛴다.
// 황사는 공식 특보를 받지 못하므로 "가능성 참고"로만 표시한다.

import {
  RAIN_POP_PERCENT,
  UV_SUNSCREEN,
  UV_HAT,
  UV_LEVELS,
  PM10_BAD,
  PM25_BAD,
  DUST_NOTICE,
  DAY_PERIODS,
} from './thresholds.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const one = (v) => String(Math.round(v * 10) / 10);
const periodOf = (hour) => DAY_PERIODS.find((p) => hour < p.until)?.label ?? null;
const uvLevel = (uv) => UV_LEVELS.find((l) => uv >= l.min)?.label ?? '';

// 비 오는 시각들 -> "낮" / "아침~저녁"
function rainPeriod(hours) {
  if (!hours?.length) return null;
  const first = periodOf(hours[0]);
  const last = periodOf(hours[hours.length - 1]);
  return first === last ? first : `${first}~${last}`;
}

/**
 * @param {object} summary  summarize() 결과
 * @param {object} [outfitRec]  recommendOutfit() 결과 (방한용품을 준비물에도 넣기 위해)
 * @returns {Array<{id: string, reason: string}>}  표시 순서대로
 */
export function recommendChecklist(summary, outfitRec = null) {
  if (!summary) return [];
  const items = [];
  const add = (id, reason) => {
    if (!items.some((i) => i.id === id)) items.push({ id, reason });
  };

  // 1) 비 / 천둥번개 -> 우산
  const rainy =
    (isNum(summary.popMax) && summary.popMax >= RAIN_POP_PERCENT) || (isNum(summary.precipSum) && summary.precipSum > 0);
  if (rainy || summary.hasThunder) {
    const when = rainPeriod(summary.rainHours);
    const parts = [when ? `${when} 비 예보` : '비 예보'];
    if (isNum(summary.popMax)) parts.push(`강수확률 최대 ${summary.popMax}%`);
    if (isNum(summary.precipSum) && summary.precipSum > 0) parts.push(`강수량 ${one(summary.precipSum)}mm`);
    add('umbrella', parts.join(' · '));
  }
  if (summary.hasThunder) add('thunder_caution', '천둥번개 예보 · 야외에 오래 있지 마세요');

  // 2) 미세먼지 (예측값) -> 마스크
  const pmParts = [];
  if (isNum(summary.pm10Max) && summary.pm10Max >= PM10_BAD) pmParts.push(`PM10 최대 ${Math.round(summary.pm10Max)}`);
  if (isNum(summary.pm25Max) && summary.pm25Max >= PM25_BAD) pmParts.push(`PM2.5 최대 ${Math.round(summary.pm25Max)}`);
  if (pmParts.length) add('mask', `${pmParts.join(', ')}㎍/㎥ (예측, 나쁨 수준) · 장시간 야외활동 주의`);

  // 3) 황사: 특보가 아니라 모델 예측 참고
  if (isNum(summary.dustMax) && summary.dustMax >= DUST_NOTICE) {
    add('dust_notice', `모델 예측 먼지(dust) 최대 ${Math.round(summary.dustMax)}㎍/㎥ · 공식 황사특보 아님`);
  }

  // 4) 자외선
  if (isNum(summary.uvMax) && summary.uvMax >= UV_SUNSCREEN) {
    const reapply = summary.uvMax >= UV_HAT ? ' · 2~3시간마다 덧바르기' : '';
    add('sunscreen', `자외선 지수 최대 ${one(summary.uvMax)} (${uvLevel(summary.uvMax)})${reapply}`);
  }
  if (isNum(summary.uvMax) && summary.uvMax >= UV_HAT) add('hat', `자외선 지수 최대 ${one(summary.uvMax)} (${uvLevel(summary.uvMax)})`);

  // 5) 방한용품 (옷차림 규칙이 고른 목도리/장갑을 준비물에도 넣는다)
  const extras = outfitRec?.outfit?.extras ?? [];
  const coldReason = summary.hasSnowCode || (isNum(summary.snowSum) && summary.snowSum > 0)
    ? '눈 예보'
    : isNum(summary.feelsMin) ? `체감 최저 ${Math.round(summary.feelsMin)}°` : '추운 날씨';
  if (extras.includes('scarf')) add('scarf', coldReason);
  if (extras.includes('gloves')) add('gloves', coldReason);

  return items;
}
