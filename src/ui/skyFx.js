// 이 파일이 하는 일: 하늘 위에 움직이는 날씨 효과(비, 눈, 별, 번개)를 캔버스 하나로 그린다.
// - 비/눈은 "깊이"가 있다: 가까운 것은 크고 빠르고 또렷하고, 먼 것은 작고 느리고 흐리다.
// - 바람이 세면 빗줄기가 기울고 눈이 옆으로 흐른다. 비/눈의 양은 날씨 코드의 강도(가랑비~폭우)를 따른다.
// - 번개는 매번 모양이 다른 갈라지는 줄기를 만들고, 하늘이 번쩍인다. 별은 반짝이고 가끔 별똥별이 지나간다.
// - 화면이 안 보이면(탭 숨김) 멈추고, 움직임 줄이기 설정이면 별만 정지 상태로 그리고 나머지는 그리지 않는다.

const MAX_DPR = 2; // 고해상도 화면에서도 부담이 커지지 않게 상한
const INTENSITY = { light: 0.45, normal: 1, heavy: 2.1 };

let host = null; // .sky 요소
let canvas = null;
let ctx = null;
let width = 0;
let height = 0;
let raf = 0;
let lastTime = 0;
let state = null; // 지금 효과의 입자와 설정
let resizeObserver = null;
let motionQuery = null;

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// 눈송이/큰 별에 쓰는 부드러운 원 그림 (한 번만 만들어 재사용)
let softDot = null;
function getSoftDot() {
  if (softDot) return softDot;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  softDot = c;
  return c;
}

// 눈송이 그림: 하얀 중심, 가장자리는 푸른 회색 (눈 테마 배경이 연한 흰색이라 흰색만 쓰면 안 보인다)
let snowDot = null;
function getSnowDot() {
  if (snowDot) return snowDot;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.42, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.62, 'rgba(176,196,222,0.55)');
  grad.addColorStop(1, 'rgba(176,196,222,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  snowDot = c;
  return c;
}

// ---------- 비 ----------
function initRain(opts) {
  const k = INTENSITY[opts.intensity] ?? 1;
  const count = Math.round(clamp((width * height) / 3600, 40, 150) * k);
  const slant = 0.07 + opts.wind * 0.5; // 옆으로 기울어지는 정도 (바람이 셀수록 크게)
  const drops = Array.from({ length: count }, () => {
    const z = Math.random() ** 1.4; // 0(먼 것) ~ 1(가까운 것). 먼 것이 더 많다
    return {
      x: rand(-height * slant, width),
      y: rand(-height, height),
      z,
      len: 12 + z * 34 * (opts.intensity === 'heavy' ? 1.25 : 1),
      speed: 620 + z * 980 + (opts.intensity === 'heavy' ? 280 : 0),
      w: 0.5 + z * 1.15,
    };
  });
  return { kind: 'rain', drops, slant, heavy: opts.intensity === 'heavy' };
}

function drawRain(dt) {
  const { drops, slant, heavy } = state;
  ctx.lineCap = 'round';
  // 가까운 정도에 따라 3묶음으로 그려서 색 바꾸는 횟수를 줄인다
  for (let band = 0; band < 3; band += 1) {
    const alpha = [0.14, 0.26, 0.42][band] + (heavy ? 0.08 : 0);
    ctx.strokeStyle = `rgba(214,229,246,${alpha})`;
    ctx.beginPath();
    for (const d of drops) {
      if (Math.min(2, Math.floor(d.z * 3)) !== band) continue;
      d.y += d.speed * dt;
      d.x += d.speed * slant * dt;
      if (d.y - d.len > height) {
        d.y = rand(-d.len * 2, -d.len);
        d.x = rand(-height * slant, width);
      }
      ctx.lineWidth = d.w;
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - d.len * slant, d.y - d.len);
    }
    ctx.stroke();
  }
}

// ---------- 눈 ----------
function initSnow(opts) {
  const k = INTENSITY[opts.intensity] ?? 1;
  const count = Math.round(clamp((width * height) / 4200, 44, 130) * k);
  const flakes = Array.from({ length: count }, () => {
    const z = Math.random() ** 1.2;
    return {
      x: rand(0, width),
      y: rand(0, height),
      z,
      r: 1.4 + z * 4.2,
      speed: 20 + z * 52 + (opts.intensity === 'heavy' ? 24 : 0),
      sway: rand(6, 24) * (0.5 + z),
      freq: rand(0.4, 1.1),
      phase: rand(0, Math.PI * 2),
    };
  });
  return { kind: 'snow', flakes, drift: opts.wind * 70, time: 0 };
}

