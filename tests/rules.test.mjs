// 이 파일이 하는 일: 요약(summarize)과 옷차림 규칙(outfit)을 자동으로 검사한다. 실행: npm test
// 1) 오늘/내일 경계 (CLAUDE.md 11번 체크리스트)  2) 날씨 시나리오별 추천이 상식에 맞는지

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from '../src/logic/summarize.js';
import { recommendOutfit } from '../src/logic/outfit.js';
import { templateReason } from '../src/logic/explain.js';
import { makeDemoWeather } from '../src/data/demoWeather.js';

// 이틀치(48시간) 빈 예보를 만든다. 필요한 값만 채워서 쓴다.
function makeForecast(fill = {}) {
  const days = ['2026-11-04', '2026-11-05'];
  const time = days.flatMap((d) => Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, '0')}:00`));
  const arr = (fn) => time.map((t, i) => fn(Number(t.slice(11, 13)), i));
  return {
    current: { time: '2026-11-04T12:00' },
    hourly: {
      time,
      temperature_2m: arr(fill.temp ?? (() => 15)),
      apparent_temperature: arr(fill.feels ?? (() => 15)),
      precipitation_probability: arr(fill.pop ?? (() => 0)),
      precipitation: arr(fill.rain ?? (() => 0)),
      snowfall: arr(() => 0),
      weather_code: arr(() => 1),
      wind_speed_10m: arr(() => 2),
      uv_index: arr(() => 1),
    },
    daily: { time: days, temperature_2m_max: [18, 20], temperature_2m_min: [10, 12] },
  };
}

const win = (startHour, endHour) => ({ startHour, endHour });

// ---- 1) 오늘/내일 경계 ----
const BOUNDARY_CASES = [
  // [시간대, 현재 시각, 기대 결과]
  [win(8, 19), '2026-11-04T07:00', { isTomorrow: false, startHour: 8, endHour: 19 }],
  [win(8, 19), '2026-11-04T14:00', { isTomorrow: false, startHour: 14, endHour: 19 }],
  [win(8, 19), '2026-11-04T18:59', { isTomorrow: false, startHour: 18, endHour: 19 }],
  [win(8, 19), '2026-11-04T19:00', { isTomorrow: true, startHour: 8, endHour: 19 }],
  [win(18, 23), '2026-11-04T17:00', { isTomorrow: false, startHour: 18, endHour: 23 }],
  [win(18, 23), '2026-11-04T22:00', { isTomorrow: false, startHour: 22, endHour: 23 }],
  [win(18, 23), '2026-11-04T23:00', { isTomorrow: true, startHour: 18, endHour: 23 }],
  [win(8, 19), '2026-11-05T00:00', { isTomorrow: false, startHour: 8, endHour: 19 }], // 자정 직후 -> 다시 오늘
];

for (const [w, now, expected] of BOUNDARY_CASES) {
  test(`경계: ${w.startHour}~${w.endHour}시, 현재 ${now.slice(11)} -> ${expected.isTomorrow ? '내일' : '오늘'} ${expected.startHour}~${expected.endHour}`, () => {
    const s = summarize(makeForecast(), null, { window: w, nowTime: now });
    assert.equal(s.isTomorrow, expected.isTomorrow);
    assert.equal(s.startHour, expected.startHour);
    assert.equal(s.endHour, expected.endHour);
    const expectedDate = expected.isTomorrow ? '2026-11-05' : now.slice(0, 10);
    assert.equal(s.targetDate, expectedDate);
  });
}

test('내일 기준이면 일별 값을 내일 인덱스로 읽는다 (0번째 고정 아님)', () => {
  const s = summarize(makeForecast(), null, { nowTime: '2026-11-04T20:00' });
  assert.equal(s.dailyRange, 8); // 내일 20 - 12 (오늘이면 18 - 10 = 8이라 구분 안 되므로 아래도 확인)
  const f = makeForecast();
  f.daily.temperature_2m_max = [18, 30];
  const s2 = summarize(f, null, { nowTime: '2026-11-04T20:00' });
  assert.equal(s2.dailyRange, 18);
});

test('이미 지난 시간의 비는 요약에 넣지 않는다', () => {
  // 09~11시에만 비 90%. 현재 14시 -> 14~19시만 보므로 비 없음
  const f = makeForecast({ pop: (h) => (h >= 9 && h <= 11 ? 90 : 0), rain: (h) => (h >= 9 && h <= 11 ? 3 : 0) });
  const s = summarize(f, null, { nowTime: '2026-11-04T14:00' });
  assert.equal(s.popMax, 0);
  assert.equal(s.precipSum, 0);
});

test('값이 없으면 null로 두고, 옷차림 규칙은 깨지지 않는다', () => {
  const f = makeForecast();
  f.hourly.wind_speed_10m = f.hourly.wind_speed_10m.map(() => null);
  f.hourly.uv_index = undefined;
  const s = summarize(f, null, { nowTime: '2026-11-04T10:00' });
  assert.equal(s.windMax, null);
  assert.equal(s.uvMax, null);
  assert.equal(s.pm10Max, null);
  const rec = recommendOutfit(s);
  assert.ok(rec);
  assert.ok(!rec.adjustments.some((a) => a.rule === 'wind'));
});

// ---- 2) 날씨 시나리오 ----
function scenario(key) {
  const demo = makeDemoWeather(key);
  const s = summarize(demo.forecast, demo.air);
  return { s, rec: recommendOutfit(s) };
}

test('시나리오 맑음 더움: 반팔, 반바지/얇은 바지, 겉옷 없음', () => {
  const { rec } = scenario('clear-day');
  assert.equal(rec.outfit.top, 'short_sleeve');
  assert.ok(['shorts', 'thin_pants'].includes(rec.outfit.bottom));
  assert.equal(rec.outfit.outer, 'none');
  assert.equal(rec.outfit.shoes, 'sneakers');
});

test('시나리오 쌀쌀 + 강풍: 방풍 겉옷', () => {
  const { s, rec } = scenario('chilly-windy');
  assert.ok(s.windMax >= 7);
  assert.equal(rec.outfit.outer, 'windbreaker');
  assert.ok(['sweatshirt_knit', 'thin_long_sleeve'].includes(rec.outfit.top));
  assert.equal(rec.outfit.bottom, 'long_pants');
});

test('강풍이어도 코트/패딩은 그대로 둔다 (얇은 겉옷만 방풍 겉옷으로 교체)', () => {
  const f = makeForecast({ feels: () => 6 });
  f.hourly.wind_speed_10m = f.hourly.wind_speed_10m.map(() => 9);
  const rec = recommendOutfit(summarize(f, null, { nowTime: '2026-11-04T08:00' }));
  assert.equal(rec.outfit.outer, 'coat');
  assert.ok(rec.adjustments.some((a) => a.rule === 'wind' && !a.changed));
});

test('시나리오 비: 강수량이 많으면 방수 신발', () => {
  const { s, rec } = scenario('rain');
  assert.ok(s.precipSum >= 10);
  assert.equal(rec.outfit.shoes, 'waterproof_shoes');
});

test('시나리오 눈: 패딩, 미끄럼 방지 신발, 장갑/목도리', () => {
  const { rec } = scenario('snow');
  assert.equal(rec.outfit.outer, 'padding');
  assert.equal(rec.outfit.shoes, 'nonslip_shoes');
  assert.ok(rec.outfit.extras.includes('gloves'));
  assert.ok(rec.outfit.extras.includes('scarf'));
});

test('시나리오 미세먼지: 옷차림은 기온대로, PM 최대값이 요약에 들어간다 (마스크는 6단계 준비물)', () => {
  const { s, rec } = scenario('dust');
  assert.equal(s.pm10Max, 120);
  assert.equal(s.pm25Max, 55);
  assert.ok(rec.outfit.top);
});

test('시나리오 천둥번개: hasThunder 감지', () => {
  const { s } = scenario('thunder');
  assert.equal(s.hasThunder, true);
});

test('이유 문장: 2~3문장, 300자 이하, 입력에 없는 숫자를 만들지 않는다', () => {
  for (const key of ['clear-day', 'chilly-windy', 'rain', 'snow', 'dust', 'fog', 'thunder']) {
    const { rec } = scenario(key);
    const text = templateReason(rec);
    const count = text.split(/[.!?]\s|[.!?]$/).filter(Boolean).length;
    assert.ok(count >= 2 && count <= 3, `${key}: ${count}문장 - ${text}`);
    assert.ok(text.length <= 300);
    // 문장 속 숫자는 모두 facts에서 나온 값이어야 한다 (시각, 체감, 풍속, 강수량, 기온차)
    const f = rec.facts;
    const allowed = new Set(
      [f.startHour, f.endHour, f.feelsMin, f.feelsMax, f.windMax, f.precipSum, f.dailyRange, f.feelsMax - f.feelsMin]
        .filter((v) => typeof v === 'number')
        .flatMap((v) => [String(Math.round(v)), String(Math.round(v * 10) / 10), String(v).padStart(2, '0')]),
    );
    for (const n of text.match(/-?\d+(\.\d+)?/g) ?? []) {
      assert.ok(allowed.has(n) || allowed.has(n.replace(/^0/, '')), `${key}: 문장의 숫자 ${n}가 입력에 없음 - ${text}`);
    }
  }
});

// ---- 3) 외출 시간대 선택 (5-1단계) ----
import { isValidWindow, normalizeWindow, presetIdOf, loadWindow, saveWindow } from '../src/logic/outingWindow.js';

test('시간대 검사: 시작이 끝보다 늦거나 같으면, 범위를 벗어나면, 소수면 안 된다', () => {
  assert.equal(isValidWindow({ startHour: 8, endHour: 19 }), true);
  assert.equal(isValidWindow({ startHour: 22, endHour: 23 }), true); // 최소 1시간
  assert.equal(isValidWindow({ startHour: 19, endHour: 19 }), false);
  assert.equal(isValidWindow({ startHour: 20, endHour: 18 }), false);
  assert.equal(isValidWindow({ startHour: 8, endHour: 24 }), false);
  assert.equal(isValidWindow({ startHour: -1, endHour: 5 }), false);
  assert.equal(isValidWindow({ startHour: 8.5, endHour: 19 }), false); // 30분 단위 미지원
  assert.deepEqual(normalizeWindow({ startHour: 20, endHour: 18 }), { startHour: 8, endHour: 19 });
  assert.equal(presetIdOf({ startHour: 18, endHour: 23 }), 'evening');
  assert.equal(presetIdOf({ startHour: 10, endHour: 15 }), 'custom');
});

test('시간대 저장/불러오기, 깨진 값이면 기본값', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  assert.deepEqual(loadWindow(storage), { startHour: 8, endHour: 19 });
  saveWindow({ startHour: 18, endHour: 23 }, storage);
  assert.deepEqual(loadWindow(storage), { startHour: 18, endHour: 23 });
  mem.set('wearcast:window', '{broken');
  assert.deepEqual(loadWindow(storage), { startHour: 8, endHour: 19 });
});

test('낮 -> 저녁 프리셋 전환: 자외선은 낮아지고, 기온 하락이 겉옷에 반영된다', () => {
  const demo = makeDemoWeather('dust'); // 체감 20° 안팎, 일교차 9°, UV 5.2
  const now = `${demo.forecast.current.time.slice(0, 10)}T07:00`;
  const day = summarize(demo.forecast, demo.air, { window: { startHour: 8, endHour: 19 }, nowTime: now });
  const eve = summarize(demo.forecast, demo.air, { window: { startHour: 18, endHour: 23 }, nowTime: now });
  assert.equal(eve.startHour, 18);
  assert.ok(eve.uvMax < day.uvMax, `UV 낮 ${day.uvMax} -> 저녁 ${eve.uvMax}`);
  assert.ok(eve.uvMax < 6, '저녁에는 자외선 차단제 기준(6) 미만');
  assert.ok(eve.feelsMin < day.feelsMin);
  const dayOutfit = recommendOutfit(day).outfit;
  const eveOutfit = recommendOutfit(eve).outfit;
  assert.notDeepEqual(eveOutfit, dayOutfit);
  // 낮(체감 최저 17.7°)은 가디건, 저녁(16.6°)은 더 따뜻한 자켓 + 맨투맨
  assert.equal(dayOutfit.outer, 'cardigan');
  assert.equal(eveOutfit.outer, 'jacket');
  assert.equal(eveOutfit.top, 'sweatshirt_knit');
});

// ---- 4) 준비물 체크리스트 (6단계) ----
import { recommendChecklist } from '../src/logic/checklist.js';
import { loadChecks, setCheck, pruneOldChecks, storageKey, regionKeyOf } from '../src/logic/checklistStore.js';

function checklistOf(key, opts) {
  const demo = makeDemoWeather(key);
  const s = summarize(demo.forecast, demo.air, opts);
  return { s, ids: recommendChecklist(s, recommendOutfit(s)).map((i) => i.id), items: recommendChecklist(s, recommendOutfit(s)) };
}

test('준비물 시나리오: 맑음 더움 -> 자외선 차단제 + 모자, 우산/마스크 없음', () => {
  // 아침 7시 기준 -> 08~19시 전체 (데모 현재 14시 기준이면 남은 14~19시만 봐서 UV 7.7 < 8)
  const d = makeDemoWeather('clear-day');
  const { ids, items } = checklistOf('clear-day', { nowTime: `${d.forecast.current.time.slice(0, 10)}T07:00` });
  assert.ok(ids.includes('sunscreen'));
  assert.ok(ids.includes('hat'));
  assert.ok(!ids.includes('umbrella'));
  assert.ok(!ids.includes('mask'));
  assert.match(items.find((i) => i.id === 'sunscreen').reason, /덧바르기/);
});

test('준비물 시나리오: 비 -> 우산 (근거에 시간대와 강수확률)', () => {
  const { items } = checklistOf('rain');
  const u = items.find((i) => i.id === 'umbrella');
  assert.ok(u);
  assert.match(u.reason, /비 예보/);
  assert.match(u.reason, /강수확률 최대 90%/);
});

test('준비물 시나리오: 미세먼지 -> 마스크(예측 표기) + 황사 가능성 참고(특보 아님)', () => {
  const { items } = checklistOf('dust');
  assert.match(items.find((i) => i.id === 'mask').reason, /예측/);
  assert.match(items.find((i) => i.id === 'dust_notice').reason, /공식 황사특보 아님/);
});

test('준비물 시나리오: 천둥번개 -> 우산 + 실외활동 주의 / 눈 -> 목도리, 장갑', () => {
  assert.ok(checklistOf('thunder').ids.includes('umbrella'));
  assert.ok(checklistOf('thunder').ids.includes('thunder_caution'));
  const snow = checklistOf('snow').ids;
  assert.ok(snow.includes('scarf') && snow.includes('gloves'));
});

test('준비물: 저녁 시간대로 바꾸면 자외선 항목이 빠진다', () => {
  const demo = makeDemoWeather('clear-day');
  const now = `${demo.forecast.current.time.slice(0, 10)}T07:00`;
  const dayIds = recommendChecklist(summarize(demo.forecast, demo.air, { window: { startHour: 8, endHour: 19 }, nowTime: now })).map((i) => i.id);
  const eveIds = recommendChecklist(summarize(demo.forecast, demo.air, { window: { startHour: 18, endHour: 23 }, nowTime: now })).map((i) => i.id);
  assert.ok(dayIds.includes('sunscreen'));
  assert.ok(!eveIds.includes('sunscreen'));
});

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
}

test('체크 저장: 밤에 내일 기준으로 체크하면 다음 날 아침(오늘 기준)에도 유지된다', () => {
  const st = memoryStorage();
  const region = regionKeyOf({ id: 1838524 });
  // 11/04 21시: 내일(11/05) 기준 목록에서 우산 체크
  const night = summarize(makeForecast(), null, { nowTime: '2026-11-04T21:00' });
  setCheck(night.targetDate, region, 'umbrella', true, st);
  // 11/05 07시: 오늘(11/05) 기준 -> 같은 키
  const morning = summarize(makeForecast(), null, { nowTime: '2026-11-05T07:00' });
  assert.equal(morning.targetDate, night.targetDate);
  pruneOldChecks('2026-11-05', st);
  assert.equal(loadChecks(morning.targetDate, region, st).umbrella, true);
});

test('체크 저장: 대상 날짜가 지나면 지워지고, 지역이 다르면 따로 저장된다', () => {
  const st = memoryStorage();
  setCheck('2026-11-04', 'a', 'mask', true, st);
  setCheck('2026-11-05', 'a', 'mask', true, st);
  setCheck('2026-11-05', 'b', 'hat', true, st);
  pruneOldChecks('2026-11-05', st);
  assert.equal(st.getItem(storageKey('2026-11-04', 'a')), null);
  assert.deepEqual(loadChecks('2026-11-05', 'a', st), { mask: true });
  assert.deepEqual(loadChecks('2026-11-05', 'b', st), { hat: true });
});

test('체크 저장: 항목 ID별 저장이라 체크 해제/다른 항목과 섞이지 않는다', () => {
  const st = memoryStorage();
  setCheck('2026-11-05', 'a', 'umbrella', true, st);
  setCheck('2026-11-05', 'a', 'sunscreen', true, st);
  setCheck('2026-11-05', 'a', 'sunscreen', false, st);
  assert.deepEqual(loadChecks('2026-11-05', 'a', st), { umbrella: true });
});
