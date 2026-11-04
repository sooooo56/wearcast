// 이 파일이 하는 일: 외부 API를 JSON으로 호출하는 공통 함수. 시간 초과와 HTTP 오류를 한국어 메시지로 바꿔 던진다.

const DEFAULT_TIMEOUT_MS = 10000;

export async function fetchJson(url, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    if (err.name === 'TimeoutError') throw new Error('응답 시간이 초과되었습니다.');
    throw new Error('네트워크에 연결할 수 없습니다.');
  }

  // Open-Meteo는 잘못된 요청일 때 { error: true, reason: "..." } 를 돌려준다
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || body.error) {
    const reason = body?.reason ? ` (${body.reason})` : '';
    throw new Error(`데이터를 받지 못했습니다. HTTP ${res.status}${reason}`);
  }
  return body;
}
