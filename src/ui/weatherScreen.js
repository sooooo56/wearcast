// 이 파일이 하는 일: SCREEN 01 WEATHER 화면을 그린다.
// 항상 "지금" 기준(current.time)이다. 내일 기준 추천과 상관없이 현재 날씨를 보여준다.
// 순서(애플 날씨 앱의 구조 참고): 히어로(지역명 -> 기온 -> 날씨 라벨 -> 최고/최저)
//   -> 시간대 24칸(옆으로 밀어서 확인) -> 미세먼지(넓은 타일) -> 낱개 타일 2열(체감/자외선/바람/강수) -> 출처

import { retry } from '../state.js';
import { describeWeather } from '../data/weatherCodes.js';
import { UV_LEVELS, HOURLY_CELLS, HOURLY_POP_SHOW_MIN } from '../logic/thresholds.js';
import { icon } from './icons.js';
import { statusCard } from './statusCards.js';
import { sourceLine } from './attribution.js';
import { uvGauge, popGauge, windGauge, pmGauge, pmGrade, compass, windDirectionLabel } from './gauges.js';

const NO_DATA = '정보 없음';

const has = (v) => v !== null && v !== undefined && !Number.isNaN(v);
const round = (v) => (has(v) ? Math.round(v) : null);
const deg = (v) => (has(v) ? `${Math.round(v)}°` : NO_DATA);

// 지역 이름은 검색 결과에서 오므로 HTML에 넣기 전에 특수문자를 바꾼다
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

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
    const today = c.time.slice(0, 10);
    for (let i = hi; i < Math.min(hi + HOURLY_CELLS, h.time.length); i += 1) {
      const hour = hourOf(h.time[i]);
      // 자정(0시)에는 날짜가 바뀐 것을 "내일"로 알려준다 (예보가 2일치라 모레는 없음)
      const isNextDay = h.time[i].slice(0, 10) !== today;
      hours.push({
        label: i === hi ? '지금' : isNextDay && hour === 0 ? '내일' : `${hour}시`,
        isDayBreak: i !== hi && isNextDay && hour === 0,
        weather: describeWeather(h.weather_code[i], h.is_day?.[i]),
        pop: at(h.precipitation_probability, i),
        temp: at(h.temperature_2m, i),
      });
    }
  }

  return {
    place: state.region?.name ?? null,
    time: c.time,
    temp: c.temperature_2m ?? null,
    feels: c.apparent_temperature ?? null,
    weather: describeWeather(c.weather_code, c.is_day),
    max: at(d.temperature_2m_max, di),
    min: at(d.temperature_2m_min, di),
    pop: at(h.precipitation_probability, hi),
    precipSum: at(d.precipitation_sum, di),
    wind: c.wind_speed_10m ?? null,
    windDir: c.wind_direction_10m ?? null,
    uv: at(h.uv_index, hi),
    uvMax: at(d.uv_index_max, di),
    pm10: at(air?.hourly.pm10, ai),
    pm25: at(air?.hourly.pm2_5, ai),
    hours,
  };
}

// 스크롤하면 히어로가 흐려지며 줄어들고, 이 작은 알약이 상단에 남는다 (애플 날씨처럼). 높이 0이라 레이아웃을 밀지 않는다
function renderHeroCompact(v) {
  if (!has(v.temp)) return '';
  return `<div class="hero-compact" aria-hidden="true"><span class="hero-compact__pill">${round(v.temp)}° · ${v.weather ? v.weather.label : NO_DATA}</span></div>`;
}

function renderHero(v) {
  const tempText = has(v.temp) ? `${round(v.temp)}<span class="hero__unit">°</span>` : NO_DATA;
  return `
    <section class="hero" aria-label="현재 날씨">
      ${v.place ? `<p class="hero__place">${escapeHtml(v.place)}</p>` : ''}
      <p class="hero__temp${has(v.temp) ? '' : ' hero__temp--empty'}">${tempText}</p>
      <p class="hero__label">${v.weather ? v.weather.label : NO_DATA}</p>
      <p class="hero__range">최고 ${deg(v.max)} · 최저 ${deg(v.min)}</p>
    </section>
  `;
}