function drawSnow(dt) {
  const dot = getSnowDot();
  state.time += dt;
  for (const f of state.flakes) {
    f.y += f.speed * dt;
    f.x += state.drift * (0.3 + f.z) * dt;
    if (f.y - f.r > height) {
      f.y = -f.r * 2;
      f.x = rand(0, width);
    }
    if (f.x > width + 30) f.x = -30;
    if (f.x < -30) f.x = width + 30;
    const sx = f.x + Math.sin(state.time * f.freq + f.phase) * f.sway;
    ctx.globalAlpha = 0.5 + f.z * 0.5;
    const size = f.r * 2.8; // 부드러운 가장자리를 포함한 크기
    ctx.drawImage(dot, sx - size / 2, f.y - size / 2, size, size);
  }
  ctx.globalAlpha = 1;
}

// ---------- 별 (+ 별똥별) ----------
function initStars() {
  const count = Math.round(clamp((width * height) / 4200, 40, 110));
  const stars = Array.from({ length: count }, () => ({
    x: rand(0, width),
    y: rand(0, height * 0.72),
    r: Math.random() < 0.12 ? rand(1.4, 2.1) : rand(0.5, 1.2),
    base: rand(0.4, 1),
    speed: rand(0.6, 2.2),
    phase: rand(0, Math.PI * 2),
    warm: Math.random() < 0.25, // 일부는 살짝 노란 별
  }));
  return { kind: 'stars', stars, time: 0, shooting: null, nextShoot: rand(6, 14) };
}

