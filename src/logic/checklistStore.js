// 이 파일이 하는 일: 체크리스트의 체크 상태를 localStorage에 저장/불러오기 한다.
// 키: wearcast:checklist:{추천 대상 날짜}:{지역키}  값: { 항목ID: true }
// - 키의 날짜는 "오늘"이 아니라 추천 대상 날짜다. 밤에 내일 기준 목록을 체크해 두면,
//   다음 날 아침에는 같은 날짜가 "오늘 기준"이 되어 체크가 그대로 이어진다.
// - 항목 ID별로 저장하므로 시간대를 바꿔 목록이 달라져도 겹치는 항목의 체크는 유지된다.
// - 대상 날짜가 지난 키는 지워서 다음 날 자동으로 새로 시작한다.

const PREFIX = 'wearcast:checklist:';

export function regionKeyOf(region) {
  if (!region) return 'unknown';
  if (region.isCurrentLocation) return `geo:${region.latitude.toFixed(2)},${region.longitude.toFixed(2)}`;
  return String(region.id ?? `${region.latitude},${region.longitude}`);
}

export const storageKey = (targetDate, regionKey) => `${PREFIX}${targetDate}:${regionKey}`;

export function loadChecks(targetDate, regionKey, storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage.getItem(storageKey(targetDate, regionKey)));
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

export function setCheck(targetDate, regionKey, itemId, checked, storage = globalThis.localStorage) {
  const checks = loadChecks(targetDate, regionKey, storage);
  if (checked) checks[itemId] = true;
  else delete checks[itemId];
  try {
    storage.setItem(storageKey(targetDate, regionKey), JSON.stringify(checks));
  } catch {
    // 저장 실패해도 화면 체크는 유지
  }
  return checks;
}

// today("YYYY-MM-DD")보다 이전 날짜의 키를 지운다
export function pruneOldChecks(today, storage = globalThis.localStorage) {
  try {
    const keys = [];
    for (let i = 0; i < storage.length; i += 1) keys.push(storage.key(i));
    keys
      .filter((k) => k?.startsWith(PREFIX) && k.slice(PREFIX.length, PREFIX.length + 10) < today)
      .forEach((k) => storage.removeItem(k));
  } catch {
    // 저장소를 못 쓰면 무시
  }
}
