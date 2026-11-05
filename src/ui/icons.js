// 이 파일이 하는 일: Phosphor Icons(MIT)의 light 굵기 SVG를 이름으로 꺼내 쓴다.
// 앱 전체가 한 세트, 한 굵기(light)만 쓴다. 새 아이콘은 아래 목록에 import를 추가한다.

import sun from '@phosphor-icons/core/assets/light/sun-light.svg?raw';
import moonStars from '@phosphor-icons/core/assets/light/moon-stars-light.svg?raw';
import cloud from '@phosphor-icons/core/assets/light/cloud-light.svg?raw';
import cloudSun from '@phosphor-icons/core/assets/light/cloud-sun-light.svg?raw';
import cloudMoon from '@phosphor-icons/core/assets/light/cloud-moon-light.svg?raw';
import cloudFog from '@phosphor-icons/core/assets/light/cloud-fog-light.svg?raw';
import cloudRain from '@phosphor-icons/core/assets/light/cloud-rain-light.svg?raw';
import cloudSnow from '@phosphor-icons/core/assets/light/cloud-snow-light.svg?raw';
import cloudLightning from '@phosphor-icons/core/assets/light/cloud-lightning-light.svg?raw';
import umbrella from '@phosphor-icons/core/assets/light/umbrella-light.svg?raw';
import wind from '@phosphor-icons/core/assets/light/wind-light.svg?raw';
import faceMask from '@phosphor-icons/core/assets/light/face-mask-light.svg?raw';
import list from '@phosphor-icons/core/assets/light/list-light.svg?raw';
import clock from '@phosphor-icons/core/assets/light/clock-light.svg?raw';
// 옷/준비물 (data/items.js에서 이름으로 참조)
import coatHanger from '@phosphor-icons/core/assets/light/coat-hanger-light.svg?raw';
import tShirt from '@phosphor-icons/core/assets/light/t-shirt-light.svg?raw';
import shirtFolded from '@phosphor-icons/core/assets/light/shirt-folded-light.svg?raw';
import hoodie from '@phosphor-icons/core/assets/light/hoodie-light.svg?raw';
import pants from '@phosphor-icons/core/assets/light/pants-light.svg?raw';
import sneaker from '@phosphor-icons/core/assets/light/sneaker-light.svg?raw';
import boot from '@phosphor-icons/core/assets/light/boot-light.svg?raw';
import snowflake from '@phosphor-icons/core/assets/light/snowflake-light.svg?raw';
import baseballCap from '@phosphor-icons/core/assets/light/baseball-cap-light.svg?raw';

const ICONS = {
  sun,
  'moon-stars': moonStars,
  cloud,
  'cloud-sun': cloudSun,
  'cloud-moon': cloudMoon,
  'cloud-fog': cloudFog,
  'cloud-rain': cloudRain,
  'cloud-snow': cloudSnow,
  'cloud-lightning': cloudLightning,
  umbrella,
  wind,
  'face-mask': faceMask,
  list,
  clock,
  'coat-hanger': coatHanger,
  't-shirt': tShirt,
  'shirt-folded': shirtFolded,
  hoodie,
  pants,
  sneaker,
  boot,
  snowflake,
  'baseball-cap': baseballCap,
};

// 장식용 아이콘 HTML. 뜻은 옆의 텍스트로 전달하므로 스크린리더에서는 숨긴다.
export function icon(name, className = 'icon') {
  const svg = ICONS[name];
  if (!svg) return '';
  return svg.replace('<svg ', `<svg class="${className}" aria-hidden="true" focusable="false" `);
}
