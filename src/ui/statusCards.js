// 이 파일이 하는 일: 세 화면이 함께 쓰는 상태 카드(지역 미선택 / 불러오는 중 / API 실패)를 만든다.
// API가 실패하면 가짜 값으로 채우지 않고, 오류 내용 + 다시 시도 + (원하면) 데모 둘러보기를 보여준다.

/**
 * weatherState가 'ready'가 아니면 상태 카드 HTML을, 'ready'면 null을 돌려준다.
 * @param {object} state  weatherState
 * @param {{ loading: string, failed: string }} text  화면별 문구
 */
export function statusCard(state, text) {
  if (!state || state.status === 'idle') {
    return `<p class="card notice">상단의 지역 버튼을 눌러 지역을 선택해 주세요.</p>`;
  }
  if (state.status === 'loading') {
    return `
      <div class="card notice" role="status">
        <span class="spinner" aria-hidden="true"></span>
        <p>${state.region?.name ? `${state.region.name} · ` : ''}${text.loading}</p>
      </div>`;
  }
  if (state.status === 'error') {
    return `
      <div class="card notice notice--error" role="alert">
        <p class="notice__title">${text.failed}</p>
        <p class="notice__detail">${state.error ?? '알 수 없는 오류'}</p>
        <p class="notice__detail">값을 임의로 채우지 않았어요. 잠시 후 다시 시도해 주세요.</p>
        <div class="notice__actions">
          <button type="button" class="retry-btn" data-retry>다시 시도</button>
          <button type="button" class="link-btn" data-open-demo>데모 데이터로 둘러보기</button>
        </div>
      </div>`;
  }
  return null;
}
