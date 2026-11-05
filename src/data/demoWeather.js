// 이 파일이 하는 일: 테마/규칙 확인용 데모 샘플 데이터를 만든다. 실제 날씨가 아니다.
// API 응답과 같은 모양으로 만들어서, 화면/규칙 코드는 실데이터와 똑같이 읽는다.
// 데모 데이터일 때는 weatherState.source = 'demo' 이고 화면에 "데모 데이터" 배지가 보인다.

// 시나리오: code = WMO 날씨 코드, hour = 데모의 "현재 시각"
export const DEMO_SCENARIOS = {
  'clear-day': { label: '맑음 (낮, 더움)', code: 0, hour: 14, temp: 29, feelsGap: 2, range: 8, pop: 0, rain: 0, snow: 0, wind: 2.1, uv: 8.2, pm10: 32, pm25: 14, dust: 4 },
  'clear-night': { label: '맑음 (밤)', code: 0, hour: 22, temp: 11, feelsGap: -2, range: 9, pop: 5, rain: 0, snow: 0, wind: 2.5, uv: 0, pm10: 28, pm25: 12, dust: 3 },
  cloudy: { label: '흐림', code: 3, hour: 11, temp: 17, feelsGap: -1, range: 6, pop: 30, rain: 0, snow: 0, wind: 3.4, uv: 3.1, pm10: 45, pm25: 22, dust: 8 },
  'cloudy-night': { label: '흐림 (밤)', code: 3, hour: 21, temp: 13, feelsGap: -2, range: 6, pop: 20, rain: 0, snow: 0, wind: 3.0, uv: 0, pm10: 40, pm25: 20, dust: 6 },
  fog: { label: '안개', code: 45, hour: 7, temp: 9, feelsGap: -1, range: 7, pop: 10, rain: 0, snow: 0, wind: 1.2, uv: 0.4, pm10: 96, pm25: 48, dust: 35 },
  'fog-night': { label: '안개 (밤)', code: 45, hour: 4, temp: 7, feelsGap: -1, range: 7, pop: 10, rain: 0, snow: 0, wind: 0.9, uv: 0, pm10: 60, pm25: 33, dust: 10 },
  drizzle: { label: '가랑비', code: 53, hour: 10, temp: 15, feelsGap: -1, range: 4, pop: 70, rain: 0.4, snow: 0, wind: 2.2, uv: 1, pm10: 20, pm25: 10, dust: 2 },
  'heavy-rain': { label: '폭우', code: 82, hour: 15, temp: 19, feelsGap: -2, range: 4, pop: 100, rain: 9, snow: 0, wind: 9.5, uv: 0.8, pm10: 14, pm25: 7, dust: 1 },
  'heavy-snow': { label: '눈보라', code: 75, hour: 9, temp: -6, feelsGap: -8, range: 4, pop: 90, rain: 0.5, snow: 2.4, wind: 8, uv: 0.8, pm10: 18, pm25: 9, dust: 1 },
  rain: { label: '비', code: 63, hour: 15, temp: 14, feelsGap: -3, range: 4, pop: 90, rain: 2.4, snow: 0, wind: 5.6, uv: 1.2, pm10: 18, pm25: 9, dust: 2 },
  snow: { label: '눈', code: 73, hour: 9, temp: -3, feelsGap: -5, range: 5, pop: 80, rain: 0.6, snow: 0.8, wind: 3.9, uv: 1.5, pm10: 22, pm25: 11, dust: 2 },
  thunder: { label: '천둥번개', code: 95, hour: 17, temp: 24, feelsGap: 2, range: 6, pop: 85, rain: 6.5, snow: 0, wind: 7.8, uv: 2.4, pm10: 25, pm25: 12, dust: 3 },
  'chilly-windy': { label: '쌀쌀 + 강풍', code: 3, hour: 8, temp: 16, feelsGap: -3, range: 8, pop: 10, rain: 0, snow: 0, wind: 8.5, uv: 3.4, pm10: 30, pm25: 13, dust: 4 },
  dust: { label: '미세먼지 나쁨', code: 3, hour: 10, temp: 20, feelsGap: 0, range: 9, pop: 0, rain: 0, snow: 0, wind: 1.8, uv: 5.2, pm10: 120, pm25: 55, dust: 95 },
};

// 서울 기준 오늘 날짜 "YYYY-MM-DD"
function seoulDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d);
}