// 시간대 칸의 강수확률: 낮으면 자리를 비워 두고(줄 높이는 유지), 값이 없으면 "정보 없음"
function popCell(pop) {
  if (!has(pop)) return NO_DATA;
  return pop >= HOURLY_POP_SHOW_MIN ? `${pop}%` : '';
}

function renderHourly(hours) {
  if (!hours.length) return `<p class="card hourly hourly--empty">시간별 예보 ${NO_DATA}</p>`;
  const cells = hours
    .map(
      (hr) => `
      <li class="hourly__cell${hr.isDayBreak ? ' is-day-break' : ''}">
        <span class="hourly__time">${hr.label}</span>
        ${hr.weather ? icon(hr.weather.icon, 'icon hourly__icon') : '<span class="hourly__icon hourly__icon--none"></span>'}
        <span class="sr-only">${hr.weather ? hr.weather.label : `날씨 ${NO_DATA}`}</span>
        <span class="hourly__pop">${popCell(hr.pop)}</span>
        <span class="hourly__temp">${deg(hr.temp)}</span>
      </li>`,
    )
    .join('');
  // 24시간 내내 보여줄 강수확률이 없으면 그 줄을 통째로 뺀다 (빈 줄이 남지 않게)
  const dry = hours.every((hr) => popCell(hr.pop) === '');
  return `
    <section class="card hourly${dry ? ' hourly--dry' : ''}" aria-label="시간별 예보 (옆으로 밀어서 이후 시간 확인)">
      <h2 class="card__head">${icon('clock', 'icon card__head-icon')}시간별 예보<span class="card__head-hint">옆으로 밀어서 보기</span></h2>
      <!-- swiper-no-swiping: 이 줄 위에서는 화면 전환 대신 시간대가 옆으로 움직인다 -->
      <div class="hourly__scroll swiper-no-swiping" tabindex="0" role="group" aria-label="시간별 예보, 좌우로 스크롤">
        <ol class="hourly__grid">${cells}</ol>
      </div>
    </section>
  `;
}

// 마우스(PC)로도 끌어서 옆으로 넘길 수 있게 한다 (터치는 브라우저 기본 스크롤을 쓴다)
function enableDragScroll(el) {
  let startX = 0;
  let startLeft = 0;
  let dragging = false;
  let lastX = 0;
  let lastT = 0;
  let velocity = 0; // px/ms, 손을 뗀 뒤에도 이 속도로 미끄러진다 (관성)
  let raf = 0;

  const stopInertia = () => cancelAnimationFrame(raf);

  // 손을 뗀 뒤 속도가 서서히 줄어들며 계속 움직인다 (터치는 브라우저가 알아서 관성을 준다)
  const glide = () => {
    let v = velocity * 16; // 한 프레임(약 16ms)에 움직일 거리
    const step = () => {
      const before = el.scrollLeft;
      el.scrollLeft += v;
      v *= 0.94;
      const hitEnd = el.scrollLeft === before; // 양 끝에 닿으면 멈춤
      if (Math.abs(v) > 0.3 && !hitEnd) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };

  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    stopInertia();
    dragging = true;
    startX = lastX = e.clientX;
    startLeft = el.scrollLeft;
    lastT = performance.now();
    velocity = 0;
    el.setPointerCapture(e.pointerId); // 요소 밖으로 나가도 계속 따라온다
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 3) el.classList.add('is-dragging');
    el.scrollLeft = startLeft - dx;
    const now = performance.now();
    const dt = now - lastT;
    if (dt > 0) velocity = velocity * 0.6 + ((lastX - e.clientX) / dt) * 0.4; // 최근 움직임에 더 무게
    lastX = e.clientX;
    lastT = now;
  });
  const stop = () => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('is-dragging');
    // 멈춘 채로 손을 뗐으면 관성 없음
    if (performance.now() - lastT < 80 && Math.abs(velocity) > 0.05) glide();
  };
  el.addEventListener('pointerup', stop);
  el.addEventListener('pointercancel', stop);
  // 휠/터치로 직접 움직이면 진행 중인 관성은 멈춘다
  el.addEventListener('wheel', stopInertia, { passive: true });
  el.addEventListener('touchstart', stopInertia, { passive: true });
}

