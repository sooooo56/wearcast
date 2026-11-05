// 이 파일이 하는 일: 현재 날씨 코드로 배경 테마를 정하고, <html data-theme>와 배경 효과 레이어(.sky)를 바꾼다.
// 세 화면이 같은 테마를 쓴다. 테마는 항상 "지금" 날씨 기준이다 (내일 기준 추천과 무관).
// 효과 구성: 구름/해(skyClouds.js, CSS로 천천히 흐름) + 비/눈/별/번개(skyFx.js, 캔버스).
// 비/눈의 양은 날씨 코드의 강도(가랑비~폭우)를, 기울기와 구름 속도는 풍속을 따른다.

import { describeWeather, intensityOf } from '../data/weatherCodes.js';
import { cloudsHtml, sunHtml } from './skyClouds.js';
import { setSkyFx } from './skyFx.js';

export const THEMES = ['clear-day', 'clear-night', 'cloudy', 'cloudy-night', 'rain', 'snow', 'thunder', 'fog', 'fog-night'];
const DEFAULT_THEME = 'clear-day';

const WIND_FULL_MS = 12; // 이 풍속(m/s) 이상이면 바람 효과를 최대로

// 화면을 넘길 때 살짝 따라 움직이는 뒤쪽 층
const layer = (html) => `<div class="sky__layer">${html}</div>`;

// 테마별 효과: html(구름/해/안개 등), fx(캔버스 효과 종류), cls(추가 클래스)
const SKY = {
  'clear-day': (o) => ({ cls: '', fx: null, html: layer(`${sunHtml()}${cloudsHtml('clear-day', o.wind)}`) }),
  'clear-night': (o) => ({ cls: '', fx: 'stars', html: layer(cloudsHtml('clear-night', o.wind)) }),
  cloudy: (o) => ({ cls: '', fx: null, html: layer(cloudsHtml('cloudy', o.wind)) }),
  'cloudy-night': (o) => ({ cls: '', fx: null, html: layer(cloudsHtml('cloudy-night', o.wind)) }),
  rain: (o) => ({ cls: 'sky--stormy', fx: 'rain', html: layer(cloudsHtml('rain', o.wind)) }),
  snow: (o) => ({ cls: '', fx: 'snow', html: layer(cloudsHtml('snow', o.wind)) }),
  thunder: (o) => ({ cls: 'sky--stormy', fx: 'thunder', html: layer(cloudsHtml('thunder', o.wind)) }),
  fog: (o) => ({ cls: 'sky--hazy', fx: null, html: layer(cloudsHtml('fog', o.wind)) }),
  'fog-night': (o) => ({ cls: 'sky--hazy', fx: null, html: layer(cloudsHtml('fog-night', o.wind)) }),
};

let skyEl = null;
let currentKey = null; // 테마 + 강도 + 바람 세기. 하나라도 바뀌면 효과를 다시 만든다
let currentName = null;

// 테마 이름을 직접 적용한다. opts: { intensity: 'light'|'normal'|'heavy', wind: 0~1 }
export function applyTheme(theme, opts = {}) {
  const name = THEMES.includes(theme) ? theme : DEFAULT_THEME;
  const intensity = opts.intensity ?? 'normal';
  const wind = Math.round((opts.wind ?? 0) * 4) / 4; // 0, .25, .5, .75, 1 단위로 묶어서 자잘한 변화에 다시 만들지 않음
  const key = `${name}|${intensity}|${wind}`;
  if (key === currentKey) return;

  const isFirst = currentName === null;
  const themeChanged = name !== currentName;
  currentKey = key;
  currentName = name;

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
  const { cls, html, fx } = SKY[name]({ wind, intensity });
  skyEl.className = `sky ${cls}`.trim();
  skyEl.innerHTML = html; // 캔버스도 지워지므로 아래에서 다시 만든다
  setSkyFx(skyEl, fx, { intensity, wind });

  // 모바일 브라우저 상단 바 색도 맞춘다 (테마가 바뀐 경우만)
  if (themeChanged) {
    const top = getComputedStyle(document.documentElement).getPropertyValue('--bg-top').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', top);
  }
}

// weatherState에서 테마를 골라 적용한다. 데이터가 없으면(로딩/오류) 지금 테마를 유지한다.
// 첫 데이터가 오기 전에는 테마를 정하지 않는다 (기본 CSS 값이 보이고, 첫 테마는 전환 없이 적용).
export function applyThemeFromState(state) {
  const c = state.forecast?.current;
  if (state.status !== 'ready' || !c) {
    if (!currentName && state.status === 'error') applyTheme(DEFAULT_THEME);
    return;
  }
  const info = describeWeather(c.weather_code, c.is_day);
  const wind = Number.isFinite(c.wind_speed_10m) ? Math.min(1, Math.max(0, c.wind_speed_10m / WIND_FULL_MS)) : 0;
  applyTheme(info ? info.theme : DEFAULT_THEME, { intensity: intensityOf(c.weather_code), wind });
}

export function currentTheme() {
  return currentName;
}
