// 이 파일이 하는 일: 데모 시나리오별 요약 수치, 추천 옷차림, 이유 문장을 표로 출력한다. 실행: npm run scenarios
// 결과는 포트폴리오의 "추천 결과 검증" 기록으로 쓸 수 있다. (데모 데이터이며 실제 날씨가 아님)

import { summarize } from '../src/logic/summarize.js';
import { recommendOutfit } from '../src/logic/outfit.js';
import { templateReason, basisLabel } from '../src/logic/explain.js';
import { makeDemoWeather, DEMO_SCENARIOS } from '../src/data/demoWeather.js';
import { itemInfo } from '../src/data/items.js';

const label = (slot, id) => itemInfo(slot, id)?.label ?? id;
const fmt = (v, unit = '') => (v === null || v === undefined ? '-' : `${Math.round(v * 10) / 10}${unit}`);

function show(key, nowTime) {
  const demo = makeDemoWeather(key);
  const s = summarize(demo.forecast, demo.air, nowTime ? { nowTime: `${demo.forecast.current.time.slice(0, 10)}T${nowTime}` } : {});
  const rec = recommendOutfit(s);
  const o = rec.outfit;
  console.log(`\n■ ${DEMO_SCENARIOS[key].label} [${key}]  기준: ${basisLabel(rec.facts)}`);
  console.log(
    `  체감 ${fmt(s.feelsMin, '°')}~${fmt(s.feelsMax, '°')} | 일교차 ${fmt(s.dailyRange, '°')} | 바람 ${fmt(s.windMax, 'm/s')} | 강수확률 ${fmt(s.popMax, '%')} | 강수 ${fmt(s.precipSum, 'mm')} | 적설 ${fmt(s.snowSum, 'cm')} | UV ${fmt(s.uvMax)} | PM10 ${fmt(s.pm10Max)} PM2.5 ${fmt(s.pm25Max)}`,
  );
  console.log(
    `  옷: 아우터=${label('outer', o.outer)}${o.outerOptional ? '(선택)' : ''} / 상의=${label('top', o.top)} / 하의=${label('bottom', o.bottom)} / 신발=${label('shoes', o.shoes)}${o.extras.length ? ` / 방한=${o.extras.map((e) => label('extras', e)).join(',')}` : ''}`,
  );
  console.log(`  보정: ${rec.adjustments.map((a) => a.rule).join(', ') || '없음'}`);
  console.log(`  이유: ${templateReason(rec)}`);
}

for (const key of Object.keys(DEMO_SCENARIOS)) show(key);
console.log('\n---- 밤 21시 기준 (내일 추천으로 전환) ----');
show('clear-day', '21:00');
show('rain', '21:00');
