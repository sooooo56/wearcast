// 이 파일이 하는 일: summary(외출 시간대 요약)로 옷차림을 정하는 규칙 엔진 (CLAUDE.md 8번).
// 항목 선택은 이 규칙이 확정한다. LLM은 이유 문장만 쓴다 (9번).
// 값이 null인 규칙은 건너뛴다.

import {
  OUTFIT_BANDS,
  WIND_STRONG_MS,
  TEMP_SWING_C,
  RAIN_HEAVY_MM,
  WIND_REPLACEABLE_OUTERS,
} from './thresholds.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const bandFor = (feels) => OUTFIT_BANDS.find((b) => feels >= b.min);

/**
 * @returns {{ outfit, adjustments, facts } | null}
 *   outfit: { outer, outerOptional, top, bottom, shoes, extras[] }
 *   adjustments: 적용된 보정 규칙 목록 (이유 문장/화면 표시용) [{ rule, ... }]
 *   facts: 판단에 쓴 요약 수치 (LLM/템플릿 입력용)
 */
export function recommendOutfit(summary) {
  if (!summary || !isNum(summary.feelsMin) || !isNum(summary.feelsMax)) return null;

  const { feelsMin, feelsMax } = summary;
  const feelsMid = Math.round(((feelsMin + feelsMax) / 2) * 10) / 10;

  // 1) 기본: 상의/하의 = 중간값 구간, 아우터 = 최저값 구간
  const midBand = bandFor(feelsMid);
  const minBand = bandFor(feelsMin);

  const outfit = {
    outer: minBand.outer,
    outerOptional: Boolean(minBand.outerOptional),
    top: midBand.top,
    bottom: midBand.bottom,
    shoes: 'sneakers',
    extras: [...(minBand.extras ?? [])],
  };
  const adjustments = [];
  const addExtra = (id) => {
    if (!outfit.extras.includes(id)) outfit.extras.push(id);
  };

  // 2) 바람: 얇은 겉옷이면 방풍 겉옷으로 (코트/패딩은 유지)
  if (isNum(summary.windMax) && summary.windMax >= WIND_STRONG_MS) {
    if (WIND_REPLACEABLE_OUTERS.includes(outfit.outer)) {
      outfit.outer = 'windbreaker';
      outfit.outerOptional = false;
      adjustments.push({ rule: 'wind', windMax: summary.windMax, changed: true });
    } else {
      adjustments.push({ rule: 'wind', windMax: summary.windMax, changed: false });
    }
  }

  // 3) 큰 기온 차: 겉옷이 없으면 벗기 쉬운 겉옷 추가
  const swing = Math.max(
    isNum(summary.dailyRange) ? summary.dailyRange : -Infinity,
    feelsMax - feelsMin,
  );
  if (swing >= TEMP_SWING_C) {
    if (outfit.outer === 'none') outfit.outer = 'cardigan';
    outfit.outerOptional = false;
    adjustments.push({ rule: 'swing', swing: Math.round(swing * 10) / 10 });
  }

  // 4) 많은 비: 방수 신발
  if (isNum(summary.precipSum) && summary.precipSum >= RAIN_HEAVY_MM) {
    outfit.shoes = 'waterproof_shoes';
    adjustments.push({ rule: 'heavyRain', precipSum: summary.precipSum });
  }

  // 5) 눈: 미끄럼 방지 신발 + 장갑 + 목도리 (눈이 비보다 우선)
  if (summary.hasSnowCode || (isNum(summary.snowSum) && summary.snowSum > 0)) {
    outfit.shoes = 'nonslip_shoes';
    addExtra('gloves');
    addExtra('scarf');
    adjustments.push({ rule: 'snow', snowSum: summary.snowSum });
  }

  if (minBand.extras?.length) adjustments.push({ rule: 'cold', feelsMin });

  return {
    outfit,
    adjustments,
    facts: {
      targetDate: summary.targetDate,
      isTomorrow: summary.isTomorrow,
      startHour: summary.startHour,
      endHour: summary.endHour,
      feelsMin,
      feelsMax,
      feelsMid,
      feelsMinHour: summary.feelsMinHour,
      feelsMaxHour: summary.feelsMaxHour,
      dailyRange: summary.dailyRange,
      windMax: summary.windMax,
      popMax: summary.popMax,
      precipSum: summary.precipSum,
      snowSum: summary.snowSum,
      midBand: midBand.label,
      minBand: minBand.label,
    },
  };
}
