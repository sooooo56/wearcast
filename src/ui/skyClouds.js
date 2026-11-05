// 이 파일이 하는 일: 하늘의 구름과 해(태양, 렌즈 플레어)를 만든다.
// 구름은 캔버스에 부드러운 원 수십 개를 겹쳐 그린 그림(스프라이트)을 한 번만 만들어 두고,
// 그 그림을 화면 위로 천천히 흘려 보낸다 (CSS transform만 쓰므로 가볍다).
// 테마별로 구름 색, 개수, 크기, 위치가 다르다. 바람이 세면 구름이 더 빨리 흐른다.

// 시드 고정 난수: 새로고침해도 같은 모양의 구름이 나온다
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const W = 720;
const H = 300;

// kind: puff(뭉게구름) / wide(옅고 넓은 띠) / mass(하늘을 덮는 짙은 구름)
const KINDS = {
  puff: { count: 46, rMin: 0.14, rMax: 0.32, alpha: 0.62, mound: 0.95, spread: [0.14, 0.86] },
  wide: { count: 56, rMin: 0.1, rMax: 0.24, alpha: 0.36, mound: 0.25, spread: [0.04, 0.96] },
  mass: { count: 120, rMin: 0.2, rMax: 0.5, alpha: 0.62, mound: 0.45, spread: [0.02, 0.98] },
};

const spriteCache = new Map();

