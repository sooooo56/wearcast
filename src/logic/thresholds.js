// 이 파일이 하는 일: 앱의 모든 임계값(기준 숫자)을 한 곳에 모은다. 값을 바꿀 때는 이 파일만 고친다.
// 주의: 옷차림/보정 수치는 일반 관행을 바탕으로 한 초안이며 검증된 공식 기준이 아니다 (CLAUDE.md 8번).

// ---- 외출 시간대 ----
export const DEFAULT_WINDOW = { startHour: 8, endHour: 19 };
export const MIN_WINDOW_HOURS = 1;

// ---- WEATHER 화면 ----
export const HOURLY_GRID_CELLS = 6; // 시간대 그리드 칸 수 (현재 시각부터)

// 자외선 지수 단계 (WHO UV Index 기준: 0-2 낮음, 3-5 보통, 6-7 높음, 8-10 매우 높음, 11+ 위험)
export const UV_LEVELS = [
  { min: 11, label: '위험' },
  { min: 8, label: '매우 높음' },
  { min: 6, label: '높음' },
  { min: 3, label: '보통' },
  { min: 0, label: '낮음' },
];

// ---- 기본 옷차림 (체감온도 구간) ----
// 위에서부터 차례로 보고 "체감온도 >= min"인 첫 구간을 쓴다.
// 상의/하의는 체감 최저·최고의 중간값, 아우터는 체감 최저값으로 고른다.
// outerOptional: 겉옷이 "선택" 사항인 구간 (예: 20~22도 가디건)
export const OUTFIT_BANDS = [
  { min: 28, label: '28° 이상', outer: 'none', top: 'short_sleeve', bottom: 'shorts' },
  { min: 23, label: '23~27°', outer: 'none', top: 'short_sleeve', bottom: 'thin_pants' },
  { min: 20, label: '20~22°', outer: 'cardigan', outerOptional: true, top: 'thin_long_sleeve', bottom: 'long_pants' },
  { min: 17, label: '17~19°', outer: 'cardigan', top: 'sweatshirt_knit', bottom: 'long_pants' },
  { min: 12, label: '12~16°', outer: 'jacket', top: 'thin_long_sleeve', bottom: 'long_pants' },
  { min: 9, label: '9~11°', outer: 'trench', top: 'sweatshirt_knit', bottom: 'long_pants' },
  { min: 5, label: '5~8°', outer: 'coat', top: 'knit_heattech', bottom: 'long_pants' },
  { min: -Infinity, label: '4° 이하', outer: 'padding', top: 'knit_heattech', bottom: 'warm_pants', extras: ['scarf', 'gloves'] },
];

// ---- 보정 규칙 ----
export const WIND_STRONG_MS = 7; // windMax 이상이면 방풍 겉옷
export const TEMP_SWING_C = 10; // 일교차 또는 체감 차이가 이 이상이면 벗기 쉬운 겉옷
export const RAIN_POP_PERCENT = 60; // 강수확률 이 이상이면 우산 (6단계 준비물)
export const RAIN_HEAVY_MM = 10; // 강수량 합계 이 이상이면 방수 신발
// 바람을 막기 어려운 얇은 겉옷 -> 강풍이면 방풍 겉옷으로 바꾼다 (코트/패딩은 유지)
export const WIND_REPLACEABLE_OUTERS = ['none', 'cardigan', 'jacket', 'trench'];

// ---- 준비물 (checklist.js) ----
export const UV_SUNSCREEN = 6; // uvMax 이상이면 자외선 차단제
export const UV_HAT = 8; // uvMax 이상이면 모자/양산 + 덧바르기 안내
// 미세먼지 "나쁨" 시작값. 에어코리아 예보 등급표로 확인 (2026-11-04, m.airkorea.or.kr/info/behaviorInfo1):
// PM10 좋음 0~30 / 보통 31~80 / 나쁨 81~150 / 매우나쁨 151+, PM2.5 좋음 0~15 / 보통 16~35 / 나쁨 36~75 / 매우나쁨 76+
// 주의: 공식 등급은 하루 평균 기준이고, 앱은 외출 시간대의 시간별 최댓값(모델 예측)과 비교한다.
export const PM10_BAD = 81;
export const PM25_BAD = 36;
// 황사 "가능성 참고" 문구 기준 (초안). 공식 특보가 아니다. dust가 PM10 나쁨 기준만큼 높으면 표시
export const DUST_NOTICE = 81;

// ---- 이유 문장용 시간대 구분 ----
export const DAY_PERIODS = [
  { until: 11, label: '아침' }, // 0~10시
  { until: 17, label: '낮' }, // 11~16시
  { until: 24, label: '저녁' }, // 17~23시
];
export const TEMP_CHANGE_NOTICE_C = 3; // 구간 안 체감 변화가 이 이상이면 문장에 언급
