// 이 파일이 하는 일: 외출 시간대의 시간별 예보를 요약해 summary 객체를 만든다 (CLAUDE.md 7번).
//
// 추천 대상 날짜(targetDate):
// - 현재 시 < endHour  -> 오늘. 이미 시작된 구간이면 "현재 시 ~ endHour"만 본다 (지난 시간의 비로 우산 추천 안 함)
// - 현재 시 >= endHour -> 내일. startHour ~ endHour 전체를 본다
// "현재 시각"은 기기 시계가 아니라 예보 응답의 current.time 이다 (테스트에서는 nowTime으로 주입).

import { DEFAULT_WINDOW, RAIN_POP_PERCENT } from './thresholds.js';

const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const THUNDER_CODES = new Set([95, 96, 99]);

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const r1 = (v) => Math.round(v * 10) / 10;

// 숫자만 골라 최소/최대/합계. 값이 하나도 없으면 null
function stats(values) {
  const nums = values.filter(isNum);
  if (!nums.length) return { min: null, max: null, sum: null };
  return { min: Math.min(...nums), max: Math.max(...nums), sum: r1(nums.reduce((a, v) => a + v, 0)) };
}

// "2026-11-04" 다음 날
function nextDate(date) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const slotKey = (date, hour) => `${date}T${String(hour).padStart(2, '0')}:00`;

/**
 * @param {object} forecast  api/weather.js 결과 (또는 같은 모양의 데모 데이터)
 * @param {object|null} air  api/airQuality.js 결과 (없으면 null)
 * @param {object} [options]
 * @param {{startHour:number,endHour:number}} [options.window]  외출 시간대
 * @param {string} [options.nowTime]  "YYYY-MM-DDTHH:MM" (기본: forecast.current.time)
 * @returns {object|null} summary. 필요한 시간별 데이터가 없으면 null
 */
export function summarize(forecast, air, { window = DEFAULT_WINDOW, nowTime } = {}) {
  const now = nowTime ?? forecast?.current?.time;
  if (!now) return null;

  const today = now.slice(0, 10);
  const nowHour = Number(now.slice(11, 13));
  const isTomorrow = nowHour >= window.endHour;
  const targetDate = isTomorrow ? nextDate(today) : today;
  const startHour = isTomorrow ? window.startHour : Math.max(window.startHour, nowHour);
  const endHour = window.endHour;

  // 시간별 배열에서 구간에 해당하는 인덱스 찾기 (start..end 모두 포함)
  const h = forecast.hourly;
  const indexes = [];
  for (let hour = startHour; hour <= endHour; hour += 1) {
    const i = h.time.indexOf(slotKey(targetDate, hour));
    if (i >= 0) indexes.push(i);
  }
  if (!indexes.length) return null;

  const pick = (arr) => indexes.map((i) => (arr ? arr[i] : null));
  const airPick = (key) => {
    if (!air?.hourly?.[key]) return [];
    return indexes.map((i) => {
      const ai = air.hourly.time.indexOf(h.time[i]);
      return ai >= 0 ? air.hourly[key][ai] : null;
    });
  };

  const feels = pick(h.apparent_temperature);
  const temps = pick(h.temperature_2m);
  const codes = pick(h.weather_code);
  const feelsStats = stats(feels);
  const tempStats = stats(temps);

  // 체감 최저/최고가 나온 시각 (이유 문장의 "아침/낮/저녁"용)
  const hourAt = (pos) => Number(h.time[indexes[pos]].slice(11, 13));
  const feelsMinHour = isNum(feelsStats.min) ? hourAt(feels.indexOf(feelsStats.min)) : null;
  const feelsMaxHour = isNum(feelsStats.max) ? hourAt(feels.indexOf(feelsStats.max)) : null;
  const firstFeels = feels.find(isNum) ?? null;
  const lastFeels = [...feels].reverse().find(isNum) ?? null;

  // 일 단위 값은 targetDate의 인덱스로 읽는다 (0번째 고정 아님)
  const di = forecast.daily?.time?.indexOf(targetDate) ?? -1;
  const dMax = di >= 0 ? forecast.daily.temperature_2m_max?.[di] : null;
  const dMin = di >= 0 ? forecast.daily.temperature_2m_min?.[di] : null;

  return {
    targetDate,
    isTomorrow,
    startHour: hourAt(0),
    endHour: hourAt(indexes.length - 1),
    hoursUsed: indexes.length,

    feelsMin: feelsStats.min,
    feelsMax: feelsStats.max,
    feelsMinHour,
    feelsMaxHour,
    feelsStart: firstFeels,
    feelsEnd: lastFeels,
    tempMin: tempStats.min,
    tempMax: tempStats.max,
    dailyRange: isNum(dMax) && isNum(dMin) ? r1(dMax - dMin) : null,

    popMax: stats(pick(h.precipitation_probability)).max,
    precipSum: stats(pick(h.precipitation)).sum,
    snowSum: stats(pick(h.snowfall)).sum,
    windMax: stats(pick(h.wind_speed_10m)).max,
    uvMax: stats(pick(h.uv_index)).max,
    pm10Max: stats(airPick('pm10')).max,
    pm25Max: stats(airPick('pm2_5')).max,
    dustMax: stats(airPick('dust')).max,

    // 비가 오거나(강수량 > 0) 강수확률이 높은 시각 목록 (준비물 근거 "오후 비 예보"용)
    rainHours: indexes
      .filter((i) => (isNum(h.precipitation?.[i]) && h.precipitation[i] > 0) || (isNum(h.precipitation_probability?.[i]) && h.precipitation_probability[i] >= RAIN_POP_PERCENT))
      .map((i) => Number(h.time[i].slice(11, 13))),

    hasSnowCode: codes.some((c) => SNOW_CODES.has(c)),
    hasThunder: codes.some((c) => THUNDER_CODES.has(c)),
  };
}
