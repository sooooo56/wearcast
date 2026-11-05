// 이 파일이 하는 일: 앱 시작점. 스타일을 불러오고, 지역을 정해 데이터를 받고, 세 화면을 그린 뒤 Swiper로 연결한다.

import Swiper from 'swiper';
import { Navigation, Pagination, Keyboard, A11y } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

// Pretendard: 화면에 쓰인 글자 묶음만 내려받는 동적 서브셋 버전
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';

import './styles/base.css';
import './styles/themes.css';
import './styles/screens.css';

import { weatherState, subscribe, loadRegion, loadDemo, clearData, setOutingWindow, fetchCount } from './state.js';
import { applyThemeFromState, THEMES } from './ui/theme.js';
import { strikeNow } from './ui/skyFx.js';
import { DEMO_SCENARIOS } from './data/demoWeather.js';
import { summarize } from './logic/summarize.js';
import { recommendOutfit } from './logic/outfit.js';
import { getReason, buildExplainPayload, explainCacheKey, requestAiReason, pruneExplainCache } from './logic/explain.js';
import { createWindowPicker } from './ui/windowPicker.js';
import { recommendChecklist } from './logic/checklist.js';
import { regionKeyOf, pruneOldChecks } from './logic/checklistStore.js';
import { renderWeatherScreen } from './ui/weatherScreen.js';
import { renderOutfitScreen, updateReasonCard } from './ui/outfitScreen.js';
import { renderChecklistScreen } from './ui/checklistScreen.js';
import { icon } from './ui/icons.js';
import { createRegionPicker, loadSavedRegion, getCurrentLocation } from './ui/regionPicker.js';

const weatherEl = document.getElementById('screen-weather');
const outfitEl = document.getElementById('screen-outfit');
const checklistEl = document.getElementById('screen-checklist');
const regionLabelEl = document.getElementById('region-label');

// 1) 상태가 바뀔 때마다 화면을 다시 그림 (API는 부르지 않음)
const demoBadgeEl = document.getElementById('demo-badge');

// weatherState와 선택한 외출 시간대로 추천을 계산한다 (API 호출 없음)
function buildRecommendation(s) {
  if (s.status !== 'ready' || !s.forecast) return null;
  const summary = summarize(s.forecast, s.air, { window: s.outingWindow });
  const rec = recommendOutfit(summary);
  const checklist = recommendChecklist(summary, rec);
  const regionKey = regionKeyOf(s.region);
  const payload = rec ? buildExplainPayload(rec, summary, checklist) : null;
  const cacheKey = payload ? explainCacheKey(regionKey, summary.targetDate, payload) : null;
  return {
    summary,
    rec,
    checklist,
    payload,
    cacheKey,
    reason: rec ? getReason(rec, { cacheKey }) : null,
    storeKey: summary ? { targetDate: summary.targetDate, regionKey } : null,
  };
}

// AI 이유 문장을 요청하고, 도착하면 OUTFIT의 이유 카드만 바꾼다 (화면 전체 재계산 없음).
// 실패하면 규칙 기반 문장을 그대로 두고 "AI 확인 중" 표시만 지운다.
function fillAiReason(result) {
  if (!result?.reason?.pending) return;
  requestAiReason(result.payload, result.cacheKey).then((ai) => {
    if (lastResult !== result) return; // 그 사이 지역/시간대가 바뀌었으면 버림
    result.reason = ai ?? { ...result.reason, pending: false };
    updateReasonCard(outfitEl, result.reason);
  });
}

let lastResult = null; // 개발 확인용 (콘솔: wearcast.recommendation())

function renderAll(s) {
  applyThemeFromState(s);
  regionLabelEl.textContent = s.region?.name ?? '지역 선택';
  demoBadgeEl.hidden = s.source !== 'demo';
  // 추천 대상 날짜가 지난 체크 기록은 지운다 (기준: 예보의 현재 시각)
  if (s.status === 'ready' && s.forecast?.current?.time) {
    const today = s.forecast.current.time.slice(0, 10);
    pruneOldChecks(today);
    pruneExplainCache(today);
  }
  const result = buildRecommendation(s);
  lastResult = result;
  renderWeatherScreen(weatherEl, s);
  renderOutfitScreen(outfitEl, s, result);
  renderChecklistScreen(checklistEl, s, result);
  fillAiReason(result);
}
subscribe(renderAll);
renderAll(weatherState);

// 외출 시간대 시트: OUTFIT 화면의 기준 칩("· 변경")을 누르면 열린다.
// 화면은 상태가 바뀔 때마다 다시 그려지므로, 칩 클릭은 화면 바깥 요소에서 받는다 (이벤트 위임).
const windowPicker = createWindowPicker({ onApply: setOutingWindow });
outfitEl.addEventListener('click', (e) => {
  if (e.target.closest('[data-open-window]')) windowPicker.open(weatherState.outingWindow);
});