// 체감온도 타일의 설명: 화면에 보이는 반올림 값끼리 비교한다 (숫자와 문장이 어긋나지 않게)
function feelsNote(feels, temp) {
  if (!has(feels) || !has(temp)) return 'Open-Meteo 모델 계산값';
  const diff = Math.round(feels) - Math.round(temp);
  if (diff === 0) return '실제 기온과 비슷해요';
  return `실제 기온보다 ${Math.abs(diff)}° ${diff > 0 ? '높게' : '낮게'} 느껴져요`;
}

// 타일 한 장: 제목 -> 값 -> (막대) -> 보조 설명. extra는 오른쪽 위에 놓이는 작은 그림(나침반), wide는 두 칸 폭
function detail(iconName, title, value, sub, gauge = '', extra = '', wide = false) {
  return `
    <div class="card detail${wide ? ' detail--wide' : ''}">
      <p class="detail__title">${icon(iconName, 'icon detail__icon')}${title}</p>
      <div class="detail__main">
        <p class="detail__value">${value}</p>
        ${extra}
      </div>
      ${gauge}
      <p class="detail__sub">${sub}</p>
    </div>
  `;
}

function renderDetails(v) {
  const uvText = has(v.uv) ? `${oneDecimal(v.uv)} <small>${uvLevel(v.uv)}</small>` : NO_DATA;
  const grade = pmGrade(v.pm10, v.pm25);
  const pmText = grade
    ? `${grade.label} <small>${grade.name}</small>`
    : NO_DATA;
  const pmSub = grade
    ? `PM10 ${has(v.pm10) ? round(v.pm10) : NO_DATA} · PM2.5 ${has(v.pm25) ? round(v.pm25) : NO_DATA} ㎍/㎥ · 예측 기반 참고값`
    : '예측 기반 참고값';
  const dirLabel = windDirectionLabel(v.windDir);
  const windSub = dirLabel ? `${dirLabel}풍 · 현재` : has(v.windDir) ? '현재' : `풍향 ${NO_DATA}`;

  return `
    <section class="details" aria-label="상세 날씨">
      ${detail('face-mask', '미세먼지', pmText, pmSub, pmGauge(grade), '', true)}
      ${detail('thermometer', '체감 온도', deg(v.feels), feelsNote(v.feels, v.temp))}
      ${detail('sun', '자외선 지수', uvText, has(v.uvMax) ? `오늘 최고 ${oneDecimal(v.uvMax)}` : `오늘 최고 ${NO_DATA}`, uvGauge(v.uv))}
      ${detail('wind', '바람', has(v.wind) ? `${oneDecimal(v.wind)}<small> m/s</small>` : NO_DATA, windSub, windGauge(v.wind), compass(v.windDir))}
      ${detail(
        'umbrella',
        '강수확률',
        has(v.pop) ? `${v.pop}%` : NO_DATA,
        has(v.precipSum) ? `오늘 강수량 ${oneDecimal(v.precipSum)}mm` : `오늘 강수량 ${NO_DATA}`,
        popGauge(v.pop),
      )}
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
    ${renderHeroCompact(v)}
    ${renderHero(v)}
    ${renderHourly(v.hours)}
    ${renderDetails(v)}
    <p class="source">${updated}${airNote}<br />${sourceText}</p>
  `;
}

// 스크롤 위치(0 ~ HERO_COLLAPSE_PX)를 0~1로 바꿔 --hero-p 변수로 넘긴다. CSS가 이 값으로 히어로를 줄인다
const HERO_COLLAPSE_PX = 140;

function trackHeroCollapse(container) {
  let queued = false;
  const update = () => {
    queued = false;
    const p = Math.min(1, Math.max(0, container.scrollTop / HERO_COLLAPSE_PX));
    container.style.setProperty('--hero-p', p.toFixed(3));
  };
  // onscroll에 대입하므로 다시 그려도 리스너가 쌓이지 않는다
  container.onscroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };
  update();
}

export function renderWeatherScreen(container, state) {
  const body =
    statusCard(state, { loading: '날씨를 불러오는 중...', failed: '날씨 정보를 불러오지 못했습니다.' }) ??
    renderReady(state);

  container.innerHTML = `<div class="screen__inner weather">${body}</div>`;
  container.querySelector('[data-retry]')?.addEventListener('click', retry);
  const strip = container.querySelector('.hourly__scroll');
  if (strip) enableDragScroll(strip);
  trackHeroCollapse(container);
}
