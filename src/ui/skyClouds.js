// 이 파일이 하는 일: 하늘의 구름과 해를 만든다.
// 구름은 캔버스에 부드러운 원 여러 개를 겹쳐 그린 그림(스프라이트)을 한 번만 만들어 두고,
// 그 그림을 화면 위로 천천히 흘려 보낸다 (CSS transform만 쓰므로 가볍다).
// 테마별로 구름 색, 개수, 크기, 위치가 다르다. 바람이 세면 구름이 더 빨리 흐른다.
//
// 구름 종류 (kind)
// - puff: 뭉게구름. 바닥은 평평하고 위쪽은 크고 작은 봉우리가 올록볼록하다
// - wide: 옅고 납작한 띠 구름
// - mass: 하늘 위쪽을 덮는 구름. 위는 꽉 차 있고 아래 가장자리는 울퉁불퉁하다

// 시드 고정 난수: 새로고침해도 같은 모양의 구름이 나온다
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const W = 720;
const H = 320;

// ---- 모양 만들기: 원(blob) 목록을 돌려준다. { x, y, r, a(진하기), sy(세로 납작 비율) } ----

function puffShape(rand) {
  const base = H * 0.74; // 구름 바닥 높이
  const blobs = [];
  const lobes = 5 + Math.floor(rand() * 3);
  for (let i = 0; i < lobes; i += 1) {
    const t = (i + 0.5 + (rand() - 0.5) * 0.5) / lobes;
    const hill = Math.sin(Math.PI * t) ** 0.7; // 가운데가 높고 양 끝이 낮다
    const r = H * (0.12 + 0.17 * hill * (0.6 + 0.4 * rand()));
    const x = W * (0.2 + 0.6 * t);
    const y = base - r * 0.8;
    blobs.push({ x, y, r, a: 0.95 });
    // 큰 덩어리의 위쪽 둘레에 작은 봉우리를 붙인다 (뭉게구름의 올록볼록한 윤곽)
    const bumps = 3 + Math.floor(rand() * 3);
    for (let j = 0; j < bumps; j += 1) {
      const angle = -Math.PI * (0.15 + 0.7 * rand());
      const dist = r * (0.5 + 0.3 * rand());
      blobs.push({ x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist, r: r * (0.35 + 0.3 * rand()), a: 0.8 });
    }
  }
  // 바닥 쪽 빈틈을 메우는 작은 덩어리
  for (let i = 0; i < 9; i += 1) {
    const r = H * (0.08 + 0.07 * rand());
    blobs.push({ x: W * (0.2 + 0.6 * rand()), y: base - r * 0.7, r, a: 0.7 });
  }
  return { blobs, base };
}

function wideShape(rand) {
  const blobs = [];
  for (let i = 0; i < 34; i += 1) {
    const t = 0.12 + 0.76 * rand();
    const taper = Math.sin(Math.PI * t) ** 0.6; // 양 끝으로 갈수록 가늘어진다
    const x = W * t;
    const r = Math.min(W * (0.07 + 0.11 * rand()) * (0.5 + 0.5 * taper), x, W - x);
    blobs.push({ x, y: H * (0.5 + (rand() - 0.5) * 0.16 * taper), r, a: 0.16 + 0.16 * rand(), sy: 0.22 + 0.14 * rand() });
  }
  return { blobs, base: null };
}

function massShape(rand) {
  const blobs = [];
  for (let i = 0; i < 110; i += 1) {
    const x = W * rand();
    const y = H * (0.02 + 0.6 * rand() ** 1.5); // 위쪽에 몰려 있고 아래로 갈수록 드문드문
    // 그림 옆/아래 끝에서 잘리면 직선이 보이므로 그 안쪽에 들어오게 크기를 제한한다 (위쪽은 화면 밖이라 잘려도 됨)
    const r = Math.max(12, Math.min(H * (0.13 + 0.17 * rand()), x, W - x, H * 0.98 - y));
    blobs.push({ x, y, r, a: 0.5 + 0.3 * rand() });
  }
  return { blobs, base: null };
}

