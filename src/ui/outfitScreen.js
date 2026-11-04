// 이 파일이 하는 일: SCREEN 02 OUTFIT 화면을 그린다.
// 추천 대상 날짜(오늘/내일)의 외출 시간대 기준이다. 항목은 규칙 엔진(logic/outfit.js)이 정한 것을 그대로 보여준다.
// 배치: 기준 칩 -> 타이틀 -> 아이템 세로 쌓기(방한용품 -> 아우터 -> 상의 -> 하의 -> 신발) -> 추천 이유 카드

import { retry } from '../state.js';
import { itemInfo, SLOT_LABELS } from '../data/items.js';
import { basisLabel } from '../logic/explain.js';
import { icon } from './icons.js';
import { statusCard } from './statusCards.js';
import { sourceLine } from './attribution.js';

const NO_DATA = '정보 없음';
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function renderItem(slot, id, { optional = false } = {}) {
  const info = itemInfo(slot, id);
  if (!info) return '';
  return `
    <li class="outfit-item">
      ${info.icon ? icon(info.icon, 'icon outfit-item__icon') : ''}
      <p class="outfit-item__caption">
        <span class="outfit-item__slot">${SLOT_LABELS[slot]}</span>
        <span class="outfit-item__name">${info.label}${optional ? ' <small>(선택)</small>' : ''}</span>
      </p>
    </li>`;
}

function renderExtras(extras) {
  if (!extras.length) return '';
  const chips = extras
    .map((id) => {
      const info = itemInfo('extras', id);
      return info ? `<li class="extra-chip">${icon(info.icon, 'icon extra-chip__icon')}${info.label}</li>` : '';
    })
    .join('');
  return `
    <div class="outfit-extras">
      <span class="outfit-item__slot">${SLOT_LABELS.extras}</span>
      <ul class="outfit-extras__list">${chips}</ul>
    </div>`;
}

function renderFacts(facts) {
  const parts = [
    isNum(facts.feelsMin) ? `체감 ${Math.round(facts.feelsMin)}~${Math.round(facts.feelsMax)}°` : `체감 ${NO_DATA}`,
    isNum(facts.windMax) ? `바람 최대 ${Math.round(facts.windMax * 10) / 10}m/s` : `바람 ${NO_DATA}`,
    isNum(facts.popMax) ? `강수확률 최대 ${facts.popMax}%` : `강수확률 ${NO_DATA}`,
  ];
  return parts.join(' · ');
}

// 이유 문장이 어디서 왔는지 라벨로 구분한다
function reasonLabelText(reason) {
  if (reason.source === 'ai') return 'AI 설명';
  return reason.pending ? '규칙 기반 설명 · AI 확인 중' : '규칙 기반 설명';
}

// AI 문장은 서버에서 오므로 HTML로 해석되지 않게 바꿔 넣는다
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// AI 문장이 나중에 도착하면 이유 카드만 바꾼다 (main.js에서 호출)
export function updateReasonCard(container, reason) {
  const label = container.querySelector('.reason__label');
  const text = container.querySelector('.reason__text');
  if (label) label.textContent = reasonLabelText(reason);
  if (text) text.textContent = reason.text;
}

function renderReady(state, rec, reason) {
  const { outfit, facts } = rec;
  const title = facts.isTomorrow ? '내일은 이렇게 입어보세요!' : '오늘은 이렇게 입어보세요!';
  const note =
    sourceLine(state, '체감온도는 모델 예측값');

  return `
    <button type="button" class="basis-chip basis-chip--button" data-open-window
      aria-label="외출 시간대 변경. 지금은 ${basisLabel(facts)} 기준">
      ${basisLabel(facts)} 기준 <span class="basis-chip__action">· 변경</span>
    </button>
    <h1 class="screen__title outfit__title">${title}</h1>

    <section class="outfit-panel" aria-label="추천 옷차림">
      ${renderExtras(outfit.extras)}
      <ul class="outfit-stack">
        ${outfit.outer !== 'none' ? renderItem('outer', outfit.outer, { optional: outfit.outerOptional }) : ''}
        ${renderItem('top', outfit.top)}
        ${renderItem('bottom', outfit.bottom)}
        ${renderItem('shoes', outfit.shoes)}
      </ul>
    </section>

    <section class="card reason" aria-label="추천 이유">
      <p class="reason__head"><span class="reason__label">${reasonLabelText(reason)}</span>추천 이유</p>
      <p class="reason__text" aria-live="polite">${escapeHtml(reason.text)}</p>
      <p class="reason__facts">${renderFacts(facts)}</p>
    </section>

    <p class="source">${note}</p>
  `;
}

/**
 * @param {HTMLElement} container
 * @param {object} state  weatherState
 * @param {{rec, reason}|null} result  main.js에서 계산한 추천 결과
 */
export function renderOutfitScreen(container, state, result) {
  // 지역 미선택 / 로딩 / 실패면 상태 카드, 아니면 추천 화면
  const status = statusCard(state, {
    loading: '옷차림 추천을 준비하는 중...',
    failed: '날씨 정보를 불러오지 못해 옷차림을 추천할 수 없습니다.',
  });
  let body;
  if (status) {
    body = status;
  } else if (!result?.rec) {
    body = `<p class="card notice">추천에 필요한 체감온도 ${NO_DATA}</p>`;
  } else {
    body = renderReady(state, result.rec, result.reason);
  }

  container.innerHTML = `<div class="screen__inner outfit">${body}</div>`;
  container.querySelector('[data-retry]')?.addEventListener('click', retry);
}