// 구름 한 장을 그려서 data URL로 돌려준다
function sprite(kind, [r, g, b], seed) {
  const key = `${kind}|${r},${g},${b}|${seed}`;
  if (spriteCache.has(key)) return spriteCache.get(key);

  const cfg = KINDS[kind];
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const rand = rng(seed);

  // 먼저 모든 뭉치의 위치/크기를 정한다
  const puffs = [];
  for (let i = 0; i < cfg.count; i += 1) {
    const t = cfg.spread[0] + rand() * (cfg.spread[1] - cfg.spread[0]);
    // 가운데가 솟은 봉우리 모양: 양 끝은 낮고 가운데는 높다
    const hill = Math.sin(Math.PI * ((t - cfg.spread[0]) / (cfg.spread[1] - cfg.spread[0]))) ** 0.8;
    const cy = H * (0.68 - 0.42 * hill * cfg.mound * (0.5 + 0.5 * rand())) + (rand() - 0.5) * H * 0.14;
    const wanted = H * (cfg.rMin + (cfg.rMax - cfg.rMin) * rand() * (0.55 + 0.45 * hill));
    puffs.push({
      cx: W * t,
      cy,
      // 그림 가장자리에서 뭉치가 잘리면 구름 끝이 직선으로 보이므로, 캔버스 안에 들어오게 크기를 제한한다
      radius: Math.max(14, Math.min(wanted, cy, H * 0.96 - cy)),
      a: cfg.alpha * (0.6 + 0.4 * rand()),
    });
  }
  const paint = (p, [pr, pg, pb], dy, alphaScale) => {
    const cy = p.cy + dy;
    const grad = ctx.createRadialGradient(p.cx, cy, 0, p.cx, cy, p.radius);
    const a = p.a * alphaScale;
    grad.addColorStop(0, `rgba(${pr},${pg},${pb},${a})`);
    grad.addColorStop(0.5, `rgba(${pr},${pg},${pb},${a * 0.55})`);
    grad.addColorStop(1, `rgba(${pr},${pg},${pb},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(p.cx - p.radius, cy - p.radius, p.radius * 2, p.radius * 2);
  };
  // 아래쪽: 조금 어두운 색으로 그림자 층 (구름 밑면이 어두운 것처럼)
  const shade = [Math.round(r * 0.78), Math.round(g * 0.8), Math.round(b * 0.86)];
  for (const p of puffs) paint(p, shade, p.radius * 0.28, 0.75);
  // 위쪽: 밝은 면
  for (const p of puffs) paint(p, [r, g, b], -p.radius * 0.06, 1);
  // 가장자리 페이드: 뭉치가 그림 끝에서 잘려도 직선이 보이지 않게, 위/아래/좌우를 부드럽게 투명하게 만든다
  ctx.globalCompositeOperation = 'destination-in';
  const fadeV = ctx.createLinearGradient(0, 0, 0, H);
  fadeV.addColorStop(0, 'rgba(0,0,0,0)');
  fadeV.addColorStop(0.1, 'rgba(0,0,0,1)');
  fadeV.addColorStop(0.5, 'rgba(0,0,0,1)');
  fadeV.addColorStop(0.7, 'rgba(0,0,0,0.5)');
  fadeV.addColorStop(0.86, 'rgba(0,0,0,0.14)');
  fadeV.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = fadeV;
  ctx.fillRect(0, 0, W, H);
  const fadeH = ctx.createLinearGradient(0, 0, W, 0);
  fadeH.addColorStop(0, 'rgba(0,0,0,0)');
  fadeH.addColorStop(0.1, 'rgba(0,0,0,1)');
  fadeH.addColorStop(0.9, 'rgba(0,0,0,1)');
  fadeH.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = fadeH;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';

  const url = canvas.toDataURL('image/png');
  spriteCache.set(key, url);
  return url;
}

// 테마별 구름. y: 위에서 %, w: 화면 폭의 %, o: 투명도, dur: 화면을 가로지르는 데 걸리는 초
// 어두운 테마는 글씨가 밝아서 구름도 어둡게/옅게 둔다 (글씨 대비를 해치지 않기 위해)
const CLOUDS = {
  'clear-day': {
    rgb: [255, 255, 255],
    items: [
      { k: 'puff', y: 4, w: 78, o: 0.75, dur: 260, seed: 3 },
      { k: 'puff', y: 24, w: 58, o: 0.55, dur: 340, delay: -150, seed: 7 },
      { k: 'wide', y: 52, w: 110, o: 0.5, dur: 420, delay: -60, seed: 11 },
    ],
  },
  'clear-night': {
    rgb: [140, 160, 205],
    items: [
      { k: 'wide', y: 12, w: 100, o: 0.32, dur: 380, seed: 5 },
      { k: 'puff', y: 40, w: 60, o: 0.2, dur: 460, delay: -200, seed: 9 },
    ],
  },
  cloudy: {
    rgb: [246, 249, 252],
    items: [
      { k: 'mass', y: -10, w: 210, o: 1, dur: 520, seed: 21 },
      { k: 'puff', y: 12, w: 85, o: 0.7, dur: 300, delay: -90, seed: 23 },
      { k: 'puff', y: 34, w: 70, o: 0.55, dur: 380, delay: -230, seed: 27 },
      { k: 'wide', y: 58, w: 120, o: 0.45, dur: 440, delay: -120, seed: 29 },
    ],
  },
  'cloudy-night': {
    rgb: [96, 112, 140],
    items: [
      { k: 'mass', y: -12, w: 170, o: 0.7, dur: 560, seed: 31 },
      { k: 'puff', y: 20, w: 80, o: 0.4, dur: 360, delay: -140, seed: 33 },
      { k: 'wide', y: 50, w: 120, o: 0.34, dur: 480, delay: -80, seed: 35 },
    ],
  },
  rain: {
    rgb: [18, 30, 44],
    items: [
      { k: 'mass', y: -16, w: 190, o: 0.95, dur: 420, seed: 41 },
      { k: 'mass', y: 2, w: 150, o: 0.7, dur: 320, delay: -160, seed: 43 },
      { k: 'wide', y: 40, w: 130, o: 0.4, dur: 360, delay: -70, seed: 45 },
    ],
  },
  snow: {
    rgb: [214, 224, 238],
    items: [
      { k: 'mass', y: -14, w: 180, o: 0.85, dur: 560, seed: 51 },
      { k: 'wide', y: 30, w: 130, o: 0.5, dur: 420, delay: -150, seed: 53 },
    ],
  },
  thunder: {
    rgb: [8, 11, 20],
    items: [
      { k: 'mass', y: -18, w: 200, o: 1, dur: 400, seed: 61 },
      { k: 'mass', y: 0, w: 160, o: 0.8, dur: 300, delay: -120, seed: 63 },
      { k: 'puff', y: 24, w: 90, o: 0.5, dur: 340, delay: -60, seed: 65 },
    ],
  },
  fog: {
    rgb: [255, 255, 255],
    items: [
      { k: 'wide', y: 6, w: 150, o: 0.55, dur: 500, seed: 71 },
      { k: 'wide', y: 30, w: 170, o: 0.6, dur: 420, delay: -180, seed: 73 },
      { k: 'wide', y: 54, w: 150, o: 0.6, dur: 460, delay: -90, seed: 75 },
      { k: 'wide', y: 76, w: 180, o: 0.55, dur: 380, delay: -250, seed: 77 },
    ],
  },
  'fog-night': {
    rgb: [150, 158, 172],
    items: [
      { k: 'wide', y: 10, w: 150, o: 0.28, dur: 520, seed: 81 },
      { k: 'wide', y: 40, w: 170, o: 0.3, dur: 440, delay: -200, seed: 83 },
      { k: 'wide', y: 70, w: 160, o: 0.28, dur: 480, delay: -100, seed: 85 },
    ],
  },
};

// 구름 층 HTML. wind: 0~1 (센 바람일수록 빨리 흐른다)
export function cloudsHtml(theme, wind = 0) {
  const cfg = CLOUDS[theme];
  if (!cfg) return '';
  const speedUp = 1 + wind * 1.6;
  return cfg.items
    .map((it) => {
      // 하늘을 덮는 큰 구름(mass)은 화면을 가로지르지 않고 제자리에서 천천히 흔들린다 (안 그러면 절반은 화면 밖에 있게 됨)
      const sway = it.k === 'mass';
      const dur = Math.max(sway ? 50 : 0, Math.round((sway ? it.dur / 6 : it.dur) / speedUp));
      const style = `--y:${it.y}%;--w:${it.w}vw;--o:${it.o};--dur:${dur}s;--delay:${it.delay ?? 0}s`;
      return `<img class="sky__cloud-img${sway ? ' sky__cloud-img--sway' : ''}" alt="" draggable="false" src="${sprite(it.k, cfg.rgb, it.seed)}" style="${style}" />`;
    })
    .join('');
}

// ---- 해 (맑은 낮) ----
// 실제 해처럼 "하얗게 날아간 중심 + 따뜻한 햇무리"만 둔다. 오른쪽 위 모서리 가까이에 놓아서 글씨를 가리지 않는다.
export function sunHtml() {
  return '<div class="sky__sun"><div class="sky__halo"></div><div class="sky__core"></div></div>';
}
