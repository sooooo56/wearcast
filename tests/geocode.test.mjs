// 이 파일이 하는 일: 지역 검색(내장 목록 + API 결과 걸러내기)을 네트워크 없이 검사한다. 실행: npm test
// API 샘플은 2026-11-08에 실제로 받은 응답의 모양(필요한 값만)이다.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchLocal, rankApiResults, normalizeQuery } from '../src/api/geocode.js';
import { KOREA_CITIES, KOREA_AREAS } from '../src/data/koreaCities.js';

const names = (list) => list.map((r) => r.name);

// ---- 내장 목록 ----
test('내장 목록: 85개 시, id가 겹치지 않고 좌표가 한국 안에 있다', () => {
  assert.equal(KOREA_CITIES.length, 85);
  const all = [...KOREA_CITIES, ...KOREA_AREAS];
  assert.equal(new Set(all.map((c) => c.id)).size, all.length);
  for (const c of all) {
    assert.ok(c.latitude > 33 && c.latitude < 38.7 && c.longitude > 125.5 && c.longitude < 131, `${c.name} 좌표`);
  }
});

test('"대전"을 검색하면 대전광역시 하나만 나온다 (전라남도 마을 대전은 나오지 않음)', () => {
  for (const q of ['대전', '대 전', '대전시', '대전광역시']) {
    const r = searchLocal(q);
    assert.deepEqual(names(r), ['대전광역시'], q);
    assert.equal(r[0].small, false);
  }
});

test('이름이 겹치는 광주는 광역시와 경기도 광주시 둘 다 나온다', () => {
  assert.deepEqual(searchLocal('광주').map((r) => `${r.name}/${r.admin1}`), ['광주광역시/광주광역시', '광주시/경기도']);
});

test('"대구"처럼 끝이 구인 시 이름이 잘리지 않는다', () => {
  assert.deepEqual(names(searchLocal('대구')), ['대구광역시']);
  assert.deepEqual(names(searchLocal('대구광역시')), ['대구광역시']);
});

test('API 한글 검색에서 빠졌던 19개 시를 모두 찾는다', () => {
  const missing = '용인 시흥 군포 안성 의왕 포천 동두천 과천 태백 삼척 제천 계룡 남원 김제 순천 영천 통영 사천 서귀포'.split(' ');
  for (const q of missing) {
    const r = searchLocal(q);
    assert.ok(r.some((x) => x.name === `${q}시`), `${q} -> ${names(r)}`);
  }
});

test('구 단위: 강남/강남구 모두 서울 강남구, 해운대구/분당구/울릉군도 찾는다', () => {
  for (const q of ['강남', '강남구']) assert.deepEqual(searchLocal(q).map((r) => `${r.name}/${r.admin1}`), ['강남구/서울특별시']);
  assert.equal(searchLocal('해운대')[0].admin1, '부산광역시');
  assert.equal(searchLocal('분당')[0].name, '분당구');
  assert.equal(searchLocal('울릉')[0].name, '울릉군');
});

test('일부만 입력하면 이름이 그걸로 시작하는 곳이 나온다, 의미 없는 입력은 빈 결과', () => {
  assert.deepEqual(names(searchLocal('수')), ['수원시']);
  assert.ok(searchLocal('광').length >= 4);
  for (const q of ['', ' ', '시', 'ㅅ', 'xyz']) assert.deepEqual(searchLocal(q), [], `"${q}"`);
  assert.equal(normalizeQuery('서울특별시'), '서울');
});

// ---- API 결과 걸러내기 ----
const village = (name, admin1, admin2, extra = {}) => ({ id: Math.random(), name, admin1, admin2, feature_code: 'PPL', country_code: 'KR', latitude: 35, longitude: 127, ...extra });

test('API: 큰 곳이 있으면 같은 이름의 마을은 보여주지 않는다 (양평)', () => {
  const raw = [
    village('양평', '경기도', '양평군', { id: 1, population: 83367 }),
    village('양평', '충청북도', '충주시', { id: 2 }),
    village('Yangp’yŏng', '경상북도', '영양군', { id: 3 }),
    village('양평', '경상북도', '안동시', { id: 4 }),
  ];
  const r = rankApiResults(raw, '양평');
  assert.deepEqual(r.map((x) => `${x.name}/${x.admin2}/${x.small}`), ['양평/양평군/false']);
});

test('API: 북한, 영문 이름, 산/공원/동 구역은 걸러낸다', () => {
  const raw = [
    village('성남', '황해남도', null, { id: 1, country_code: 'KP' }),
    village('Pusan', '경상북도', '의성군', { id: 2 }),
    village('성남산', '경기도', '성남시', { id: 3, feature_code: 'MT' }),
    village('성남공원', '경기도', '성남시', { id: 4, feature_code: 'PRK' }),
    village('시흥동', '서울특별시', '금천구', { id: 5, feature_code: 'PPLX', population: 128142 }),
    village('성남', '경기도', '성남시', { id: 6, feature_code: 'PPLA2', population: 900000 }),
  ];
  assert.deepEqual(rankApiResults(raw, '성남').map((x) => x.id), [6]);
});

test('API: 같은 장소가 두 번 나오면 하나로 합치고 인구가 있는 쪽을 남긴다 (여수)', () => {
  const raw = [
    village('여수시', '전라남도', '여수시', { id: 1, feature_code: 'PPLA2', population: 268823 }),
    village('여수시', '전라남도', '여수시', { id: 2, feature_code: 'PPLA2' }),
  ];
  const r = rankApiResults(raw, '여수');
  assert.equal(r.length, 1);
  assert.equal(r[0].population, 268823);
});

test('API: 이름이 검색어와 정확히 같은 곳이 먼저, 그다음 시청/군청 소재지, 그다음 인구순', () => {
  const raw = [
    village('고창군', '전라북도', '고창군', { id: 1, feature_code: 'PPLA2', population: 50000 }),
    village('고창', '전라북도', '고창군', { id: 2, feature_code: 'PPLA2', population: 40000 }),
    village('고창읍', '전라북도', '고창군', { id: 3, feature_code: 'PPL', population: 60000 }),
  ];
  // "고창"과 이름이 같은 2번이 먼저. 나머지는 소재지(PPLA2)인 1번이 인구만 많은 3번보다 앞
  assert.deepEqual(rankApiResults(raw, '고창').map((x) => x.id), [2, 1, 3]);
});

test('API: 큰 곳이 없으면 마을만 보여주되 small로 표시한다 (판교)', () => {
  const raw = [village('판교', '전라남도', '순천시', { id: 1 }), village('판교리', '경기도', '평택시', { id: 2 }), village('P’an’gyo', '충청남도', '홍성군', { id: 3 })];
  const r = rankApiResults(raw, '판교');
  assert.deepEqual(r.map((x) => `${x.name}/${x.small}`), ['판교/true']);
});

test('API: 끝이 구/동인 검색어는 같은 이름의 시골 마을을 보여주지 않는다', () => {
  assert.deepEqual(rankApiResults([village('강남', '전라북도', '고창군', { id: 1 })], '강남구'), []);
  assert.deepEqual(rankApiResults([village('신사', '전라북도', '고창군', { id: 1 })], '신사동'), []);
});

test('API: 영문 검색어는 영문 결과도 허용한다 (Seoul)', () => {
  const raw = [village('서울특별시', '서울특별시', null, { id: 1, feature_code: 'PPLC', population: 10349312 }), village('Séoul', '프랑스', null, { id: 2, country_code: 'CM' })];
  assert.deepEqual(rankApiResults(raw, 'Seoul').map((x) => x.id), [1]);
});
