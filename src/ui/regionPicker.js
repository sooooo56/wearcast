// 이 파일이 하는 일: 지역 검색/선택 창. "현재 위치 사용" 또는 이름 검색으로 지역을 고르고, 마지막 선택을 localStorage에 저장한다.

import { searchRegions } from '../api/geocode.js';
import { DEMO_SCENARIOS } from '../data/demoWeather.js';

const STORAGE_KEY = 'wearcast:region';

export function loadSavedRegion() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Number.isFinite(saved.latitude) && Number.isFinite(saved.longitude)) return saved;
  } catch {
    // 저장값이 깨졌거나 저장소를 못 쓰면 무시
  }
  return null;
}

function saveRegion(region) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(region));
  } catch {
    // 저장 실패해도 앱은 계속 동작
  }
}

// 브라우저 위치 권한으로 현재 좌표를 얻는다. 거부/실패 시 오류 메시지를 던진다.
export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('이 브라우저는 위치 기능을 지원하지 않습니다.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          id: 'current-location',
          name: '현재 위치',
          admin1: null,
          latitude: Math.round(pos.coords.latitude * 1000) / 1000,
          longitude: Math.round(pos.coords.longitude * 1000) / 1000,
          isCurrentLocation: true,
        }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? '위치 권한이 거부되었습니다. 지역 이름으로 검색해 주세요.'
              : '현재 위치를 가져오지 못했습니다. 지역 이름으로 검색해 주세요.',
          ),
        ),
      { timeout: 10000, maximumAge: 10 * 60 * 1000 },
    );
  });
}

// 목록에 보이는 이름: "수원시 · 경기도". 작은 마을은 소속과 "(마을)"을 붙여서 큰 도시와 헷갈리지 않게 한다
function regionLabel(r) {
  if (r.small) {
    const where = [r.admin1, r.admin2].filter(Boolean).join(' ');
    return `${r.name} · ${where} (마을)`;
  }
  return [r.name, r.admin1 && r.admin1 !== r.name ? r.admin1 : null, r.countryCode !== 'KR' ? r.country : null]
    .filter(Boolean)
    .join(' · ');
}

// 지역 선택 창을 만들고 { open } 을 돌려준다. 고르면 onSelect(region) 호출.
export function createRegionPicker({ onSelect, onDemo }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'region-dialog';
  dialog.innerHTML = `
    <form class="region-dialog__search" method="dialog">
      <div class="region-dialog__head">
        <h2>지역 선택</h2>
        <button type="button" class="region-dialog__close" data-close aria-label="닫기">✕</button>
      </div>
      <button type="button" class="region-dialog__geo" data-geo>📍 현재 위치 사용</button>
      <div class="region-dialog__row">
        <input type="search" name="q" placeholder="예: 대전, 용인, 강남구" autocomplete="off" required />
        <button type="submit">검색</button>
      </div>
      <p class="region-dialog__hint">시·군·구 이름으로 검색해 주세요 (예: 대전, 용인, 강남구). 서울의 구는 대부분 되지만, 다른 도시의 구와 동은 검색되지 않을 수 있어요. 그럴 땐 "현재 위치 사용"을 눌러 주세요.</p>
      <p class="region-dialog__msg" role="status" aria-live="polite"></p>
      <ul class="region-dialog__list"></ul>
    </form>
    <details class="region-dialog__demo">
      <summary>데모 데이터로 보기</summary>
      <p class="region-dialog__hint">실제 날씨가 아닌 샘플 데이터예요. 화면에 "데모 데이터" 배지가 표시되고, 배지를 누르면 실제 날씨로 돌아가요.</p>
      <ul class="demo-grid">
        ${Object.entries(DEMO_SCENARIOS)
          .map(([key, s]) => `<li><button type="button" data-demo="${key}">${s.label}</button></li>`)
          .join('')}
      </ul>
    </details>
  `;
  document.body.appendChild(dialog);

  const form = dialog.querySelector('form');
  const input = dialog.querySelector('input');
  const msg = dialog.querySelector('.region-dialog__msg');
  const list = dialog.querySelector('.region-dialog__list');

  function choose(region) {
    saveRegion(region);
    dialog.close();
    onSelect(region);
  }

  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());

  const demoBox = dialog.querySelector('.region-dialog__demo');
  demoBox.addEventListener('click', (e) => {
    const key = e.target.closest('[data-demo]')?.dataset.demo;
    if (!key) return;
    dialog.close();
    onDemo(key); // 데모는 마지막 지역으로 저장하지 않는다
  });

  dialog.querySelector('[data-geo]').addEventListener('click', async () => {
    msg.textContent = '현재 위치를 찾는 중...';
    try {
      choose(await getCurrentLocation());
    } catch (err) {
      msg.textContent = err.message;
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    list.innerHTML = '';
    msg.textContent = '검색 중...';
    try {
      const results = await searchRegions(input.value);
      if (!results.length) {
        msg.textContent = '검색 결과가 없습니다. 시·군·구 이름으로 다시 검색하거나, 구/동은 해당 시 이름으로 검색해 보세요. "현재 위치 사용"도 됩니다.';
      } else if (results.some((r) => r.small)) {
        msg.textContent = '정확한 시·군 이름이 아니면 작은 마을이 나올 수 있어요.';
      } else {
        msg.textContent = '';
      }
      results.forEach((r) => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = regionLabel(r);
        btn.addEventListener('click', () => choose(r));
        li.appendChild(btn);
        list.appendChild(li);
      });
    } catch (err) {
      msg.textContent = `검색에 실패했습니다. ${err.message}`;
    }
  });

  return {
    // showDemo: true면 데모 목록을 펼친 채로 연다 (API 실패 화면의 "데모 데이터로 둘러보기")
    open(message = '', { showDemo = false } = {}) {
      msg.textContent = message;
      list.innerHTML = '';
      demoBox.open = showDemo;
      dialog.showModal();
      (showDemo ? demoBox.querySelector('button') : input).focus();
    },
  };
}
