// 이 파일이 하는 일: WEATHER 상세 카드에 들어가는 작은 시각화(막대, 나침반)의 HTML을 만든다.
// 값이 없으면(null) 빈 문자열을 돌려줘서 막대를 그리지 않는다 (값을 만들어 내지 않음).
// 막대 색은 자외선/미세먼지 등급처럼 "의미 있는 색"이라 테마와 상관없이 고정이다.

import { UV_SCALE_MAX, WIND_SCALE_MAX, PM10_BANDS, PM25_BANDS } from '../logic/thresholds.js';

const has = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const pct = (x) => `${(clamp01(x) * 100).toFixed(1)}%`;

// 막대 위에 점(현재 값)을 찍는다. position은 0~1.
function track(cssClass, position) {
  return `<span class="gauge ${cssClass}" aria-hidden="true"><span class="gauge__dot" style="left:${pct(position)}"></span></span>`;
}

// 자외선: 0 ~ UV_SCALE_MAX 막대 (초록 -> 노랑 -> 주황 -> 빨강 -> 보라)
export function uvGauge(uv) {
  if (!has(uv)) return '';
  return track('gauge--uv', uv / UV_SCALE_MAX);
}

// 강수확률: 0 ~ 100% 채움 막대
export function popGauge(pop) {
  if (!has(pop)) return '';
  return `<span class="gauge gauge--fill" aria-hidden="true"><span class="gauge__fill" style="width:${pct(pop / 100)}"></span></span>`;
}

// 풍속: 0 ~ WIND_SCALE_MAX m/s 막대
export function windGauge(wind) {
  if (!has(wind)) return '';
  return track('gauge--wind', wind / WIND_SCALE_MAX);
}

// ---- 미세먼지 ----
// 값이 속한 등급 번호(0~3)와, 그 등급 안에서의 위치(0~1)
function bandOf(value, bands) {
  let lower = 0;
  for (let i = 0; i < bands.length; i += 1) {
    if (value <= bands[i].max) {
      const span = bands[i].max === Infinity ? lower * 0.6 || 1 : bands[i].max - lower;
      return { index: i, label: bands[i].label, frac: clamp01((value - lower) / span) };
    }
    lower = bands[i].max;
  }
  return { index: bands.length - 1, label: bands.at(-1).label, frac: 1 };
}

// PM10, PM2.5 중 더 나쁜 쪽 등급을 막대에 표시한다. 둘 다 없으면 null
export function pmGrade(pm10, pm25) {
  const grades = [];
  if (has(pm10)) grades.push({ ...bandOf(pm10, PM10_BANDS), name: 'PM10' });
  if (has(pm25)) grades.push({ ...bandOf(pm25, PM25_BANDS), name: 'PM2.5' });
  if (!grades.length) return null;
  return grades.reduce((a, b) => (b.index + b.frac > a.index + a.frac ? b : a));
}

// 4등급을 같은 폭으로 나눈 막대 (파랑 -> 초록 -> 주황 -> 빨강)
export function pmGauge(grade) {
  if (!grade) return '';
  return track('gauge--pm', (grade.index + grade.frac) / PM10_BANDS.length);
}

// ---- 풍향 나침반 ----
const DIRECTIONS = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];

// 풍향(degrees)은 "바람이 불어오는 방향"이다. 8방위 한글 이름 (예: 315 -> 북서)
export function windDirectionLabel(deg) {
  if (!has(deg)) return null;
  return DIRECTIONS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

// 작은 나침반: 바깥 원 + N 표시 + 바람이 "가는" 방향으로 향한 화살표
export function compass(deg) {
  if (!has(deg)) return '';
  const to = (deg + 180) % 360; // 불어오는 방향의 반대쪽이 바람이 향하는 곳
  return `
    <svg class="compass" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.35" />
      <text x="24" y="10" text-anchor="middle" font-size="7" font-weight="700" fill="currentColor" opacity="0.7">N</text>
      <g transform="rotate(${to.toFixed(0)} 24 24)">
        <path d="M24 12 L29 26 L24 23.5 L19 26 Z" fill="currentColor" />
        <line x1="24" y1="23.5" x2="24" y2="36" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </g>
    </svg>`;
}