const SHAPES = { puff: puffShape, wide: wideShape, mass: massShape };

const spriteCache = new Map();

// 구름 한 장을 그려서 data URL로 돌려준다. rgb: 밝은 면 색, shade: 밑면 그림자 색
function sprite(kind, rgb, shade, seed) {
  const key = `${kind}|${rgb}|${shade}|${seed}`;
  if (spriteCache.has(key)) return spriteCache.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const { blobs, base } = SHAPES[kind](rng(seed));
  const [r, g, b] = rgb;

  // 1) 밝은 면: 가운데는 꽉 차고 가장자리만 부드럽게 풀리는 원을 겹친다
  for (const p of blobs) {
    const sy = p.sy ?? 1;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(1, sy);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.r);
    grad.addColorStop(0, `rgba(${r},${g},${b},${p.a})`);
    grad.addColorStop(0.45, `rgba(${r},${g},${b},${p.a * 0.85})`);
    grad.addColorStop(0.75, `rgba(${r},${g},${b},${p.a * 0.35})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2);
    ctx.restore();
  }

  // 2) 밑면 그림자: 이미 그려진 구름 위에만(source-atop) 아래로 갈수록 짙어지는 색을 덧칠한다
  if (kind !== 'wide') {
    const bottom = base ?? H * 0.8;
    ctx.globalCompositeOperation = 'source-atop';
    const shadeGrad = ctx.createLinearGradient(0, bottom - H * 0.5, 0, bottom);
    shadeGrad.addColorStop(0, `rgba(${shade},0)`);
    shadeGrad.addColorStop(0.6, `rgba(${shade},0.22)`);
    shadeGrad.addColorStop(1, `rgba(${shade},0.6)`);
    ctx.fillStyle = shadeGrad;
    ctx.fillRect(0, 0, W, H);
  }

  // 3) 뭉게구름: 바닥을 평평하게 다듬는다 (바닥 아래로 내려온 부분을 부드럽게 지움)
  if (base !== null) {
    ctx.globalCompositeOperation = 'destination-in';
    const cut = ctx.createLinearGradient(0, base - 14, 0, base + 14);
    cut.addColorStop(0, 'rgba(0,0,0,1)');
    cut.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cut;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.globalCompositeOperation = 'source-over';

  const url = canvas.toDataURL('image/png');
  spriteCache.set(key, url);
  return url;
}

// 테마별 구름. rgb: 밝은 면, shade: 밑면 그림자 색
// items: y(위에서 %), w(화면 폭의 %), o(투명도), dur(화면을 가로지르는 데 걸리는 초)
// 어두운 테마는 글씨가 밝아서 구름도 어둡게/옅게 둔다 (글씨 대비를 해치지 않기 위해)
const CLOUDS = {
  // 맑은 낮: 작은 뭉게구름 몇 점만. 하늘이 주인공이다
  'clear-day': {
    rgb: [255, 255, 255],
    shade: [150, 185, 232],
    items: [
      { k: 'puff', y: 8, w: 58, o: 0.92, dur: 300, delay: -70, seed: 3 },
      { k: 'puff', y: 23, w: 34, o: 0.75, dur: 380, delay: -250, seed: 7 },
      { k: 'wide', y: 54, w: 90, o: 0.6, dur: 460, delay: -120, seed: 11 },
    ],
  },
  'clear-night': {
    rgb: [140, 160, 205],
    shade: [70, 88, 130],
    items: [
      { k: 'wide', y: 14, w: 100, o: 0.5, dur: 420, delay: -60, seed: 5 },
      { k: 'wide', y: 46, w: 80, o: 0.35, dur: 500, delay: -260, seed: 9 },
    ],
  },
  // 흐림: 위쪽을 덮는 구름 + 그 아래를 지나는 뭉게구름
  cloudy: {
    rgb: [238, 243, 248],
    shade: [128, 152, 178],
    items: [
      { k: 'mass', y: -10, w: 210, o: 0.9, dur: 520, seed: 21 },
      { k: 'puff', y: 22, w: 80, o: 0.75, dur: 320, delay: -90, seed: 23 },
      { k: 'puff', y: 44, w: 60, o: 0.55, dur: 400, delay: -250, seed: 27 },
      { k: 'wide', y: 62, w: 120, o: 0.6, dur: 460, delay: -140, seed: 29 },
    ],
  },
  'cloudy-night': {
    rgb: [96, 112, 140],
    shade: [38, 50, 70],
    items: [
      { k: 'mass', y: -12, w: 190, o: 0.7, dur: 560, seed: 31 },
      { k: 'puff', y: 24, w: 80, o: 0.4, dur: 360, delay: -140, seed: 33 },
      { k: 'wide', y: 52, w: 120, o: 0.5, dur: 480, delay: -80, seed: 35 },
    ],
  },
  rain: {
    rgb: [34, 50, 68],
    shade: [10, 18, 28],
    items: [
      { k: 'mass', y: -14, w: 210, o: 0.95, dur: 420, seed: 41 },
      { k: 'mass', y: 4, w: 170, o: 0.6, dur: 320, delay: -160, seed: 43 },
      { k: 'wide', y: 42, w: 130, o: 0.6, dur: 360, delay: -70, seed: 45 },
    ],
  },
  snow: {
    rgb: [236, 241, 248],
    shade: [150, 168, 192],
    items: [
      { k: 'mass', y: -14, w: 200, o: 0.85, dur: 560, seed: 51 },
      { k: 'wide', y: 34, w: 130, o: 0.7, dur: 420, delay: -150, seed: 53 },
    ],
  },
  thunder: {
    rgb: [22, 26, 40],
    shade: [4, 6, 12],
    items: [
      { k: 'mass', y: -16, w: 220, o: 1, dur: 400, seed: 61 },
      { k: 'mass', y: 2, w: 170, o: 0.75, dur: 300, delay: -120, seed: 63 },
      { k: 'puff', y: 28, w: 90, o: 0.5, dur: 340, delay: -60, seed: 65 },
    ],
  },
  fog: {
    rgb: [255, 255, 255],
    shade: [255, 255, 255],
    items: [
      { k: 'wide', y: 4, w: 150, o: 0.8, dur: 500, seed: 71 },
      { k: 'wide', y: 28, w: 170, o: 0.9, dur: 420, delay: -180, seed: 73 },
      { k: 'wide', y: 52, w: 150, o: 0.9, dur: 460, delay: -90, seed: 75 },
      { k: 'wide', y: 72, w: 180, o: 0.8, dur: 380, delay: -250, seed: 77 },
    ],
  },
  'fog-night': {
    rgb: [150, 158, 172],
    shade: [150, 158, 172],
    items: [
      { k: 'wide', y: 8, w: 150, o: 0.45, dur: 520, seed: 81 },
      { k: 'wide', y: 38, w: 170, o: 0.5, dur: 440, delay: -200, seed: 83 },
      { k: 'wide', y: 68, w: 160, o: 0.45, dur: 480, delay: -100, seed: 85 },
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
      return `<img class="sky__cloud-img${sway ? ' sky__cloud-img--sway' : ''}" alt="" draggable="false" src="${sprite(it.k, cfg.rgb, cfg.shade, it.seed)}" style="${style}" />`;
    })
    .join('');
}

// ---- 해 (맑은 낮) ----
// 윤곽이 보이는 동그라미 대신 "빛"으로 그린다: 하늘 전체에 번지는 빛(wash) + 넓은 햇무리(halo) + 하얗게 날아간 중심(core).
// 오른쪽 위 모서리에 걸쳐 놓아서 글씨를 가리지 않는다. 모양과 색은 themes.css.
export function sunHtml() {
  return '<div class="sky__wash"></div><div class="sky__sun"><div class="sky__halo"></div><div class="sky__core"></div></div>';
}
