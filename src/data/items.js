// 이 파일이 하는 일: 옷/준비물 ID별 한글 라벨과 아이콘 이름을 관리한다.
// 아이콘은 Phosphor light. 세부 종류 아이콘이 없어서 슬롯 단위 아이콘 + 한글 라벨로 구분한다 (2026-11-04 결정).
// 예: 아우터는 전부 coat-hanger, 반바지는 pants, 목도리/장갑은 snowflake, 차단제는 sun.

export const ITEMS = {
  outer: {
    none: { label: '겉옷 없음', icon: null },
    cardigan: { label: '가디건', icon: 'coat-hanger' },
    jacket: { label: '자켓', icon: 'coat-hanger' },
    trench: { label: '트렌치코트/야상', icon: 'coat-hanger' },
    coat: { label: '코트', icon: 'coat-hanger' },
    padding: { label: '패딩', icon: 'coat-hanger' },
    windbreaker: { label: '방풍 겉옷', icon: 'coat-hanger' },
    waterproof_jacket: { label: '방수 겉옷', icon: 'coat-hanger' },
  },
  top: {
    sleeveless: { label: '민소매', icon: 't-shirt' },
    short_sleeve: { label: '반팔', icon: 't-shirt' },
    thin_long_sleeve: { label: '얇은 긴팔', icon: 'shirt-folded' },
    sweatshirt_knit: { label: '맨투맨/니트', icon: 'hoodie' },
    knit_heattech: { label: '니트 + 히트텍', icon: 'hoodie' },
  },
  bottom: {
    shorts: { label: '반바지', icon: 'pants' },
    thin_pants: { label: '얇은 바지', icon: 'pants' },
    long_pants: { label: '긴 바지', icon: 'pants' },
    warm_pants: { label: '기모 바지', icon: 'pants' },
  },
  shoes: {
    sneakers: { label: '운동화', icon: 'sneaker' },
    waterproof_shoes: { label: '방수 신발', icon: 'boot' },
    rain_boots: { label: '장화', icon: 'boot' },
    nonslip_shoes: { label: '미끄럼 방지 신발', icon: 'boot' },
  },
  extras: {
    scarf: { label: '목도리', icon: 'snowflake' },
    gloves: { label: '장갑', icon: 'snowflake' },
    hat: { label: '모자/양산', icon: 'baseball-cap' },
    sunscreen: { label: '자외선 차단제', icon: 'sun' },
    mask: { label: '보건용 마스크', icon: 'face-mask' },
    umbrella: { label: '우산', icon: 'umbrella' },
  },
};

// 준비물(CHECKLIST) 항목: 체크박스에 보이는 행동 문구와 아이콘
export const CHECK_ITEMS = {
  umbrella: { label: '우산 챙기기', icon: 'umbrella' },
  thunder_caution: { label: '천둥번개 때 실외활동 주의', icon: 'cloud-lightning' },
  mask: { label: '보건용 마스크 챙기기', icon: 'face-mask' },
  dust_notice: { label: '황사 가능성 참고', icon: 'wind' },
  sunscreen: { label: '자외선 차단제 바르기', icon: 'sun' },
  hat: { label: '모자/양산 챙기기', icon: 'baseball-cap' },
  scarf: { label: '목도리 챙기기', icon: 'snowflake' },
  gloves: { label: '장갑 챙기기', icon: 'snowflake' },
};

export const SLOT_LABELS = { extras: '방한용품', outer: '아우터', top: '상의', bottom: '하의', shoes: '신발' };

export function itemInfo(slot, id) {
  return ITEMS[slot]?.[id] ?? null;
}
