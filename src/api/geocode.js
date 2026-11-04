// 이 파일이 하는 일: 지역 이름으로 위도/경도를 찾는다 (Open-Meteo 지오코딩).
//
// 확인한 한계 (2026-11 직접 호출로 확인):
// - 한글은 정식 명칭만 정확히 찾는다. "서울"은 결과 없음, "서울특별시"는 찾음.
// - 짧은 이름은 같은 이름의 산/마을이 먼저 나온다 ("부산" -> 충주의 부산(산)).
// - 구/동 단위(강남구, 해운대구, 분당 등)는 한글 이름이 데이터에 없어 찾지 못한다.
// 그래서 입력에 "시/특별시/광역시..."를 붙인 변형을 함께 검색하고, 사람이 사는 곳만 남겨 인구순으로 정렬한다.

import { fetchJson } from './fetchJson.js';

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const NAME_SUFFIXES = ['', '시', '특별시', '광역시', '특별자치시', '특별자치도', '군'];
const MAX_RESULTS = 5;

function buildUrl(name) {
  const params = new URLSearchParams({ name, count: '10', language: 'ko', format: 'json' });
  return `${GEOCODE_URL}?${params}`;
}

// 결과 1건을 앱에서 쓰는 모양으로 정리
function toRegion(r) {
  return {
    id: r.id,
    name: r.name,
    admin1: r.admin1 ?? null, // 시/도
    country: r.country ?? null,
    countryCode: r.country_code ?? null,
    latitude: r.latitude,
    longitude: r.longitude,
  };
}

export async function searchRegions(query) {
  const q = query.trim();
  if (!q) return [];

  // 이미 접미사로 끝나면 그대로 한 번만 검색
  const names = [...new Set(NAME_SUFFIXES.map((s) => (s && q.endsWith(s) ? q : q + s)))];
  const lists = await Promise.all(
    names.map((n) => fetchJson(buildUrl(n)).then((body) => body.results ?? [])),
  );

  // 같은 장소가 여러 번 나오면 하나로 합침
  const byId = new Map();
  lists.flat().forEach((r) => byId.set(r.id, r));

  return [...byId.values()]
    // PPL(사람 사는 곳), ADM(행정구역)만 남기고 산(MT), 고개(PASS) 등은 뺀다
    .filter((r) => /^(PPL|ADM)/.test(r.feature_code ?? ''))
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
    .slice(0, MAX_RESULTS)
    .map(toRegion);
}
