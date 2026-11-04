// 이 파일이 하는 일: 위도/경도로 Open-Meteo 예보(현재, 시간별, 일별)를 받아온다.

import { fetchJson } from './fetchJson.js';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

const CURRENT_VARS = ['temperature_2m', 'apparent_temperature', 'weather_code', 'wind_speed_10m', 'is_day'];
const HOURLY_VARS = [
  'temperature_2m',
  'apparent_temperature',
  'precipitation_probability',
  'precipitation',
  'snowfall',
  'weather_code',
  'wind_speed_10m',
  'uv_index',
  'is_day', // 시간대 그리드의 낮/밤 아이콘용 (명세 외 추가, 2026-11 호출로 유효 확인)
];
const DAILY_VARS = ['temperature_2m_max', 'temperature_2m_min', 'uv_index_max', 'precipitation_sum'];

// 앱이 기대하는 단위. 응답 단위가 다르면 콘솔에 경고한다.
const EXPECTED_UNITS = {
  temperature_2m: '°C',
  apparent_temperature: '°C',
  wind_speed_10m: 'm/s',
  precipitation: 'mm',
  precipitation_probability: '%',
  snowfall: 'cm',
};

function checkUnits(units, label) {
  Object.entries(EXPECTED_UNITS).forEach(([key, expected]) => {
    if (units?.[key] !== undefined && units[key] !== expected) {
      console.warn(`[weather] ${label}.${key} 단위가 예상(${expected})과 다릅니다: ${units[key]}`);
    }
  });
}

export async function fetchForecast(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    timezone: 'Asia/Seoul',
    wind_speed_unit: 'ms',
    current: CURRENT_VARS.join(','),
    hourly: HOURLY_VARS.join(','),
    daily: DAILY_VARS.join(','),
    forecast_days: '2', // 내일 기준 추천에 필요
  });

  const body = await fetchJson(`${FORECAST_URL}?${params}`);
  checkUnits(body.current_units, 'current');
  checkUnits(body.hourly_units, 'hourly');

  return {
    timezone: body.timezone,
    current: body.current, // current.time 이 앱의 "현재 시각" 기준
    currentUnits: body.current_units,
    hourly: body.hourly, // { time: [...48개], temperature_2m: [...], ... }
    hourlyUnits: body.hourly_units,
    daily: body.daily, // { time: ['오늘', '내일'], ... }
    dailyUnits: body.daily_units,
  };
}
