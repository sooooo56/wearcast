// 이 파일이 하는 일: 화면 하단의 데이터 출처 문구를 만든다 (세 화면 공통).
// Open-Meteo 데이터는 CC BY 4.0이라 출처 표기가 필요하다. 데모일 때는 실제 날씨가 아님을 표시한다.
// (2026-11-04 약관 확인: 무료 이용은 비상업 용도, 하루 1만 회 / 시간당 5천 회 / 분당 600회 미만)

export function sourceLine(state, note = '') {
  if (state?.source === 'demo') return '<strong>데모 샘플 데이터 · 실제 날씨가 아닙니다</strong>';
  const link =
    '<a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Weather data by Open-Meteo.com</a> (CC BY 4.0)';
  return note ? `${link} · ${note}` : link;
}
