// 이 파일이 하는 일: WMO 날씨 코드(Open-Meteo weather_code)를 한글 라벨, 아이콘, 배경 테마로 바꾼다.
// 테마(theme) 값은 4단계 배경 전환에서 사용한다.

// [코드 목록, 라벨, 낮 아이콘, 밤 아이콘, 테마]
const TABLE = [
  [[0], '맑음', 'sun', 'moon-stars', 'clear'],
  [[1], '대체로 맑음', 'cloud-sun', 'cloud-moon', 'clear'],
  [[2], '구름 조금', 'cloud-sun', 'cloud-moon', 'cloudy'],
  [[3], '흐림', 'cloud', 'cloud', 'cloudy'],
  [[45, 48], '안개', 'cloud-fog', 'cloud-fog', 'fog'],
  [[51, 53, 55, 56, 57], '이슬비', 'cloud-rain', 'cloud-rain', 'rain'],
  [[61, 63, 65, 66, 67], '비', 'cloud-rain', 'cloud-rain', 'rain'],
  [[71, 73, 75, 77], '눈', 'cloud-snow', 'cloud-snow', 'snow'],
  [[80, 81, 82], '소나기', 'cloud-rain', 'cloud-rain', 'rain'],
  [[85, 86], '눈 소나기', 'cloud-snow', 'cloud-snow', 'snow'],
  [[95, 96, 99], '천둥번개', 'cloud-lightning', 'cloud-lightning', 'thunder'],
];

const BY_CODE = new Map();
TABLE.forEach(([codes, label, dayIcon, nightIcon, theme]) => {
  codes.forEach((code) => BY_CODE.set(code, { label, dayIcon, nightIcon, theme }));
});

// 비/눈 강도: WMO 코드의 세기 구분 (slight / moderate / heavy). 배경 효과의 입자 수와 속도를 정한다
const LIGHT_CODES = new Set([51, 53, 56, 61, 71, 77, 80, 85]);
const HEAVY_CODES = new Set([65, 67, 75, 82, 86, 96, 99]);

export function intensityOf(code) {
  if (LIGHT_CODES.has(code)) return 'light';
  if (HEAVY_CODES.has(code)) return 'heavy';
  return 'normal';
}

function themeFor(base, day) {
  if (base === 'clear') return day ? 'clear-day' : 'clear-night';
  if (base === 'cloudy' || base === 'fog') return day ? base : `${base}-night`;
  return base;
}

// 모르는 코드나 값이 없으면 null을 돌려준다 (임의 라벨을 만들지 않음)
export function describeWeather(code, isDay) {
  const info = BY_CODE.get(code);
  if (!info) return null;
  const day = isDay !== 0; // 값이 없으면 낮 아이콘
  return {
    label: info.label,
    icon: day ? info.dayIcon : info.nightIcon,
    // 맑음/흐림/안개는 밤에 어두운 테마를 쓴다 (비/눈/천둥번개는 낮밤 공통)
    theme: themeFor(info.theme, day),
  };
}
