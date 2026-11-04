// 이 파일이 하는 일: SCREEN 03 CHECKLIST 화면을 그린다.
// 항목은 규칙 엔진(logic/checklist.js)이 정하고, 체크 상태는 logic/checklistStore.js로 저장한다.
// 기준 라벨은 OUTFIT과 같은 값을 보여준다 (시간대 변경은 OUTFIT 칩에서만).

import { retry } from '../state.js';
import { CHECK_ITEMS } from '../data/items.js';
import { basisLabel } from '../logic/explain.js';
import { loadChecks, setCheck } from '../logic/checklistStore.js';
import { icon } from './icons.js';
import { statusCard } from './statusCards.js';
import { sourceLine } from './attribution.js';

function renderRow(item, checked) {
  const info = CHECK_ITEMS[item.id];
  if (!info) return '';
  return `
    <li class="check-row${checked ? ' is-done' : ''}">
      <label class="check-row__label">
        ${icon(info.icon, 'icon check-row__icon')}
        <span class="check-row__text">
          <span class="check-row__name">${info.label}</span>
          <span class="check-row__reason">${item.reason}</span>
        </span>
        <input type="checkbox" class="check-row__box" data-id="${item.id}" ${checked ? 'checked' : ''} />
        <span class="check-row__mark" aria-hidden="true"></span>
      </label>
    </li>`;
}

function progressText(done, total) {
  if (!total) return '';
  return done === total ? `${total}개 모두 챙겼어요!` : `${total}개 중 ${done}개 완료`;
}

function renderProgress(done, total) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return `
    <div class="check-progress" aria-live="polite">
      <p class="check-progress__text">${progressText(done, total)}</p>
      <div class="check-progress__bar" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}" aria-label="준비물 달성 현황">
        <span style="width:${pct}%"></span>
      </div>
    </div>`;
}

/**
 * @param {HTMLElement} container
 * @param {object} state  weatherState
 * @param {{ rec, checklist, storeKey: {targetDate, regionKey} }|null} result  main.js에서 계산한 결과
 */
export function renderChecklistScreen(container, state, result) {
  // 지역 미선택 / 로딩 / 실패면 상태 카드, 아니면 추천 화면
  const status = statusCard(state, {
    loading: '준비물을 확인하는 중...',
    failed: '날씨 정보를 불러오지 못해 준비물을 확인할 수 없습니다.',
  });
  let body;
  if (status) {
    body = status;
  } else if (!result?.rec) {
    body = `<p class="card notice">추천에 필요한 데이터 정보 없음</p>`;
  } else {
    const { targetDate, regionKey } = result.storeKey;
    const checks = loadChecks(targetDate, regionKey);
    const items = result.checklist;
    const done = items.filter((i) => checks[i.id]).length;
    const list = items.length
      ? `<ul class="check-list">${items.map((i) => renderRow(i, Boolean(checks[i.id]))).join('')}</ul>
         ${renderProgress(done, items.length)}`
      : `<p class="check-empty">이 시간대에는 따로 챙길 준비물이 없어요.<br /><small>비, 자외선, 미세먼지, 추위 기준을 모두 확인했어요.</small></p>`;
    const airNote = state.air ? '미세먼지·황사는 모델 예측 기반 참고값' : '대기질 정보 없음';
    const source = sourceLine(state, airNote);

    body = `
      <p class="basis-chip">${basisLabel(result.rec.facts)} 기준</p>
      <h1 class="screen__title outfit__title">외출 전 이것만 확인하세요!</h1>
      <section class="check-panel" aria-label="준비물 목록">${list}</section>
      <p class="source">${source}</p>
    `;
  }

  container.innerHTML = `<div class="screen__inner outfit checklist">${body}</div>`;
  container.querySelector('[data-retry]')?.addEventListener('click', retry);

  // 체크하면 저장하고, 화면은 해당 줄과 진행 현황만 바꾼다 (전체 재계산 없음)
  container.onchange = (e) => {
    const box = e.target.closest('.check-row__box');
    if (!box || !result?.storeKey) return;
    const { targetDate, regionKey } = result.storeKey;
    const checks = setCheck(targetDate, regionKey, box.dataset.id, box.checked);
    box.closest('.check-row').classList.toggle('is-done', box.checked);
    const total = result.checklist.length;
    const done = result.checklist.filter((i) => checks[i.id]).length;
    container.querySelector('.check-progress')?.replaceWith(
      Object.assign(document.createElement('div'), { innerHTML: renderProgress(done, total) }).firstElementChild,
    );
  };
}
