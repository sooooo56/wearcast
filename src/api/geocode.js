// 이 파일이 하는 일: 지역 이름으로 위도/경도를 찾는다.
//
// 검색 순서 (2026-11-08 점검 후 개선):
// 1) data/koreaCities.js의 내장 목록(주요 시 85곳)에서 먼저 찾는다. 바로 나오고, 네트워크를 쓰지 않는다.
// 2) 목록에 없으면 Open-Meteo 지오코딩(한국만)에서 찾고, 아래 규칙으로 걸러서 보여준다.
//
// Open-Meteo 지오코딩의 한계 (직접 호출로 확인):
// - 한글 데이터가 빈약해서 "용인", "서귀포" 같은 큰 시가 안 나오고, 같은 이름의 작은 마을(대전리 등)이 많이 섞인다.
// - 북한 지명, 영문 이름, 산/공원/학교, 동 단위 항목(PPLX)도 섞여 나온다.
// 그래서 API 결과는 "사람이 사는 시/군급 장소"만 남기고, 큰 곳이 있으면 마을은 아예 보여주지 않는다.

import { fetchJson } from './fetchJson.js';
import { KOREA_CITIES, KOREA_AREAS } from '../data/koreaCities.js';

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const NAME_SUFFIXES = ['', '군', '시']; // 목록에 없는 곳을 찾을 때 붙여 보는 말 (큰 시는 내장 목록에 있다)
const MAX_RESULTS = 5;
const MAJOR_POPULATION = 30000; // 이 이상이면 "큰 곳"으로 본다
// 사람이 사는 곳(PPL*)과 행정구역(ADM*)만. PPLX(동/구역), 산(MT), 공원(PRK), 섬(ISL), 학교 등은 뺀다
const PLACE_CODES = /^(PPLC|PPLA\d?|PPL|ADM\d)$/;
const ADMIN_SEAT_CODES = /^(PPLC|PPLA\d?)$/; // 도청/시청/군청이 있는 곳
const HANGUL = /[가-힣]/;

// "수원시" / "수원 시" / "서울특별시" -> "수원" / "서울" (끝의 행정 단위 이름을 뗀다)
export function normalizeQuery(query) {
  return query
    .trim()
    .replace(/\s+/g, '')
    .replace(/(특별자치시|특별자치도|특별시|광역시|시)$/, '');
}

function cityToRegion(c) {
  return {
    id: c.id,
    name: c.name,
    admin1: c.admin1,
    admin2: null,
    featureCode: null,
    population: null,
    country: '대한민국',
    countryCode: 'KR',
    latitude: c.latitude,
    longitude: c.longitude,
    small: false,
  };
}

// 1) 내장 목록에서 찾기: 이름이 정확히 같은 곳을 먼저, 그다음 입력으로 시작하는 곳. 시 -> 구/군 순서
// "강남" / "강남구" 둘 다 찾는다 (구/군의 짧은 이름은 끝의 구/군을 뗀 것)
export function searchLocal(query) {
  const q = query.trim().replace(/\s+/g, '');
  const norm = normalizeQuery(query);
  if (!norm) return [];
  const bare = q.replace(/[구군]$/, ''); // "강남구" -> "강남"
  const isExact = (c) => c.short === norm || c.name === q;
  const isAreaExact = (c) => c.short === bare && c.name === q;
  const exact = [...KOREA_CITIES.filter(isExact), ...KOREA_AREAS.filter((c) => isExact(c) || isAreaExact(c))];
  const exactIds = new Set(exact.map((c) => c.id));
  const prefix = [...KOREA_CITIES, ...KOREA_AREAS].filter((c) => !exactIds.has(c.id) && c.short.startsWith(norm));
  return [...exact, ...prefix].slice(0, MAX_RESULTS).map(cityToRegion);
}

// API 결과 1건을 앱에서 쓰는 모양으로 정리
function toRegion(r, small) {
  return {
    id: r.id,
    name: r.name,
    admin1: r.admin1 ?? null, // 시/도
    admin2: r.admin2 ?? null, // 시/군/구
    featureCode: r.feature_code ?? null, // GeoNames 장소 종류 (PPLA 등)
    population: r.population ?? null,
    country: r.country ?? null,
    countryCode: r.country_code ?? null,
    latitude: r.latitude,
    longitude: r.longitude,
    small,
  };
}

const isMajor = (r) => ADMIN_SEAT_CODES.test(r.feature_code ?? '') || (r.population ?? 0) >= MAJOR_POPULATION;
const placeKey = (r) => `${r.name}|${r.admin1 ?? ''}|${r.admin2 ?? ''}`;

/**
 * API 원본 결과를 걸러서 정렬한다 (네트워크 없이 테스트할 수 있게 따로 뺀 순수 함수).
 * - 한국이 아닌 곳, 사람이 사는 곳이 아닌 것(산, 공원, 동 구역 등)을 뺀다
 * - 한글로 검색했으면 영문 이름(Pusan 등)을 뺀다
 * - 같은 장소가 여러 번 나오면 하나로 합친다 (인구가 있는 쪽을 남김)
 * - 큰 곳(시청/군청 소재지, 인구 3만 이상)이 하나라도 있으면 작은 마을은 보여주지 않는다
 * - 큰 곳이 없으면 작은 곳만 보여주되 small: true로 표시한다 ("판교" 같은 동네 이름 검색용).
 *   단, 끝이 구/동이면(강남구 등) 같은 이름의 시골 마을이 나오는 것이 더 혼란스러워서 보여주지 않는다
 */
export function rankApiResults(rawResults, query) {
  const q = query.trim().replace(/\s+/g, '');
  const norm = normalizeQuery(query);
  const queryHasHangul = HANGUL.test(q);

  const byKey = new Map();
  for (const r of rawResults) {
    if (r.country_code && r.country_code !== 'KR') continue;
    if (!PLACE_CODES.test(r.feature_code ?? '')) continue;
    if (queryHasHangul && !HANGUL.test(r.name ?? '')) continue;
    const key = placeKey(r);
    const prev = byKey.get(key);
    if (!prev || (r.population ?? 0) > (prev.population ?? 0)) byKey.set(key, r);
  }
  const places = [...byKey.values()];

  const exact = (r) => normalizeQuery(r.name ?? '') === norm;
  const rank = (a, b) =>
    Number(exact(b)) - Number(exact(a)) ||
    Number(ADMIN_SEAT_CODES.test(b.feature_code)) - Number(ADMIN_SEAT_CODES.test(a.feature_code)) ||
    (b.population ?? 0) - (a.population ?? 0);

  const major = places.filter(isMajor).sort(rank);
  if (major.length) return major.slice(0, MAX_RESULTS).map((r) => toRegion(r, false));

  if (/[구동]$/.test(q)) return [];
  return places
    .filter(exact)
    .sort(rank)
    .slice(0, MAX_RESULTS)
    .map((r) => toRegion(r, true));
}

function buildUrl(name) {
  const params = new URLSearchParams({ name, count: '10', language: 'ko', format: 'json', countryCode: 'KR' });
  return `${GEOCODE_URL}?${params}`;
}

export async function searchRegions(query) {
  if (!normalizeQuery(query)) return [];

  const local = searchLocal(query);
  if (local.length) return local; // 내장 목록에 있으면 네트워크를 쓰지 않는다

  const q = query.trim();
  const names = [...new Set(NAME_SUFFIXES.map((s) => (s && q.endsWith(s) ? q : q + s)))];
  const lists = await Promise.all(names.map((n) => fetchJson(buildUrl(n)).then((body) => body.results ?? [])));
  return rankApiResults(lists.flat(), query);
}
