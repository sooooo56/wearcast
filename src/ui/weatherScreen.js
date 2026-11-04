// 이 파일이 하는 일: SCREEN 01 WEATHER 화면을 그린다.
// 항상 "지금" 기준(current.time)이다. 내일 기준 추천과 상관없이 현재 날씨를 보여준다.
// 순서: 히어로(기온 -> 날씨 라벨 -> 최고/최저 · 체감) -> 시간대 6칸 -> 2x2 상세 카드 -> 출처

import { retry } from '../state.js';
import { describeWeather } from '../data/weatherCodes.js';
import { UV_LEVELS, HOURLY_GRID_CELLS } from '../logic/thresholds.js';
import { icon } from './icons.js';
import { statusCard } from './statusCards.js';
import { sourceLine } from './attribution.js';

const NO_DATA = '정보 없음';

const has = (v) => v !== null && v !== undefined && !Number.isNaN(v);
const round = (v) => (has(v) ? Math.round(v) : null);
const deg = (v) => (has(v) ? `${Math.round(v)}°` : NO_DATA);

// 소수 한 자리까지, 끝의 .0은 뺀다 (1.43 -> 1.4, 2.0 -> 2)
const oneDecimal = (v) => (has(v) ? String(Math.round(v * 10) / 10) : null);

function uvLevel(uv) {
  if (!has(uv)) return null;
  return UV_LEVELS.find((l) => uv >= l.min)?.label ?? null;
}

// "2026-11-04T23:15" -> "2026-11-04T23:00"
const toHourKey = (time) => `${time.slice(0, 13)}:00`;
const hourOf = (time) => Number(time.slice(11, 13));

// 화면에 필요한 값만 뽑아 정리한다. 값이 없으면 null.
export function pickWeatherView(state) {
  const { forecast, air } = state;
  const c = forecast.current;
  const h = forecast.hourly;
  const d = forecast.daily;

  const hourKey = toHourKey(c.time);
  const hi = h.time.indexOf(hourKey);
  const di = d.time.indexOf(c.time.slice(0, 10)); // 일별 값은 날짜로 찾는다 (0번째 고정 아님)
  const ai = air ? air.hourly.time.indexOf(hourKey) : -1;
  const at = (arr, i) => (i >= 0 && arr ? arr[i] ?? null : null);

  const hours = [];
  if (hi >= 0) {
    for (let i = hi; i < Math.min(hi + HOURLY_GRID_CELLS, h.time.length); i += 1) {
      hours.push({
        label: i === hi ? '지금' : `${hourOf(h.time[i])}시`,
        weather: describeWeather(h.weather_code[i], h.is_day?.[i]),
        pop: at(h.precipitation_probability, i),
        temp: at(h.temperature_2m, i),
      });
    }
  }

  return {
    time: c.time,
    temp: c.temperature_2m ?? null,
    feels: c.apparent_temperature ?? null,
    weather: describeWeather(c.weather_code, c.is_day),
    max: at(d.temperature_2m_max, di),
    min: at(d.temperature_2m_min, di),
    pop: at(h.precipitation_probability, hi),
    precipSum: at(d.precipitation_sum, di),
    wind: c.wind_speed_10m ?? null,
    uv: at(h.uv_index, hi),
    uvMax: at(d.uv_index_max, di),
    pm10: at(air?.hourly.pm10, ai),
    pm25: at(air?.hourly.pm2_5, ai),
    hours,
  };
}

function renderHero(v) {
  const tempText = has(v.temp) ? `${round(v.temp)}<span class="hero__unit">°</span>` : NO_DATA;
  return `
    <section class="hero" aria-label="현재 날씨">
      <p class="hero__temp${has(v.temp) ? '' : ' hero__temp--empty'}">${tempText}</p>
      <p class="hero__label">${v.weather ? v.weather.label : NO_DATA}</p>
      <p class="hero__range">최고 ${deg(v.max)} / 최저 ${deg(v.min)} · 체감 ${deg(v.feels)}</p>
    </section>
  `;
}

function renderHourly(hours) {
  if (!hours.length) return `<p class="card hourly hourly--empty">시간별 예보 ${NO_DATA}</p>`;
  const cells = hours
    .map(
      (hr) => `
      <li class="hourly__cell">
        <span class="hourly__time">${hr.label}</span>
        ${hr.weather ? icon(hr.weather.icon, 'icon hourly__icon') : '<span class="hourly__icon hourly__icon--none"></span>'}
        <span class="sr-only">${hr.weather ? hr.weather.label : `날씨 ${NO_DATA}`}</span>
        <span class="hourly__pop">${has(hr.pop) ? `${hr.pop}%` : NO_DATA}</span>
        <span class="hourly__temp">${deg(hr.temp)}</span>
      </li>`,
    )
    .join('');
  return `
    <section class="card hourly" aria-label="시간별 예보">
      <ol class="hourly__grid">${cells}</ol>
    </section>
  `;
}

function detail(iconName, title, value, sub) {
  return `
    <div class="detail">
      <p class="detail__title">${icon(iconName, 'icon detail__icon')}${title}</p>
      <p class="detail__value">${value}</p>
      <p class="detail__sub">${sub}</p>
    </div>
  `;
}

function renderDetails(v) {
  const uvText = has(v.uv) ? `${oneDecimal(v.uv)} <small>${uvLevel(v.uv)}</small>` : NO_DATA;
  const pmText =
    has(v.pm10) || has(v.pm25)
      ? `<span class="detail__pm"><small>PM10</small> ${has(v.pm10) ? round(v.pm10) : NO_DATA}</span>
         <span class="detail__pm"><small>PM2.5</small> ${has(v.pm25) ? round(v.pm25) : NO_DATA}</span>`
      : NO_DATA;

  return `
    <section class="card details" aria-label="상세 날씨">
      ${detail(
        'umbrella',
        '강수확률',
        has(v.pop) ? `${v.pop}%` : NO_DATA,
        has(v.precipSum) ? `오늘 강수량 ${oneDecimal(v.precipSum)}mm` : `오늘 강수량 ${NO_DATA}`,
      )}
      ${detail('wind', '풍속', has(v.wind) ? `${oneDecimal(v.wind)}<small> m/s</small>` : NO_DATA, '현재')}
      ${detail('sun', '자외선 지수', uvText, has(v.uvMax) ? `오늘 최고 ${oneDecimal(v.uvMax)}` : `오늘 최고 ${NO_DATA}`)}
      ${detail('face-mask', '미세먼지', pmText, '㎍/㎥ · 예측 기반 참고값')}
    </section>
  `;
}

function renderReady(state) {
  const v = pickWeatherView(state);
  const updated = `${v.time.slice(5, 10).replace('-', '/')} ${v.time.slice(11, 16)} 기준`;
  const airNote = state.air ? '' : ` · 대기질 ${NO_DATA}`;
  const sourceText =
    sourceLine(state, '체감온도·대기질은 모델 예측값');
  return `
    ${renderHero(v)}
    ${renderHourly(v.hours)}
    ${renderDetails(v)}
    <p class="source">${updated}${airNote}<br />${sourceText}</p>
  `;
}

export function renderWeatherScreen(container, state) {
  const body =
    statusCard(state, { loading: '날씨를 불러오는 중...', failed: '날씨 정보를 불러오지 못했습니다.' }) ??
    renderReady(state);

  container.innerHTML = `<div class="screen__inner weather">${body}</div>`;
  container.querySelector('[data-retry]')?.addEventListener('click', retry);
}
