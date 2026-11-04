// 이 파일이 하는 일: 앱 전체가 공유하는 weatherState 객체 하나를 보관하고, 바뀔 때 화면들에 알린다.
// 세 화면은 이 상태만 읽는다. 화면을 넘겨도 API를 다시 부르지 않는다.

import { fetchForecast } from './api/weather.js';
import { fetchAirQuality } from './api/airQuality.js';
import { makeDemoWeather } from './data/demoWeather.js';
import { loadWindow, saveWindow, normalizeWindow } from './logic/outingWindow.js';

export const weatherState = {
  status: 'idle', // 'idle' | 'loading' | 'ready' | 'error'
  source: 'live', // 'live' = 실제 API 데이터, 'demo' = data/demoWeather.js 샘플
  region: null, // { name, admin1, latitude, longitude, ... }
  forecast: null, // api/weather.js 결과
  air: null, // api/airQuality.js 결과 (실패하면 null)
  airError: null, // 대기질만 실패했을 때 메시지
  error: null, // 예보 실패 메시지
  fetchedAt: null,
  outingWindow: loadWindow(), // { startHour, endHour } 사용자가 고른 외출 시간대 (localStorage)
};

const listeners = new Set();

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function update(patch) {
  Object.assign(weatherState, patch);
  listeners.forEach((fn) => fn(weatherState));
}

// 지역을 받아 예보 + 대기질을 함께 불러온다.
// 지역을 빠르게 여러 번 바꿔도 마지막 요청 결과만 반영한다.
let requestSeq = 0;
export let fetchCount = 0; // 개발용: API 호출 횟수 확인

export async function loadRegion(region) {
  const seq = ++requestSeq;
  fetchCount += 1;
  update({ status: 'loading', source: 'live', region, error: null, airError: null });

  const { latitude, longitude } = region;
  const [forecastResult, airResult] = await Promise.allSettled([
    fetchForecast(latitude, longitude),
    fetchAirQuality(latitude, longitude),
  ]);
  if (seq !== requestSeq) return; // 더 최근 요청이 있으면 버림

  // 예보가 실패하면 화면 전체를 오류 상태로 (가짜 값으로 채우지 않음)
  if (forecastResult.status === 'rejected') {
    update({
      status: 'error',
      forecast: null,
      air: null,
      error: forecastResult.reason.message,
    });
    return;
  }

  // 대기질만 실패하면 날씨는 보여주고 미세먼지는 "정보 없음"
  update({
    status: 'ready',
    forecast: forecastResult.value,
    air: airResult.status === 'fulfilled' ? airResult.value : null,
    airError: airResult.status === 'rejected' ? airResult.reason.message : null,
    fetchedAt: new Date().toISOString(),
  });

  console.info('[state] weatherState 갱신', weatherState);
}

export function retry() {
  if (weatherState.region && !weatherState.region.isDemo) loadRegion(weatherState.region);
}

// 외출 시간대를 바꾼다. API는 부르지 않고, 구독 중인 화면이 이미 받은 데이터로 다시 계산한다.
export function setOutingWindow(w) {
  const next = normalizeWindow(w);
  saveWindow(next);
  update({ outingWindow: next });
}

// 데이터를 비우고 "지역 미선택" 상태로 돌아간다 (데모 끄기 등). 진행 중인 요청 결과도 버린다.
export function clearData() {
  ++requestSeq;
  update({ status: 'idle', source: 'live', region: null, forecast: null, air: null, error: null, airError: null });
}

// 데모 샘플 데이터를 넣는다 (API 호출 없음). 화면에는 "데모 데이터" 배지가 표시된다.
export function loadDemo(scenarioKey) {
  ++requestSeq; // 진행 중인 실제 요청 결과가 덮어쓰지 않게 함
  const demo = makeDemoWeather(scenarioKey);
  update({
    status: 'ready',
    source: 'demo',
    region: demo.region,
    forecast: demo.forecast,
    air: demo.air,
    error: null,
    airError: null,
    fetchedAt: null,
  });
}