const r1 = (v) => Math.round(v * 10) / 10;

// 하루 기온 곡선: 새벽 5시 최저, 오후 3시 최고
function tempAt(base, range, hour) {
  return base + (range / 2) * Math.cos(((hour - 15) / 24) * 2 * Math.PI);
}

export function makeDemoWeather(key) {
  const s = DEMO_SCENARIOS[key];
  if (!s) throw new Error(`알 수 없는 데모 시나리오: ${key}`);

  const days = [seoulDate(0), seoulDate(1)];
  const time = days.flatMap((day) => Array.from({ length: 24 }, (_, h) => `${day}T${String(h).padStart(2, '0')}:00`));
  const hourOf = (t) => Number(t.slice(11, 13));

  // 현재 시각 기온이 시나리오 temp가 되도록 기준값을 맞춘다
  const base = s.temp - (tempAt(0, s.range, s.hour));
  const temps = time.map((t) => r1(tempAt(base, s.range, hourOf(t))));
  const isDayArr = time.map((t) => (hourOf(t) >= 6 && hourOf(t) < 19 ? 1 : 0));
  const uvArr = time.map((t) => {
    const h = hourOf(t);
    return h < 7 || h > 18 ? 0 : r1(Math.max(0, s.uv * Math.sin(((h - 6) / 13) * Math.PI)));
  });

  const nowIndex = s.hour; // 오늘 s.hour 시

  // 비/눈/뇌우는 매일 (현재 시각 -2시간 ~ +4시간)에만 내린다. 나머지 시간은 흐림 + 낮은 강수확률
  const isWetCode = s.code >= 51;
  const wet = time.map((t) => {
    const h = hourOf(t);
    return !isWetCode || (h >= s.hour - 2 && h <= s.hour + 4);
  });

  const hourly = {
    time,
    temperature_2m: temps,
    apparent_temperature: temps.map((v) => r1(v + s.feelsGap)),
    precipitation_probability: wet.map((w) => (w ? s.pop : Math.min(s.pop, 20))),
    precipitation: wet.map((w) => (w ? s.rain : 0)),
    snowfall: wet.map((w) => (w ? s.snow : 0)),
    weather_code: wet.map((w) => (w ? s.code : 3)),
    wind_speed_10m: time.map(() => s.wind),
    uv_index: uvArr,
    is_day: isDayArr,
  };

  const daySlice = (arr, d) => arr.slice(d * 24, d * 24 + 24);
  const daily = {
    time: days,
    temperature_2m_max: [0, 1].map((d) => Math.max(...daySlice(temps, d))),
    temperature_2m_min: [0, 1].map((d) => Math.min(...daySlice(temps, d))),
    uv_index_max: [0, 1].map((d) => Math.max(...daySlice(uvArr, d))),
    precipitation_sum: [0, 1].map((d) => r1(daySlice(hourly.precipitation, d).reduce((a, v) => a + v, 0))),
  };

  const forecast = {
    timezone: 'Asia/Seoul',
    current: {
      time: time[nowIndex],
      interval: 900,
      temperature_2m: temps[nowIndex],
      apparent_temperature: hourly.apparent_temperature[nowIndex],
      weather_code: s.code,
      wind_speed_10m: s.wind,
      wind_direction_10m: 315, // 데모는 북서풍 고정
      is_day: isDayArr[nowIndex],
    },
    currentUnits: { temperature_2m: '°C', apparent_temperature: '°C', wind_speed_10m: 'm/s' },
    hourly,
    hourlyUnits: { temperature_2m: '°C', apparent_temperature: '°C', precipitation_probability: '%', precipitation: 'mm', snowfall: 'cm', wind_speed_10m: 'm/s' },
    daily,
    dailyUnits: { temperature_2m_max: '°C', temperature_2m_min: '°C', precipitation_sum: 'mm' },
  };

  const air = {
    hourly: {
      time,
      pm10: time.map(() => s.pm10),
      pm2_5: time.map(() => s.pm25),
      dust: time.map(() => s.dust),
    },
    hourlyUnits: { pm10: 'μg/m³', pm2_5: 'μg/m³', dust: 'μg/m³' },
  };

  return {
    region: { id: `demo-${key}`, name: `데모 · ${s.label}`, admin1: null, latitude: 0, longitude: 0, isDemo: true },
    forecast,
    air,
  };
}
