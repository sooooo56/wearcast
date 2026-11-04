// 이 파일이 하는 일: 현재 날씨 코드로 배경 테마를 정하고, <html data-theme>와 배경 효과 레이어(.sky)를 바꾼다.
// 세 화면이 같은 테마를 쓴다. 테마는 항상 "지금" 날씨 기준이다 (내일 기준 추천과 무관).

import { describeWeather } from '../data/weatherCodes.js';

export const THEMES = ['clear-day', 'clear-night', 'cloudy', 'cloudy-night', 'rain', 'snow', 'thunder', 'fog', 'fog-night'];
const DEFAULT_THEME = 'clear-day';

// 입자 수는 적게 (CLAUDE.md 5-1: 비/눈 효과는 절제)
const PARTICLE_COUNT = { stars: 28, rain: 22, snow: 22 };

// 새로고침해도 같은 배치가 나오도록 고정된 의사 난수
function seeded(i, salt) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function particles(kind, count) {
  return Array.from({ length: count }, (_, i) => {
    const x = (seeded(i, 1) * 100).toFixed(1);
    const y = kind === 'stars' ? (seeded(i, 2) * 70).toFixed(1) : '0';
    const delay = (-seeded(i, 3) * (kind === 'snow' ? 14 : kind === 'rain' ? 1.2 : 4)).toFixed(2);
    const dur =
      kind === 'snow' ? 9 + seeded(i, 4) * 7 : kind === 'rain' ? 0.8 + seeded(i, 4) * 0.5 : 3 + seeded(i, 4) * 4;
    const size = kind === 'snow' ? `--s:${(4 + seeded(i, 5) * 5).toFixed(1)}px;` : '';
    return `<span class="sky__p" style="--x:${x}%;--y:${y}%;--delay:${delay}s;--d:${dur.toFixed(2)}s;${size}"></span>`;
  }).join('');
}

// 구름/안개 띠는 <i>로 만든다 (CSS의 nth-of-type 위치 지정이 다른 요소와 섞이지 않게)
const clouds = (n) => '<i class="sky__cloud"></i>'.repeat(n);
const bands = (n) => '<i class="sky__band"></i>'.repeat(n);
// 화면을 넘길 때 살짝 따라 움직이는 뒤쪽 층
const layer = (html) => `<div class="sky__layer">${html}</div>`;

const SUN = '<div class="sky__sun"><div class="sky__rays"></div><div class="sky__glow"></div></div><div class="sky__beam"></div>';

// 테마별 배경 효과 HTML
const SKY = {
  'clear-day': () => ({ cls: '', html: layer(`${SUN}${clouds(2)}`) }),
  'clear-night': () => ({ cls: 'sky--stars', html: layer(`${particles('stars', PARTICLE_COUNT.stars)}${clouds(1)}`) }),
  cloudy: () => ({ cls: '', html: layer(clouds(3)) }),
  'cloudy-night': () => ({ cls: '', html: layer(clouds(3)) }),
  rain: () => ({ cls: 'sky--rain', html: `${layer(clouds(2))}${particles('rain', PARTICLE_COUNT.rain)}` }),
  snow: () => ({ cls: 'sky--snow', html: `${layer(clouds(2))}${particles('snow', PARTICLE_COUNT.snow)}` }),
  thunder: () => ({
    cls: 'sky--rain',
    html: `${layer(clouds(3))}${particles('rain', PARTICLE_COUNT.rain)}<div class="sky__flash"></div>`,
  }),
  fog: () => ({ cls: '', html: layer(bands(3)) }),
  'fog-night': () => ({ cls: '', html: layer(bands(3)) }),
};

let skyEl = null;
let current = null;

// 테마 이름을 직접 적용한다
export function applyTheme(theme) {
  const name = THEMES.includes(theme) ? theme : DEFAULT_THEME;
  if (name === current) return;
  const isFirst = current === null;
  current = name;

  const root = document.documentElement;
  // 처음 적용할 때는 색 전환 애니메이션 없이 바로 바꾼다 (기본 파랑이 잠깐 보이지 않게)
  if (isFirst) {
    root.classList.add('theme-instant');
    // requestAnimationFrame은 탭이 숨겨지면 멈추므로 타이머를 쓴다
    setTimeout(() => root.classList.remove('theme-instant'), 50);
  }
  root.dataset.theme = name;

  if (!skyEl) {
    skyEl = document.createElement('div');
    skyEl.setAttribute('aria-hidden', 'true');
    document.getElementById('app').prepend(skyEl);
  }
  const { cls, html } = SKY[name]();
  skyEl.className = `sky ${cls}`.trim();
  skyEl.innerHTML = html;

  // 모바일 브라우저 상단 바 색도 맞춘다
  const top = getComputedStyle(document.documentElement).getPropertyValue('--bg-top').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', top);
}

// weatherState에서 테마를 골라 적용한다. 데이터가 없으면(로딩/오류) 지금 테마를 유지한다.
// 첫 데이터가 오기 전에는 테마를 정하지 않는다 (기본 CSS 값이 보이고, 첫 테마는 전환 없이 적용).
export function applyThemeFromState(state) {
  const c = state.forecast?.current;
  if (state.status !== 'ready' || !c) {
    if (!current && state.status === 'error') applyTheme(DEFAULT_THEME);
    return;
  }
  const info = describeWeather(c.weather_code, c.is_day);
  applyTheme(info ? info.theme : DEFAULT_THEME);
}

export function currentTheme() {
  return current;
}