// 상단 지역 버튼의 햄버거 아이콘을 같은 아이콘 세트로 교체
document.querySelector('.region-btn__icon').innerHTML = icon('list', 'icon region-btn__svg');

// 2) 데모 모드: 주소의 ?demo=시나리오 와 맞춰서 새로고침해도 같은 모드가 유지되게 한다.
//    데모 데이터는 data/demoWeather.js에만 있고, 데모일 때는 상단 배지와 하단 문구로 표시한다.
function setDemoInUrl(key) {
  const url = new URL(location.href);
  if (key) url.searchParams.set('demo', key);
  else url.searchParams.delete('demo');
  history.replaceState(null, '', url);
}

function enterDemo(key) {
  setDemoInUrl(key);
  loadDemo(key);
}

function exitDemo() {
  setDemoInUrl(null);
  clearData(); // 데모 값이 실제 날씨처럼 남지 않게 먼저 비운다
  startLive();
}

// 지역 선택 창 (실제 지역을 고르면 데모 모드는 끝난다)
const picker = createRegionPicker({
  onSelect: (region) => {
    setDemoInUrl(null);
    loadRegion(region);
  },
  onDemo: enterDemo,
});
document.getElementById('region-btn').addEventListener('click', () => picker.open());

// 데모 배지를 누르면 실제 날씨로 돌아간다
demoBadgeEl.addEventListener('click', exitDemo);

// 오류 화면의 "데모 데이터로 둘러보기" (세 화면 공통, 이벤트 위임)
document.getElementById('screens').addEventListener('click', (e) => {
  if (e.target.closest('[data-open-demo]')) picker.open('', { showDemo: true });
});

// 3) 시작: (주소에 ?demo=시나리오 가 있으면 데모) -> 저장된 지역 -> 현재 위치 -> 검색 창
function start() {
  const demoKey = new URLSearchParams(location.search).get('demo');
  if (demoKey && DEMO_SCENARIOS[demoKey]) {
    loadDemo(demoKey);
    return;
  }
  if (demoKey) setDemoInUrl(null); // 모르는 시나리오 이름이면 무시
  startLive();
}

async function startLive() {
  const saved = loadSavedRegion();
  if (saved) {
    loadRegion(saved);
    return;
  }
  try {
    loadRegion(await getCurrentLocation());
  } catch (err) {
    // 위치 권한을 거부해도 검색으로 계속 쓸 수 있음
    picker.open(err.message);
  }
}
start();

// 4) Swiper 연결
const SCREEN_NAMES = ['WEATHER', 'OUTFIT', 'CHECKLIST'];

const swiper = new Swiper('#screens', {
  modules: [Navigation, Pagination, Keyboard, A11y],
  slidesPerView: 1,
  speed: 350,
  // PC에서 마우스 드래그로도 넘길 수 있게 함
  simulateTouch: true,
  grabCursor: true,
  // 이 클래스가 붙은 요소 위에서는 스와이프하지 않음 (나중에 가로 스크롤 요소용)
  noSwiping: true,
  noSwipingClass: 'swiper-no-swiping',
  // iOS Safari: 화면 가장자리(20px)에서 시작한 스와이프는 Swiper가 잡지 않고 브라우저 "뒤로 가기" 제스처에 양보한다
  edgeSwipeDetection: true,
  edgeSwipeThreshold: 20,
  keyboard: { enabled: true },
  navigation: {
    prevEl: '#nav-prev',
    nextEl: '#nav-next',
  },
  pagination: {
    el: '#pager',
    clickable: true,
    renderBullet: (index, className) =>
      `<button type="button" class="${className}" aria-label="${SCREEN_NAMES[index]} 화면으로 이동"></button>`,
  },
  a11y: {
    prevSlideMessage: '이전 화면',
    nextSlideMessage: '다음 화면',
  },
});

// 화면을 넘기는 정도(0~1)를 배경 효과에 전달 -> 해/구름이 살짝 따라 움직인다
const appEl = document.getElementById('app');
swiper.on('progress', (_s, progress) => appEl.style.setProperty('--sky-p', progress.toFixed(3)));

// 개발 중 콘솔에서 확인할 수 있게 노출
// 예: wearcast.weatherState, wearcast.fetchCount(), wearcast.swiper.slideTo(2), wearcast.demo('rain')
window.wearcast = {
  swiper,
  weatherState,
  fetchCount: () => fetchCount,
  demo: enterDemo,
  themes: THEMES,
  strike: strikeNow,
  recommendation: () => lastResult,
};
