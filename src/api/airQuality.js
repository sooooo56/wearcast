// 이 파일이 하는 일: 위도/경도로 Open-Meteo 대기질(PM10, PM2.5, dust)을 받아온다.
// 주의: 측정소 실측이 아니라 모델 예측값이다. 화면에는 "예측 기반 참고값"으로 표시한다.
// dust는 황사 "가능성" 참고용일 뿐, 공식 황사특보가 아니다.

import { fetchJson } from './fetchJson.js';

const AIR_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

export async function fetchAirQuality(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    timezone: 'Asia/Seoul',
    hourly: 'pm10,pm2_5,dust',
    forecast_days: '2',
  });

  const body = await fetchJson(`${AIR_URL}?${params}`);
  return {
    hourly: body.hourly, // { time: [...], pm10: [...], pm2_5: [...], dust: [...] }
    hourlyUnits: body.hourly_units, // 확인한 단위: μg/m³
  };
}