function drawStars(dt, still) {
  const dot = getSoftDot();
  state.time += dt;
  for (const s of state.stars) {
    const twinkle = still ? 0.8 : 0.55 + 0.45 * Math.sin(state.time * s.speed + s.phase);
    ctx.globalAlpha = clamp(s.base * twinkle, 0, 1);
    ctx.fillStyle = s.warm ? '#ffe9c4' : '#ffffff';
    if (s.r > 1.3) {
      const size = s.r * 7; // 큰 별은 은은한 빛 번짐
      ctx.drawImage(dot, s.x - size / 2, s.y - size / 2, size, size);
    }
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (still) return;

  // 별똥별: 가끔 한 줄기만 지나간다
  state.nextShoot -= dt;
  if (!state.shooting && state.nextShoot <= 0) {
    state.shooting = { x: rand(width * 0.35, width * 0.95), y: rand(0, height * 0.25), life: 0, dur: rand(0.6, 0.9) };
    state.nextShoot = rand(14, 32);
  }
  const m = state.shooting;
  if (m) {
    m.life += dt;
    const p = m.life / m.dur;
    if (p >= 1) {
      state.shooting = null;
    } else {
      const dist = 340 * p;
      const hx = m.x - dist * 0.85;
      const hy = m.y + dist * 0.5;
      const grad = ctx.createLinearGradient(hx, hy, hx + 110 * 0.85, hy - 110 * 0.5);
      grad.addColorStop(0, `rgba(255,255,255,${0.9 * (1 - p)})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + 110 * 0.85, hy - 110 * 0.5);
      ctx.stroke();
    }
  }
}

// ---------- 번개 ----------
// 중간점을 흔들어서 갈라지는 번개 줄기를 만든다 (매번 모양이 다름)
function bolt(x1, y1, x2, y2, jitter, out) {
  if (jitter < 4) {
    out.push([x1, y1, x2, y2]);
    return;
  }
  const mx = (x1 + x2) / 2 + rand(-jitter, jitter);
  const my = (y1 + y2) / 2 + rand(-jitter * 0.3, jitter * 0.3);
  bolt(x1, y1, mx, my, jitter / 2, out);
  bolt(mx, my, x2, y2, jitter / 2, out);
}

function makeBolt() {
  const x0 = rand(width * 0.15, width * 0.85);
  const y1 = height * rand(0.5, 0.85);
  const segments = [];
  const trunk = [];
  bolt(x0, -10, x0 + rand(-width * 0.18, width * 0.18), y1, width * 0.16, trunk);
  segments.push({ w: 1, list: trunk });
  // 줄기 중간에서 가지가 뻗는다
  const branchCount = Math.round(rand(1, 3));
  for (let i = 0; i < branchCount; i += 1) {
    const from = trunk[Math.floor(rand(trunk.length * 0.25, trunk.length * 0.75))];
    const list = [];
    bolt(from[2], from[3], from[2] + rand(-120, 120), from[3] + rand(80, 220), 60, list);
    segments.push({ w: 0.5, list });
  }
  return { segments, life: 0, dur: 0.7 };
}

function initThunder(opts) {
  const rain = initRain({ ...opts, intensity: opts.intensity === 'light' ? 'normal' : opts.intensity });
  return { ...rain, kind: 'thunder', bolt: null, flash: 0, nextBolt: rand(1.8, 3.5), time: 0 };
}

function drawThunder(dt, still) {
  drawRain(dt);
  state.nextBolt -= dt;
  if (!still && !state.bolt && state.nextBolt <= 0) {
    state.bolt = makeBolt();
    state.nextBolt = rand(5, 12);
  }
  const b = state.bolt;
  if (!b) return;
  b.life += dt;
  const p = b.life / b.dur;
  if (p >= 1) {
    state.bolt = null;
    return;
  }
  // 번쩍 - 잠깐 꺼짐 - 다시 번쩍 - 사라짐
  const pulse = p < 0.12 ? 1 : p < 0.2 ? 0.15 : p < 0.34 ? 0.95 : Math.max(0, 1 - (p - 0.34) / 0.66) * 0.5;
  // 하늘 전체가 번쩍인다
  ctx.fillStyle = `rgba(205,222,255,${0.32 * pulse})`;
  ctx.fillRect(0, 0, width, height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const seg of b.segments) {
    for (const [x1, y1, x2, y2] of seg.list) {
      ctx.strokeStyle = `rgba(150,185,255,${0.3 * pulse})`; // 바깥 빛
      ctx.lineWidth = 7 * seg.w;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.95 * pulse})`; // 하얀 중심
      ctx.lineWidth = 2 * seg.w;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }
}

// ---------- 공통 루프 ----------
const reduced = () => Boolean(motionQuery?.matches);

function frame(now) {
  raf = requestAnimationFrame(frame);
  const dt = clamp((now - lastTime) / 1000, 0, 0.05);
  lastTime = now;
  ctx.clearRect(0, 0, width, height);
  if (!state) return;
  if (state.kind === 'rain') drawRain(dt);
  else if (state.kind === 'snow') drawSnow(dt);
  else if (state.kind === 'stars') drawStars(dt, false);
  else if (state.kind === 'thunder') drawThunder(dt, false);
}

function start() {
  cancelAnimationFrame(raf);
  if (!state || document.hidden) return;
  if (reduced()) {
    // 움직임 줄이기: 별만 한 장 그려 둔다 (비/눈/번개는 그리지 않음)
    ctx.clearRect(0, 0, width, height);
    if (state.kind === 'stars') drawStars(0, true);
    return;
  }
  lastTime = performance.now();
  raf = requestAnimationFrame(frame);
}

function build(kind, opts) {
  if (kind === 'rain') return initRain(opts);
  if (kind === 'snow') return initSnow(opts);
  if (kind === 'stars') return initStars(opts);
  if (kind === 'thunder') return initThunder(opts);
  return null;
}

function resize() {
  if (!host || !canvas) return;
  const rect = host.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  width = Math.max(1, Math.round(rect.width));
  height = Math.max(1, Math.round(rect.height));
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/**
 * 효과를 시작한다. kind가 null이면 효과 없이 캔버스만 정리한다.
 * @param {HTMLElement} el   .sky 요소 (이 안에 캔버스를 만든다)
 * @param {'rain'|'snow'|'stars'|'thunder'|null} kind
 * @param {{ intensity?: 'light'|'normal'|'heavy', wind?: number }} opts  wind: 0~1
 */
export function setSkyFx(el, kind, opts = {}) {
  stopSkyFx();
  if (!kind) return;
  host = el;
  canvas = document.createElement('canvas');
  canvas.className = 'sky__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  ctx = canvas.getContext('2d');
  resize();

  motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  motionQuery.addEventListener('change', onMotionChange);
  document.addEventListener('visibilitychange', onVisibility);
  resizeObserver = new ResizeObserver(() => {
    resize();
    state = build(kind, { intensity: 'normal', wind: 0, ...opts }); // 크기가 바뀌면 입자를 다시 배치
    start();
  });
  resizeObserver.observe(host);

  state = build(kind, { intensity: 'normal', wind: 0, ...opts });
  start();
}

export function stopSkyFx() {
  cancelAnimationFrame(raf);
  resizeObserver?.disconnect();
  resizeObserver = null;
  motionQuery?.removeEventListener('change', onMotionChange);
  document.removeEventListener('visibilitychange', onVisibility);
  canvas?.remove();
  host = canvas = ctx = state = null;
}

function onMotionChange() {
  start();
}

function onVisibility() {
  if (document.hidden) cancelAnimationFrame(raf);
  else start();
}

// 개발 확인용: 천둥번개 테마에서 번개를 바로 한 번 치게 한다 (콘솔: wearcast.strike())
export function strikeNow() {
  if (state?.kind === 'thunder') {
    state.nextBolt = 0;
    state.bolt = null;
  }
}
