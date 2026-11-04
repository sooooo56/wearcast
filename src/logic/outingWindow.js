// 이 파일이 하는 일: 외출 시간대(outingWindow)의 프리셋, 검사, 저장/불러오기 (CLAUDE.md 7번).
// 시간대는 1시간 단위, 같은 날 안에서만 (0 <= start < end <= 23). 자정을 넘기는 시간대는 2차 범위.

import { DEFAULT_WINDOW, MIN_WINDOW_HOURS } from './thresholds.js';

const STORAGE_KEY = 'wearcast:window';

export const WINDOW_PRESETS = [
  { id: 'day', label: '낮 외출', startHour: 8, endHour: 19 },
  { id: 'evening', label: '저녁 외출', startHour: 18, endHour: 23 },
];

export const MIN_HOUR = 0;
export const MAX_HOUR = 23;

// 시작/종료가 규칙에 맞는지
export function isValidWindow(w) {
  return (
    Boolean(w) &&
    Number.isInteger(w.startHour) &&
    Number.isInteger(w.endHour) &&
    w.startHour >= MIN_HOUR &&
    w.endHour <= MAX_HOUR &&
    w.endHour - w.startHour >= MIN_WINDOW_HOURS
  );
}

// 시작/종료 값으로 프리셋 id를 찾는다. 프리셋과 다르면 'custom'
export function presetIdOf(w) {
  return WINDOW_PRESETS.find((p) => p.startHour === w.startHour && p.endHour === w.endHour)?.id ?? 'custom';
}

// 잘못된 값이면 기본 시간대로 바꾼다
export function normalizeWindow(w) {
  if (!isValidWindow(w)) return { ...DEFAULT_WINDOW };
  return { startHour: w.startHour, endHour: w.endHour };
}

export function loadWindow(storage = globalThis.localStorage) {
  try {
    return normalizeWindow(JSON.parse(storage.getItem(STORAGE_KEY)));
  } catch {
    return { ...DEFAULT_WINDOW };
  }
}

export function saveWindow(w, storage = globalThis.localStorage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...normalizeWindow(w), preset: presetIdOf(w) }));
  } catch {
    // 저장 실패해도 앱은 계속 동작
  }
}
