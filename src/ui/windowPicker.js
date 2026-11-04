// 이 파일이 하는 일: 외출 시간대 선택 시트. 프리셋 2개(낮/저녁) + 직접 설정(시작/종료, 1시간 단위).
// "적용"을 누르면 onApply({ startHour, endHour })를 부른다. 저장과 재계산은 state.setOutingWindow가 한다.

import { WINDOW_PRESETS, MIN_HOUR, MAX_HOUR, isValidWindow, presetIdOf } from '../logic/outingWindow.js';
import { MIN_WINDOW_HOURS } from '../logic/thresholds.js';

const pad = (h) => String(h).padStart(2, '0');
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

export function createWindowPicker({ onApply }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'sheet window-sheet';
  dialog.setAttribute('aria-labelledby', 'window-sheet-title');

  const presetRadios = WINDOW_PRESETS.map(
    (p) => `
      <label class="window-option">
        <input type="radio" name="preset" value="${p.id}" />
        <span class="window-option__label">${p.label}</span>
        <span class="window-option__time">${pad(p.startHour)}~${pad(p.endHour)}시</span>
      </label>`,
  ).join('');

  const hourOptions = (hours) => hours.map((h) => `<option value="${h}">${pad(h)}시</option>`).join('');

  dialog.innerHTML = `
    <form class="sheet__body" method="dialog">
      <div class="sheet__head">
        <h2 id="window-sheet-title">외출 시간대</h2>
        <button type="button" class="sheet__close" data-close aria-label="닫기">✕</button>
      </div>
      <p class="sheet__hint">이 시간대의 날씨로 옷차림과 준비물을 추천해요.</p>

      <fieldset class="window-options">
        <legend class="sr-only">시간대 프리셋</legend>
        ${presetRadios}
        <label class="window-option">
          <input type="radio" name="preset" value="custom" />
          <span class="window-option__label">직접 설정</span>
          <span class="window-option__time" data-custom-time></span>
        </label>
      </fieldset>

      <div class="window-custom">
        <label>시작
          <select name="start">${hourOptions(range(MIN_HOUR, MAX_HOUR - MIN_WINDOW_HOURS))}</select>
        </label>
        <span aria-hidden="true">~</span>
        <label>종료
          <select name="end">${hourOptions(range(MIN_HOUR + MIN_WINDOW_HOURS, MAX_HOUR))}</select>
        </label>
      </div>
      <p class="sheet__note">1시간 단위로 고를 수 있어요. 자정을 넘기는 시간대는 아직 지원하지 않아요.</p>
      <p class="sheet__msg" role="alert"></p>

      <button type="submit" class="sheet__apply">적용</button>
    </form>
  `;
  document.body.appendChild(dialog);

  const form = dialog.querySelector('form');
  const startSel = form.elements.start;
  const endSel = form.elements.end;
  const msg = dialog.querySelector('.sheet__msg');
  const customTime = dialog.querySelector('[data-custom-time]');

  const current = () => ({ startHour: Number(startSel.value), endHour: Number(endSel.value) });

  // 종료는 시작 + 최소 길이 이후만, 시작은 종료 - 최소 길이 이전만 고를 수 있게 막는다
  function syncDisabled() {
    const { startHour, endHour } = current();
    [...endSel.options].forEach((o) => (o.disabled = Number(o.value) - startHour < MIN_WINDOW_HOURS));
    [...startSel.options].forEach((o) => (o.disabled = endHour - Number(o.value) < MIN_WINDOW_HOURS));
  }

  function setSelects(w) {
    startSel.value = String(w.startHour);
    endSel.value = String(w.endHour);
    syncDisabled();
  }

  function syncRadio() {
    const w = current();
    const id = presetIdOf(w);
    form.querySelector(`input[name="preset"][value="${id}"]`).checked = true;
    customTime.textContent = id === 'custom' ? `${pad(w.startHour)}~${pad(w.endHour)}시` : '';
    msg.textContent = '';
  }

  form.addEventListener('change', (e) => {
    if (e.target.name === 'preset') {
      const preset = WINDOW_PRESETS.find((p) => p.id === e.target.value);
      if (preset) setSelects(preset);
      else startSel.focus(); // 직접 설정: 드롭다운으로 이동
    } else if (e.target === startSel) {
      // 시작을 종료와 같거나 늦게 옮기면 종료를 1시간 뒤로 밀어준다
      if (Number(endSel.value) - Number(startSel.value) < MIN_WINDOW_HOURS) {
        endSel.value = String(Math.min(MAX_HOUR, Number(startSel.value) + MIN_WINDOW_HOURS));
      }
      syncDisabled();
    } else if (e.target === endSel) {
      syncDisabled();
    }
    syncRadio();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const w = current();
    if (!isValidWindow(w)) {
      msg.textContent = `종료 시각은 시작보다 ${MIN_WINDOW_HOURS}시간 이상 늦어야 해요.`;
      return;
    }
    dialog.close();
    onApply(w);
  });

  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  // 시트 바깥(배경)을 누르면 닫기
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  return {
    open(w) {
      setSelects(w);
      syncRadio();
      dialog.showModal();
      form.querySelector('input[name="preset"]:checked')?.focus();
    },
  };
}
