(() => {
  'use strict';

  // ---------- text ----------

  const TEXT = {
    ru: {
      title: 'Әсем Жол: ночная гонка по Алматы',
      tag: 'Ночная гонка по Алматы до Медеу. Обгоняй, успевай к чекпоинтам, бей свой рекорд.',
      start: 'Поехали',
      keys: '← → руль, ↓ тормоз, P пауза. Газ жмётся сам.',
      keysTouch: 'Держи палец слева или справа, чтобы рулить. Двумя пальцами сразу: тормоз. Газ жмётся сам.',
      best: 'Рекорд: {d} км',
      noBest: 'Рекорда пока нет',
      kmh: 'км/ч',
      km: 'км',
      zones: ['Проспект Абая', 'Аль-Фараби', 'Горная дорога', 'Медеу'],
      gates: ['ӘСЕМ ЖОЛ', 'АЛЬ-ФАРАБИ', 'ГОРНАЯ ДОРОГА', 'МЕДЕУ'],
      checkpoint: '+{s} с',
      lap: 'Круг {n}',
      go: 'Газ!',
      paused: 'Пауза',
      resume: 'Продолжить',
      restart: 'Заново',
      overTitle: 'Время вышло',
      overSub: 'Проехано',
      record: 'Новый рекорд',
      again: 'Ещё раз',
      share: 'Поделиться',
      copied: 'Ссылка скопирована',
      shareText: 'Мой результат в «Әсем Жол»: {d} км по ночной Алматы. Побьёшь?',
      brake: 'Тормоз',
      soundOn: 'Звук',
      soundOff: 'Тихо',
      pause: 'Пауза',
      more: 'Ещё игра: тест реакции на gamemetric.dev',
      boards: ['АЛМАТЫ', 'МЕДЕУ 12 КМ', 'ШЫМБУЛАК', 'GAMEMETRIC.DEV', 'АПОРТ', 'ASEMFACE.COM'],
    },
    en: {
      title: 'Asem Road: a night race through Almaty',
      tag: 'A night race through Almaty up to Medeu. Overtake, make the checkpoints, beat your best.',
      start: 'Drive',
      keys: '← → steer, ↓ brake, P pause. The gas is automatic.',
      keysTouch: 'Hold a finger on the left or right side to steer. Both sides at once to brake. The gas is automatic.',
      best: 'Best: {d} km',
      noBest: 'No best yet',
      kmh: 'km/h',
      km: 'km',
      zones: ['Abay Avenue', 'Al-Farabi Avenue', 'Mountain road', 'Medeu'],
      gates: ['ASEM ROAD', 'AL-FARABI', 'MOUNTAIN ROAD', 'MEDEU'],
      checkpoint: '+{s} s',
      lap: 'Lap {n}',
      go: 'Go!',
      paused: 'Paused',
      resume: 'Resume',
      restart: 'Restart',
      overTitle: 'Time is up',
      overSub: 'Distance',
      record: 'New best',
      again: 'Again',
      share: 'Share',
      copied: 'Link copied',
      shareText: 'I drove {d} km through night Almaty in Asem Road. Can you beat it?',
      brake: 'Brake',
      soundOn: 'Sound',
      soundOff: 'Muted',
      pause: 'Pause',
      more: 'One more game: a reaction test at gamemetric.dev',
      boards: ['ALMATY', 'MEDEU 12 KM', 'SHYMBULAK', 'GAMEMETRIC.DEV', 'APORT', 'ASEMFACE.COM'],
    },
  };

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
    },
  };

  let lang = (() => {
    const fromUrl = new URLSearchParams(location.search).get('lang');
    if (fromUrl && TEXT[fromUrl]) return fromUrl;
    const saved = store.get('asem.lang', null);
    if (saved && TEXT[saved]) return saved;
    const nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'ru';
    return /^(ru|kk|ky|be|uz|tg|uk)\b/i.test(nav) ? 'ru' : 'en';
  })();
  const t = (key, vars) => {
    let s = TEXT[lang][key] ?? TEXT.ru[key] ?? key;
    if (vars && typeof s === 'string') s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
    return s;
  };
  const km = (d) => d.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ---------- math ----------

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const easeIn = (a, b, k) => a + (b - a) * k * k;
  const easeInOut = (a, b, k) => a + (b - a) * (-Math.cos(k * Math.PI) / 2 + 0.5);
  const wrap = (v, max) => ((v % max) + max) % max;
  const fogAt = (d, density) => 1 / Math.exp(d * d * density);
  const overlap = (x1, w1, x2, w2) => !(x1 + w1 / 2 < x2 - w2 / 2 || x1 - w1 / 2 > x2 + w2 / 2);
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  function hex(c) {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, k) {
    const x = hex(a);
    const y = hex(b);
    return `rgb(${Math.round(lerp(x[0], y[0], k))},${Math.round(lerp(x[1], y[1], k))},${Math.round(lerp(x[2], y[2], k))})`;
  }

  // ---------- road constants ----------
  // The road is drawn the classic pseudo-3D way: a list of flat segments projected
  // onto the screen, with curves faked by shifting each segment sideways.

  const SEG = 200;
  const RUMBLE = 3;
  const LANES = 3;
  const ROAD_W = 2000;
  const CAM_H = 1000;
  const FOV = 100;
  const DRAW = 240;
  const FOG = 5;
  const CAM_DEPTH = 1 / Math.tan(((FOV / 2) * Math.PI) / 180);
  const PLAYER_Z = CAM_H * CAM_DEPTH;
  const MAX_SPEED = SEG * 60;
  const ACCEL = MAX_SPEED / 5;
  const BRAKE = -MAX_SPEED;
  const DECEL = -MAX_SPEED / 5;
  const OFFROAD_DECEL = -MAX_SPEED / 2;
  const OFFROAD_LIMIT = MAX_SPEED / 4;
  const CENTRIFUGAL = 0.3;
  const CAR_W = 640;
  const PLAYER_W = CAR_W / ROAD_W;
  const KMH_AT_MAX = 240;
  const STEP = 1 / 60;
  const FOG_COLOR = '#1b2442';
  const LANE_X = [-2 / 3, 0, 2 / 3];

  const ZONES = [
    { grass: ['#1f232c', '#1b1f27'], road: ['#3b404c', '#363b46'] },
    { grass: ['#16291e', '#13241a'], road: ['#3b404c', '#363b46'] },
    { grass: ['#5f6b7f', '#586377'], road: ['#3a3f4a', '#353a44'] },
    { grass: ['#6f7b90', '#677388'], road: ['#3a3f4a', '#353a44'] },
  ];

  // ---------- sprites, all drawn with canvas shapes ----------

  function roundRect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawCar(c, x, y, w, h, color, braking) {
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillRect(x + w * 0.02, y + h * 0.9, w * 0.96, h * 0.1);
    c.fillStyle = '#0b0d10';
    c.fillRect(x + w * 0.07, y + h * 0.7, w * 0.17, h * 0.3);
    c.fillRect(x + w * 0.76, y + h * 0.7, w * 0.17, h * 0.3);
    c.fillStyle = color;
    roundRect(c, x, y + h * 0.36, w, h * 0.48, h * 0.1);
    c.fill();
    c.beginPath();
    c.moveTo(x + w * 0.13, y + h * 0.4);
    c.lineTo(x + w * 0.25, y + h * 0.04);
    c.lineTo(x + w * 0.75, y + h * 0.04);
    c.lineTo(x + w * 0.87, y + h * 0.4);
    c.closePath();
    c.fill();
    c.fillStyle = 'rgba(0,0,0,0.28)';
    c.fill();
    c.fillStyle = '#16202f';
    c.beginPath();
    c.moveTo(x + w * 0.2, y + h * 0.37);
    c.lineTo(x + w * 0.29, y + h * 0.1);
    c.lineTo(x + w * 0.71, y + h * 0.1);
    c.lineTo(x + w * 0.8, y + h * 0.37);
    c.closePath();
    c.fill();
    if (w > 18) {
      c.fillStyle = braking ? 'rgba(255,60,50,0.35)' : 'rgba(255,40,40,0.18)';
      c.fillRect(x - w * 0.03, y + h * 0.44, w * 0.3, h * 0.2);
      c.fillRect(x + w * 0.73, y + h * 0.44, w * 0.3, h * 0.2);
    }
    c.fillStyle = braking ? '#ff4a3d' : '#b81f24';
    c.fillRect(x + w * 0.03, y + h * 0.48, w * 0.2, h * 0.1);
    c.fillRect(x + w * 0.77, y + h * 0.48, w * 0.2, h * 0.1);
    if (w > 30) {
      c.fillStyle = '#d9dde3';
      c.fillRect(x + w * 0.4, y + h * 0.62, w * 0.2, h * 0.08);
    }
  }

  const SPRITES = {
    lamp: {
      w: 600, h: 2700, hit: 0.15,
      draw(c, x, y, w, h, s) {
        const poleW = Math.max(1, w * 0.06);
        const px = s.offset > 0 ? x + w * 0.88 : x + w * 0.06;
        c.fillStyle = '#272c37';
        c.fillRect(px, y + h * 0.03, poleW, h * 0.97);
        const headW = w * 0.24;
        const headX = s.offset > 0 ? x : x + w - headW;
        const armY = y + h * 0.03;
        const armH = Math.max(1, h * 0.012);
        c.fillRect(Math.min(px, headX), armY, Math.abs(px - headX) + poleW, armH);
        c.fillStyle = '#ffd48c';
        c.fillRect(headX, armY + armH, headW, Math.max(1, h * 0.014));
        if (w > 4) {
          const gx = headX + headW / 2;
          const gy = armY + armH * 2;
          const gr = w * 0.9;
          const g = c.createRadialGradient(gx, gy, 0, gx, gy, gr);
          g.addColorStop(0, 'rgba(255,196,120,0.5)');
          g.addColorStop(1, 'rgba(255,196,120,0)');
          c.fillStyle = g;
          c.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
        }
      },
    },
    poplar: {
      w: 420, h: 2500, hit: 0.3,
      draw(c, x, y, w, h) {
        c.fillStyle = '#2a2119';
        c.fillRect(x + w * 0.45, y + h * 0.82, w * 0.1, h * 0.18);
        c.fillStyle = '#1a2f22';
        c.beginPath();
        c.ellipse(x + w / 2, y + h * 0.45, w * 0.46, h * 0.43, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#13241a';
        c.beginPath();
        c.ellipse(x + w * 0.62, y + h * 0.48, w * 0.28, h * 0.38, 0, 0, Math.PI * 2);
        c.fill();
      },
    },
    apple: {
      w: 950, h: 1150, hit: 0.4,
      draw(c, x, y, w, h) {
        c.fillStyle = '#2e241a';
        c.fillRect(x + w * 0.45, y + h * 0.6, w * 0.1, h * 0.4);
        c.fillStyle = '#1c3324';
        c.beginPath();
        c.ellipse(x + w / 2, y + h * 0.38, w * 0.48, h * 0.36, 0, 0, Math.PI * 2);
        c.fill();
        if (w > 16) {
          c.fillStyle = '#b8352e';
          const r = Math.max(1, w * 0.035);
          for (const [ax, ay] of [[0.3, 0.3], [0.55, 0.22], [0.7, 0.42], [0.42, 0.5], [0.22, 0.47], [0.6, 0.58]]) {
            c.beginPath();
            c.arc(x + w * ax, y + h * ay, r, 0, Math.PI * 2);
            c.fill();
          }
        }
      },
    },
    pine: {
      w: 820, h: 1800, hit: 0.35,
      draw(c, x, y, w, h) {
        c.fillStyle = '#2a2119';
        c.fillRect(x + w * 0.45, y + h * 0.85, w * 0.1, h * 0.15);
        const tiers = [[0.0, 0.42, 0.32], [0.24, 0.66, 0.42], [0.48, 0.88, 0.5]];
        for (const [top, bottom, half] of tiers) {
          c.fillStyle = '#15291e';
          c.beginPath();
          c.moveTo(x + w / 2, y + h * top);
          c.lineTo(x + w * (0.5 + half), y + h * bottom);
          c.lineTo(x + w * (0.5 - half), y + h * bottom);
          c.closePath();
          c.fill();
          c.fillStyle = '#c3cede';
          c.beginPath();
          c.moveTo(x + w / 2, y + h * top);
          c.lineTo(x + w * (0.5 + half * 0.35), y + h * (top + (bottom - top) * 0.35));
          c.lineTo(x + w * (0.5 - half * 0.35), y + h * (top + (bottom - top) * 0.35));
          c.closePath();
          c.fill();
        }
      },
    },
    building: {
      w: 2400, h: 4000, hit: 0.95,
      draw(c, x, y, w, h, s) {
        c.fillStyle = s.color;
        c.fillRect(x, y, w, h);
        c.fillStyle = 'rgba(255,255,255,0.05)';
        c.fillRect(x, y, w, Math.max(1, h * 0.012));
        if (w < 14) return;
        const cols = s.cols;
        const rows = s.rows;
        const cw = w / (cols + 1);
        const rh = h / (rows + 1);
        const ww = cw * 0.5;
        const wh = rh * 0.45;
        for (let r = 0; r < rows; r++) {
          for (let q = 0; q < cols; q++) {
            const lit = s.lit[r * cols + q];
            if (!lit) continue;
            c.fillStyle = lit === 1 ? '#f2c46c' : '#9fc0e8';
            c.fillRect(x + cw * (q + 0.75), y + rh * (r + 0.8), ww, wh);
          }
        }
      },
    },
    billboard: {
      w: 1500, h: 1350, hit: 0.9,
      draw(c, x, y, w, h, s) {
        c.fillStyle = '#272c37';
        c.fillRect(x + w * 0.2, y + h * 0.5, w * 0.05, h * 0.5);
        c.fillRect(x + w * 0.75, y + h * 0.5, w * 0.05, h * 0.5);
        c.fillStyle = '#0d1220';
        c.fillRect(x, y, w, h * 0.55);
        c.fillStyle = '#ffb547';
        c.fillRect(x, y, w, Math.max(1, h * 0.03));
        c.fillRect(x, y + h * 0.52, w, Math.max(1, h * 0.03));
        if (h < 14) return;
        const text = TEXT[lang].boards[s.text];
        let size = h * 0.2;
        c.font = `800 ${size}px ${'"Segoe UI", system-ui, sans-serif'}`;
        const max = w * 0.86;
        const width = c.measureText(text).width;
        if (width > max) {
          size *= max / width;
          c.font = `800 ${size}px ${'"Segoe UI", system-ui, sans-serif'}`;
        }
        c.fillStyle = '#f1f3f7';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(text, x + w / 2, y + h * 0.28);
      },
    },
    rock: {
      w: 900, h: 480, hit: 0.8,
      draw(c, x, y, w, h) {
        c.fillStyle = '#3d4555';
        c.beginPath();
        c.moveTo(x, y + h);
        c.lineTo(x + w * 0.12, y + h * 0.35);
        c.lineTo(x + w * 0.42, y);
        c.lineTo(x + w * 0.78, y + h * 0.2);
        c.lineTo(x + w, y + h);
        c.closePath();
        c.fill();
        c.fillStyle = '#b9c4d4';
        c.beginPath();
        c.moveTo(x + w * 0.3, y + h * 0.13);
        c.lineTo(x + w * 0.42, y);
        c.lineTo(x + w * 0.62, y + h * 0.1);
        c.closePath();
        c.fill();
      },
    },
  };

  // ---------- track ----------

  let segments = [];
  let trackLength = 0;
  let zoneStart = [];
  let zoneSeconds = [];
  let cars = [];
  let currentZoneBuild = 0;

  const segAt = (z) => segments[Math.floor(z / SEG) % segments.length];
  const lastY = () => (segments.length ? segments[segments.length - 1].p2.y : 0);

  function addSegment(curve, y) {
    const n = segments.length;
    segments.push({
      i: n,
      p1: { y: lastY(), z: n * SEG },
      p2: { y, z: (n + 1) * SEG },
      curve,
      zone: currentZoneBuild,
      sprites: [],
      cars: [],
      gate: false,
      lit: 0,
    });
  }
  function addRoad(enter, hold, leave, curve, hill) {
    const startY = lastY();
    const endY = startY + Math.round(hill) * SEG;
    const total = enter + hold + leave;
    for (let n = 0; n < enter; n++) addSegment(easeIn(0, curve, n / enter), easeInOut(startY, endY, n / total));
    for (let n = 0; n < hold; n++) addSegment(curve, easeInOut(startY, endY, (enter + n) / total));
    for (let n = 0; n < leave; n++) addSegment(easeInOut(curve, 0, n / leave), easeInOut(startY, endY, (enter + hold + n) / total));
  }
  function zone(z) {
    currentZoneBuild = z;
    zoneStart[z] = segments.length;
  }

  function buildTrack() {
    segments = [];
    zoneStart = [];
    zone(0); // Abay Avenue: long, mostly straight, flat
    addRoad(30, 60, 30, 0, 0);
    addRoad(50, 50, 50, 2, 0);
    addRoad(25, 40, 25, 0, 0);
    addRoad(50, 50, 50, -2, 4);
    addRoad(30, 60, 30, 0, -4);
    addRoad(40, 40, 40, 3, 0);
    zone(1); // Al-Farabi: wide sweeping curves, gentle hills
    addRoad(50, 60, 50, -3, 10);
    addRoad(30, 30, 30, 0, -6);
    addRoad(40, 40, 40, 4, 8);
    addRoad(30, 30, 30, -4, -6);
    addRoad(40, 60, 40, 2, 10);
    addRoad(30, 30, 30, -2, 0);
    zone(2); // mountain road: climbing switchbacks
    addRoad(40, 40, 40, 5, 25);
    addRoad(30, 30, 30, -6, 20);
    addRoad(30, 30, 30, 6, 25);
    addRoad(40, 30, 40, -5, 15);
    addRoad(30, 30, 30, 3, 30);
    addRoad(25, 25, 25, -6, 10);
    zone(3); // Medeu, then the long way back down to the city
    addRoad(40, 50, 40, 0, 40);
    addRoad(30, 30, 30, -4, 10);
    addRoad(50, 100, 50, 2, 0);
    addRoad(60, 60, 60, -3, -20);
    addRoad(100, 100, 100, 2, -Math.round(lastY() / SEG));
    addRoad(30, 40, 30, 0, 0);
    trackLength = segments.length * SEG;
    zoneSeconds = zoneStart.map((start, z) => {
      const end = z + 1 < zoneStart.length ? zoneStart[z + 1] : segments.length;
      return Math.round((end - start) / 50);
    });
    decorate();
    paint();
  }

  function addSprite(i, type, offset, extra) {
    const seg = segments[wrap(i, segments.length)];
    seg.sprites.push({ def: SPRITES[type], type, offset, ...extra });
  }

  function decorate() {
    const r = rng(20261014);
    const N = segments.length;
    for (let i = 0; i < N; i++) {
      const z = segments[i].zone;
      const side = r() < 0.5 ? -1 : 1;
      if (z <= 1 && i % 16 === 0) {
        addSprite(i, 'lamp', -1.08);
        addSprite(i + 8, 'lamp', 1.08);
      }
      if (z === 0) {
        if (i % 6 === 0) {
          const cols = 3 + Math.floor(r() * 4);
          const rows = 5 + Math.floor(r() * 9);
          const lit = Array.from({ length: cols * rows }, () => (r() < 0.38 ? (r() < 0.82 ? 1 : 2) : 0));
          const shade = Math.floor(r() * 3);
          addSprite(i, 'building', side * (2.05 + r() * 1.4), {
            w: 1800 + r() * 1400,
            h: 2400 + rows * 260,
            cols,
            rows,
            lit,
            color: ['#141a28', '#171d2c', '#11161f'][shade],
          });
        }
        if (i % 9 === 4) addSprite(i, 'poplar', side * (1.3 + r() * 0.3));
      } else if (z === 1) {
        if (i % 5 === 2) addSprite(i, 'poplar', (i % 10 === 2 ? -1 : 1) * 1.35);
        if (i % 11 === 6) addSprite(i, 'apple', side * (1.7 + r() * 1.6));
        if (i % 13 === 3 && r() < 0.6) addSprite(i, 'apple', -side * (2.6 + r() * 1.5));
      } else {
        if (r() < 0.32) addSprite(i, 'pine', side * (1.25 + r() * 3.2));
        if (r() < 0.12) addSprite(i, 'pine', -side * (1.6 + r() * 3));
        if (r() < 0.025) addSprite(i, 'rock', side * (1.3 + r() * 0.8));
      }
    }
    const boards = [
      [zoneStart[0] + 220, 3, 1.3],
      [zoneStart[0] + 520, 0, -1.3],
      [zoneStart[1] + 90, 4, 1.35],
      [zoneStart[1] + 400, 5, -1.35],
      [zoneStart[2] + 40, 1, 1.3],
      [zoneStart[3] + 60, 2, -1.3],
    ];
    for (const [i, text, offset] of boards) {
      const seg = segments[i];
      seg.sprites = seg.sprites.filter((s) => Math.sign(s.offset) !== Math.sign(offset) || Math.abs(s.offset) > 2);
      addSprite(i, 'billboard', offset, { text });
    }
    for (let z = 0; z < zoneStart.length; z++) {
      const seg = segments[zoneStart[z] + 4];
      seg.gate = z + 1;
      seg.sprites = seg.sprites.filter((s) => Math.abs(s.offset) > 1.6);
    }
    // streetlight pools on the asphalt
    for (const seg of segments) {
      if (!seg.sprites.some((s) => s.type === 'lamp')) continue;
      for (let d = -4; d <= 4; d++) {
        const other = segments[wrap(seg.i + d, N)];
        other.lit = Math.max(other.lit, 1 - Math.abs(d) / 5);
      }
    }
  }

  function paint() {
    for (const seg of segments) {
      const light = Math.floor(seg.i / RUMBLE) % 2 === 0;
      const zc = ZONES[seg.zone];
      const k = seg.lit;
      seg.color = {
        road: mix(zc.road[light ? 0 : 1], '#e9b36d', k * 0.2),
        grass: mix(zc.grass[light ? 0 : 1], '#e9b36d', k * 0.12),
        rumble: light ? mix('#c9ced8', '#ffe2b0', k * 0.3) : mix('#a8343a', '#e06a50', k * 0.25),
        lane: light ? mix('#cfd4dc', '#fff0d0', k * 0.4) : null,
      };
    }
  }

  const CAR_COLORS = ['#4b6fa5', '#7d8590', '#2f6f5e', '#c9b458', '#8c4a3a', '#d9dde3', '#30343c', '#5b4a8a', '#a0522d'];
  function spawnCars(count, seed) {
    for (const seg of segments) seg.cars.length = 0;
    cars = [];
    const r = rng(seed);
    for (let n = 0; n < count; n++) {
      const segIndex = 40 + Math.floor(r() * (segments.length - 60));
      const car = {
        offset: LANE_X[Math.floor(r() * 3)] + (r() - 0.5) * 0.12,
        z: segIndex * SEG,
        speed: MAX_SPEED * (0.2 + r() * 0.26),
        color: CAR_COLORS[Math.floor(r() * CAR_COLORS.length)],
        percent: 0,
      };
      segments[segIndex].cars.push(car);
      cars.push(car);
    }
  }

  // ---------- canvas and background ----------

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  let W = 0;
  let H = 0;
  let FX = 0;
  let FY = 0;
  let HORIZON = 0;
  const layers = {};

  function offscreen(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }

  function resize() {
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    let scale = Math.min(window.devicePixelRatio || 1, 1.5);
    const budget = 1500000;
    if (cssW * cssH * scale * scale > budget) scale = Math.sqrt(budget / (cssW * cssH));
    W = Math.round(cssW * scale);
    H = Math.round(cssH * scale);
    canvas.width = W;
    canvas.height = H;
    FX = W / 2;
    FY = Math.min(H / 2, W * 0.9);
    HORIZON = H - FY;
    buildLayers();
  }

  function ridge(c, w, h, base, amp, seed, detail) {
    const r = rng(seed);
    const phases = [r() * 6, r() * 6, r() * 6];
    const pts = [];
    const steps = 120;
    for (let n = 0; n <= steps; n++) {
      const k = n / steps;
      const a = Math.sin(k * Math.PI * 2 * 2 + phases[0]) * 0.5 + Math.sin(k * Math.PI * 2 * 5 + phases[1]) * 0.3 + Math.sin(k * Math.PI * 2 * detail + phases[2]) * 0.2;
      pts.push([k * w, base - (a * 0.5 + 0.5) * amp]);
    }
    return pts;
  }
  function fillRidge(c, pts, w, h, dy) {
    c.beginPath();
    c.moveTo(0, h);
    for (const [x, y] of pts) c.lineTo(x, y + dy);
    c.lineTo(w, h);
    c.closePath();
    c.fill();
  }

  function buildLayers() {
    // sky with stars and the moon
    const sky = offscreen(W, H);
    let c = sky.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, HORIZON);
    g.addColorStop(0, '#050816');
    g.addColorStop(0.6, '#0f1630');
    g.addColorStop(1, FOG_COLOR);
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    const r = rng(7);
    for (let n = 0; n < (W * HORIZON) / 2600; n++) {
      c.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.6})`;
      const s = r() < 0.92 ? 1 : 2;
      c.fillRect(r() * W, r() * HORIZON * 0.85, s, s);
    }
    const mx = W * 0.8;
    const my = HORIZON * 0.28;
    const mr = Math.max(10, Math.min(W, H) * 0.035);
    const mg = c.createRadialGradient(mx, my, mr, mx, my, mr * 5);
    mg.addColorStop(0, 'rgba(220,230,255,0.18)');
    mg.addColorStop(1, 'rgba(220,230,255,0)');
    c.fillStyle = mg;
    c.fillRect(mx - mr * 5, my - mr * 5, mr * 10, mr * 10);
    c.fillStyle = '#e9edf6';
    c.beginPath();
    c.arc(mx, my, mr, 0, Math.PI * 2);
    c.fill();
    layers.sky = sky;

    // far mountains with snow on the peaks (the Alatau)
    const mw = Math.max(W * 2, 1600);
    const mh = Math.round(FY * 0.75);
    const far = offscreen(mw, mh);
    c = far.getContext('2d');
    const pts = ridge(c, mw, mh, mh * 0.98, mh * 0.85, 11, 13);
    c.fillStyle = '#26314f';
    fillRidge(c, pts, mw, mh, 0);
    c.save();
    c.beginPath();
    c.rect(0, 0, mw, mh * 0.45);
    c.clip();
    c.fillStyle = '#8f9cbc';
    fillRidge(c, pts, mw, mh, 0);
    c.fillStyle = '#26314f';
    fillRidge(c, pts, mw, mh, mh * 0.07);
    c.restore();
    layers.far = far;

    // near foothills with city lights at their feet
    const nh = Math.round(FY * 0.4);
    const near = offscreen(mw, nh);
    c = near.getContext('2d');
    c.fillStyle = '#121a2e';
    fillRidge(c, ridge(c, mw, nh, nh, nh * 0.7, 23, 9), mw, nh, 0);
    const lr = rng(31);
    for (let n = 0; n < mw / 3; n++) {
      const x = lr() * mw;
      const y = nh - lr() * nh * 0.22;
      c.fillStyle = lr() < 0.75 ? `rgba(255,190,110,${0.35 + lr() * 0.5})` : `rgba(200,220,255,${0.3 + lr() * 0.4})`;
      c.fillRect(x, y, lr() < 0.85 ? 1.5 : 2.5, 1.5);
    }
    layers.near = near;

    // darker corners, so the eye stays on the road
    const vig = offscreen(W, H);
    c = vig.getContext('2d');
    const vg = c.createRadialGradient(W / 2, H * 0.62, Math.min(W, H) * 0.25, W / 2, H * 0.62, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    c.fillStyle = vg;
    c.fillRect(0, 0, W, H);
    layers.vignette = vig;
  }

  function drawLayer(img, rotation, y) {
    const w = img.width;
    let x = -wrap(rotation, 1) * w;
    ctx.drawImage(img, x, y);
    ctx.drawImage(img, x + w, y);
  }

  // ---------- game state ----------

  let mode = 'menu';
  let position = 0;
  let speed = 0;
  let playerX = 0;
  let steer = 0;
  let distance = 0;
  let timeLeft = 0;
  let lap = 1;
  let nextZone = 1;
  let countdown = 0;
  let skyOffset = 0;
  let farOffset = 0;
  let nearOffset = 0;
  let shake = 0;
  let flash = 0;
  let braking = false;
  let best = store.get('asem.best', 0);
  let lastZoneShown = -1;
  let crashCool = 0;

  const input = { left: false, right: false, brake: false };
  const keys = new Set();
  const pointers = new Map();

  // ---------- update ----------

  function update(dt) {
    const pSeg = segAt(position + PLAYER_Z);
    const speedPct = speed / MAX_SPEED;
    const dx = dt * 2 * speedPct;
    const startPos = position;

    for (const car of cars) {
      const before = segAt(car.z);
      car.z = wrap(car.z + dt * car.speed, trackLength);
      car.percent = (car.z % SEG) / SEG;
      const after = segAt(car.z);
      if (before !== after) {
        before.cars.splice(before.cars.indexOf(car), 1);
        after.cars.push(car);
      }
    }

    position = wrap(position + dt * speed, trackLength);

    const driving = mode === 'play';
    if (driving) {
      steer = input.left && !input.right ? -1 : input.right && !input.left ? 1 : 0;
    } else if (mode === 'menu') {
      // attract mode: keep to the middle lane and avoid nothing
      steer = clamp(-playerX * 3, -1, 1);
    } else {
      steer = 0;
    }
    playerX += dx * steer;
    playerX -= dx * speedPct * pSeg.curve * CENTRIFUGAL;

    braking = driving && input.brake;
    if (mode === 'countdown' || mode === 'over' || mode === 'ending') {
      speed += (mode === 'ending' ? BRAKE * 0.35 : DECEL * 2) * dt;
    } else if (braking) {
      speed += BRAKE * dt;
    } else if (mode === 'menu' && speed > MAX_SPEED * 0.55) {
      speed += DECEL * dt;
    } else {
      speed += ACCEL * dt;
    }

    if (mode !== 'menu') {
      if (playerX < -1 || playerX > 1) {
        if (speed > OFFROAD_LIMIT) speed += OFFROAD_DECEL * dt;
        for (const s of pSeg.sprites) {
          const sw = (s.w || s.def.w) / ROAD_W;
          const center = s.offset + (s.offset > 0 ? sw / 2 : -sw / 2);
          if (overlap(playerX, PLAYER_W, center, sw * s.def.hit)) {
            crash();
            speed = MAX_SPEED / 5;
            position = wrap(pSeg.p1.z - PLAYER_Z, trackLength);
            break;
          }
        }
      }
      for (const car of pSeg.cars) {
        if (speed > car.speed && overlap(playerX, PLAYER_W * 0.9, car.offset, PLAYER_W * 0.9)) {
          crash();
          speed = car.speed * (car.speed / speed);
          position = wrap(car.z - PLAYER_Z, trackLength);
          break;
        }
      }
    }

    playerX = clamp(playerX, -2.6, 2.6);
    speed = clamp(speed, 0, MAX_SPEED);

    const moved = wrap(position - startPos, trackLength);
    skyOffset += 0.0004 * pSeg.curve * (moved / SEG);
    farOffset += 0.0012 * pSeg.curve * (moved / SEG);
    nearOffset += 0.0024 * pSeg.curve * (moved / SEG);

    if (mode === 'countdown') {
      const before = Math.ceil(countdown);
      countdown -= dt;
      if (Math.ceil(countdown) !== before && countdown > 0) {
        banner(String(Math.ceil(countdown)));
        beep(440, 0.12);
      }
      if (countdown <= 0) {
        mode = 'play';
        banner(t('go'));
        beep(880, 0.25);
      }
    }

    if (mode === 'play' || mode === 'ending') {
      distance += ((speed / MAX_SPEED) * KMH_AT_MAX) / 3.6 / 1000 * dt;
    }
    if (mode === 'play') {
      timeLeft -= dt;
      const zoneNow = segAt(position + PLAYER_Z).zone;
      if (zoneNow === nextZone) {
        if (nextZone === 0) lap++;
        const factor = Math.pow(0.9, lap - 1);
        const bonus = Math.max(7, Math.round((zoneSeconds[nextZone] + 3) * factor));
        timeLeft += bonus;
        banner(t('zones')[nextZone], (nextZone === 0 ? t('lap', { n: lap }) + '  ' : '') + t('checkpoint', { s: bonus }));
        beep(660, 0.1);
        setTimeout(() => beep(990, 0.14), 110);
        nextZone = (nextZone + 1) % zoneStart.length;
      }
      if (timeLeft <= 0) {
        timeLeft = 0;
        mode = 'ending';
      }
    }
    if (mode === 'ending' && speed <= 0) gameOver();

    if (crashCool > 0) crashCool -= dt;
    if (shake > 0) shake = Math.max(0, shake - dt * 2.5);
    if (flash > 0) flash = Math.max(0, flash - dt * 3);
  }

  function crash() {
    if (crashCool > 0) return;
    crashCool = 0.6;
    shake = 1;
    flash = 0.6;
    noise(0.35);
    if (navigator.vibrate) {
      try { navigator.vibrate(60); } catch { /* not allowed */ }
    }
  }

  // ---------- render ----------

  function project(p, camX, camY, camZ) {
    const cx = -camX;
    const cy = p.y - camY;
    const cz = p.z - camZ;
    p.cz = cz;
    p.cy = cy;
    p.scale = CAM_DEPTH / cz;
    p.sx = Math.round(W / 2 + p.scale * cx * FX);
    p.sy = Math.round(HORIZON - p.scale * cy * FY);
    p.sw = Math.round(p.scale * ROAD_W * FX);
  }

  function poly(x1, y1, x2, y2, x3, y3, x4, y4, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.closePath();
    ctx.fill();
  }

  function drawSegment(seg) {
    const { p1, p2, color } = seg;
    const x1 = p1.sx, y1 = p1.sy, w1 = p1.sw;
    const x2 = p2.sx, y2 = p2.sy, w2 = p2.sw;
    ctx.fillStyle = color.grass;
    ctx.fillRect(0, y2, W, y1 - y2);
    const r1 = w1 / 6;
    const r2 = w2 / 6;
    poly(x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2, y2, color.rumble);
    poly(x1 + w1 + r1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + r2, y2, color.rumble);
    poly(x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, color.road);
    if (color.lane) {
      const l1 = w1 / 32;
      const l2 = w2 / 32;
      const lw1 = (w1 * 2) / LANES;
      const lw2 = (w2 * 2) / LANES;
      let lx1 = x1 - w1 + lw1;
      let lx2 = x2 - w2 + lw2;
      for (let lane = 1; lane < LANES; lane++, lx1 += lw1, lx2 += lw2) {
        poly(lx1 - l1 / 2, y1, lx1 + l1 / 2, y1, lx2 + l2 / 2, y2, lx2 - l2 / 2, y2, color.lane);
      }
    }
    if (seg.fog < 1) {
      ctx.globalAlpha = 1 - seg.fog;
      ctx.fillStyle = FOG_COLOR;
      ctx.fillRect(0, y2, W, y1 - y2);
      ctx.globalAlpha = 1;
    }
  }

  function withClip(clipY, fn) {
    if (clipY >= H) return fn();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, clipY);
    ctx.clip();
    fn();
    ctx.restore();
  }

  function drawSprite(s, scale, x, y, offX, clipY, alpha) {
    const def = s.def;
    const dw = (s.w || def.w) * scale * FX;
    const dh = (s.h || def.h) * scale * FX;
    const dx = x + dw * offX;
    const dy = y - dh;
    if (dw < 0.8 || dx > W || dx + dw < 0 || dy >= clipY) return;
    ctx.globalAlpha = alpha;
    if (dy + dh > clipY) withClip(clipY, () => def.draw(ctx, dx, dy, dw, dh, s));
    else def.draw(ctx, dx, dy, dw, dh, s);
    ctx.globalAlpha = 1;
  }

  function drawTrafficCar(car, seg) {
    const scale = lerp(seg.p1.scale, seg.p2.scale, car.percent);
    const x = lerp(seg.p1.sx, seg.p2.sx, car.percent) + scale * car.offset * ROAD_W * FX;
    const y = lerp(seg.p1.sy, seg.p2.sy, car.percent);
    const dw = CAR_W * scale * FX;
    const dh = dw * 0.62;
    if (dw < 1 || y - dh >= seg.clip) return;
    ctx.globalAlpha = seg.fog;
    const draw = () => drawCar(ctx, x - dw / 2, y - dh, dw, dh, car.color, false);
    if (y > seg.clip) withClip(seg.clip, draw);
    else draw();
    ctx.globalAlpha = 1;
  }

  function drawGate(seg) {
    const p = seg.p1;
    const s = p.scale;
    const half = p.sw * 1.32;
    const postW = Math.max(2, 140 * s * FX);
    const gateH = 3300 * s * FX;
    const bannerH = 720 * s * FX;
    const top = p.sy - gateH;
    if (top >= seg.clip || half < 4) return;
    ctx.globalAlpha = seg.fog;
    withClip(seg.clip, () => {
      ctx.fillStyle = '#1e2436';
      ctx.fillRect(p.sx - half - postW, top, postW, gateH);
      ctx.fillRect(p.sx + half, top, postW, gateH);
      ctx.fillStyle = '#0d1220';
      ctx.fillRect(p.sx - half - postW, top, (half + postW) * 2, bannerH);
      ctx.fillStyle = '#ffb547';
      const stripe = Math.max(1, bannerH * 0.09);
      ctx.fillRect(p.sx - half - postW, top, (half + postW) * 2, stripe);
      ctx.fillRect(p.sx - half - postW, top + bannerH - stripe, (half + postW) * 2, stripe);
      if (bannerH > 10) {
        const text = TEXT[lang].gates[seg.gate - 1];
        let size = bannerH * 0.5;
        ctx.font = `800 ${size}px "Segoe UI", system-ui, sans-serif`;
        const max = half * 1.7;
        const width = ctx.measureText(text).width;
        if (width > max) {
          size *= max / width;
          ctx.font = `800 ${size}px "Segoe UI", system-ui, sans-serif`;
        }
        ctx.fillStyle = '#ffb547';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, p.sx, top + bannerH / 2);
      }
    });
    ctx.globalAlpha = 1;
  }

  function drawPlayer(pSeg, pPct) {
    const scale = CAM_DEPTH / PLAYER_Z;
    const dw = CAR_W * scale * FX;
    const dh = dw * 0.62;
    const camY = lerp(pSeg.p1.cy, pSeg.p2.cy, pPct);
    const baseY = HORIZON - scale * camY * FY;
    const speedPct = speed / MAX_SPEED;
    const bounce = mode === 'paused' ? 0 : (Math.random() - 0.5) * 2 * speedPct * (H / 480);
    const cx = W / 2;
    const cy = baseY + bounce;

    // headlights on the asphalt ahead
    const beamTop = lerp(cy - dh, HORIZON, 0.55);
    const grad = ctx.createLinearGradient(0, cy - dh * 0.6, 0, beamTop);
    grad.addColorStop(0, 'rgba(255,236,196,0.16)');
    grad.addColorStop(1, 'rgba(255,236,196,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx - dw * 0.45, cy - dh * 0.6);
    ctx.lineTo(cx + dw * 0.45, cy - dh * 0.6);
    ctx.lineTo(cx + dw * 0.9 + steer * dw * 0.3, beamTop);
    ctx.lineTo(cx - dw * 0.9 + steer * dw * 0.3, beamTop);
    ctx.closePath();
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(steer * 0.04 * Math.min(1, speedPct * 2));
    drawCar(ctx, -dw / 2, -dh, dw, dh, '#d7263d', braking || mode === 'ending');
    ctx.restore();
  }

  function render() {
    const N = segments.length;
    const base = segAt(position);
    const basePct = (position % SEG) / SEG;
    const pSeg = segAt(position + PLAYER_Z);
    const pPct = ((position + PLAYER_Z) % SEG) / SEG;
    const playerY = lerp(pSeg.p1.y, pSeg.p2.y, pPct);

    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * W * 0.012, (Math.random() - 0.5) * shake * H * 0.012);

    ctx.drawImage(layers.sky, 0, 0);
    const lift = clamp(playerY * FY * 0.000005, -FY * 0.1, FY * 0.35);
    drawLayer(layers.far, farOffset, HORIZON - layers.far.height + lift * 0.5);
    const nearY = HORIZON - layers.near.height + lift;
    drawLayer(layers.near, nearOffset, nearY);
    ctx.fillStyle = '#121a2e';
    ctx.fillRect(0, nearY + layers.near.height - 1, W, H);

    let maxY = H;
    let x = 0;
    let dx = -(base.curve * basePct);
    for (let n = 0; n < DRAW; n++) {
      const seg = segments[(base.i + n) % N];
      seg.looped = seg.i < base.i;
      seg.fog = fogAt(n / DRAW, FOG);
      seg.clip = maxY;
      const camZ = position - (seg.looped ? trackLength : 0);
      project(seg.p1, playerX * ROAD_W - x, playerY + CAM_H, camZ);
      project(seg.p2, playerX * ROAD_W - x - dx, playerY + CAM_H, camZ);
      x += dx;
      dx += seg.curve;
      if (seg.p1.cz <= CAM_DEPTH || seg.p2.sy >= seg.p1.sy || seg.p2.sy >= maxY) continue;
      drawSegment(seg);
      maxY = seg.p1.sy;
    }

    for (let n = DRAW - 1; n > 0; n--) {
      const seg = segments[(base.i + n) % N];
      if (seg.p1.cz <= CAM_DEPTH) continue;
      if (seg.gate) drawGate(seg);
      for (const s of seg.sprites) {
        const scale = seg.p1.scale;
        const sx = seg.p1.sx + scale * s.offset * ROAD_W * FX;
        drawSprite(s, scale, sx, seg.p1.sy, s.offset < 0 ? -1 : 0, seg.clip, seg.fog);
      }
      for (const car of seg.cars) drawTrafficCar(car, seg);
      if (seg === pSeg) drawPlayer(pSeg, pPct);
    }

    ctx.drawImage(layers.vignette, 0, 0);
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,120,90,${flash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  // ---------- HUD and panels ----------

  const $ = (id) => document.getElementById(id);
  const hudEls = { speed: $('hudSpeed'), dist: $('hudDist'), time: $('hudTime'), zone: $('hudZone') };
  const hudCache = {};
  function setText(key, el, value) {
    if (hudCache[key] === value) return;
    hudCache[key] = value;
    el.textContent = value;
  }
  function hud() {
    if (mode === 'menu') return;
    setText('speed', hudEls.speed, String(Math.round((speed / MAX_SPEED) * KMH_AT_MAX)));
    setText('dist', hudEls.dist, `${km(distance)} ${t('km')}`);
    setText('time', hudEls.time, timeLeft < 10 ? timeLeft.toFixed(1) : String(Math.ceil(timeLeft)));
    hudEls.time.classList.toggle('low', timeLeft < 6 && mode === 'play');
    const zoneNow = segAt(position + PLAYER_Z).zone;
    if (zoneNow !== lastZoneShown) {
      lastZoneShown = zoneNow;
      setText('zone', hudEls.zone, t('zones')[zoneNow]);
    }
  }

  const bannerEl = $('banner');
  function banner(big, small) {
    bannerEl.replaceChildren();
    const b = document.createElement('b');
    b.textContent = big;
    bannerEl.append(b);
    if (small) {
      const s = document.createElement('span');
      s.textContent = small;
      bannerEl.append(s);
    }
    bannerEl.classList.remove('show');
    void bannerEl.offsetWidth;
    bannerEl.classList.add('show');
  }

  const isTouch = window.matchMedia('(pointer: coarse)').matches;

  function showPanel(id) {
    for (const p of ['menu', 'pause', 'over']) $(p).hidden = p !== id;
    $('hud').hidden = id === 'menu';
    if (id) {
      const btn = $(id).querySelector('.btn.primary');
      if (btn) setTimeout(() => btn.focus({ preventScroll: true }), 50);
    }
  }

  function renderTexts() {
    document.documentElement.lang = lang;
    document.title = t('title');
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    $('keys').textContent = isTouch ? t('keysTouch') : t('keys');
    $('menuBest').textContent = best > 0 ? t('best', { d: km(best) }) : t('noBest');
    $('pauseBtn').setAttribute('aria-label', t('pause'));
    $('muteBtn').textContent = sound.on ? t('soundOn') : t('soundOff');
    lastZoneShown = -1;
  }

  function newGame() {
    audioInit();
    spawnCars(70, (Date.now() & 0xffff) + 1);
    position = 0;
    speed = 0;
    playerX = 0;
    distance = 0;
    lap = 1;
    nextZone = 1;
    timeLeft = zoneSeconds[0] + 12;
    countdown = 3;
    mode = 'countdown';
    clearInputs();
    showPanel(null);
    banner('3');
    beep(440, 0.12);
  }

  function gameOver() {
    mode = 'over';
    const isRecord = distance > best + 0.0001;
    if (isRecord) {
      best = distance;
      store.set('asem.best', best);
    }
    $('overDist').textContent = `${km(distance)} ${t('km')}`;
    $('overRecord').hidden = !isRecord;
    $('overBest').textContent = t('best', { d: km(best) });
    $('overNote').textContent = '';
    renderTexts();
    showPanel('over');
  }

  function pause() {
    if (mode !== 'play' && mode !== 'countdown') return;
    pausedFrom = mode;
    mode = 'paused';
    clearInputs();
    showPanel('pause');
  }
  let pausedFrom = 'play';
  function resume() {
    if (mode !== 'paused') return;
    mode = pausedFrom;
    showPanel(null);
  }

  function toMenu() {
    mode = 'menu';
    spawnCars(40, 99);
    renderTexts();
    showPanel('menu');
  }

  async function share() {
    const text = t('shareText', { d: km(distance) });
    const url = 'https://asemface.com/';
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Әсем Жол', text, url });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      $('overNote').textContent = t('copied');
    } catch {
      $('overNote').textContent = url;
    }
  }

  // ---------- sound ----------

  const sound = { on: store.get('asem.sound', true), ctx: null, gain: null, o1: null, o2: null };
  function audioInit() {
    if (sound.ctx) {
      if (sound.ctx.state === 'suspended') sound.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const c = new AC();
      const o1 = c.createOscillator();
      const o2 = c.createOscillator();
      o1.type = 'sawtooth';
      o2.type = 'square';
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 520;
      const gain = c.createGain();
      gain.gain.value = 0;
      o1.connect(filter);
      o2.connect(filter);
      filter.connect(gain).connect(c.destination);
      o1.start();
      o2.start();
      Object.assign(sound, { ctx: c, gain, o1, o2 });
    } catch {
      sound.ctx = null;
    }
  }
  function engineSound() {
    if (!sound.ctx) return;
    const now = sound.ctx.currentTime;
    const pct = speed / MAX_SPEED;
    const gear = (pct * 4) % 1;
    const f = 42 + pct * 70 + gear * 38;
    sound.o1.frequency.setTargetAtTime(f, now, 0.05);
    sound.o2.frequency.setTargetAtTime(f / 2, now, 0.05);
    const audible = sound.on && (mode === 'play' || mode === 'countdown' || mode === 'ending');
    sound.gain.gain.setTargetAtTime(audible ? 0.03 + pct * 0.035 : 0, now, 0.1);
  }
  function beep(freq, dur) {
    if (!sound.on || !sound.ctx) return;
    const c = sound.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'triangle';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, c.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur + 0.02);
  }
  function noise(dur) {
    if (!sound.on || !sound.ctx) return;
    const c = sound.ctx;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let n = 0; n < len; n++) data[n] = (Math.random() * 2 - 1) * (1 - n / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const g = c.createGain();
    g.gain.value = 0.25;
    src.connect(f).connect(g).connect(c.destination);
    src.start();
  }

  // ---------- input ----------

  function clearInputs() {
    keys.clear();
    pointers.clear();
    input.left = input.right = input.brake = false;
  }
  function syncInput() {
    let left = keys.has('left');
    let right = keys.has('right');
    let brake = keys.has('brake');
    let touchLeft = false;
    let touchRight = false;
    for (const side of pointers.values()) {
      if (side === 'left') touchLeft = true;
      else touchRight = true;
    }
    // both thumbs down means brake, one thumb steers
    if (touchLeft && touchRight) brake = true;
    else if (touchLeft) left = true;
    else if (touchRight) right = true;
    input.left = left;
    input.right = right;
    input.brake = brake;
  }
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowDown: 'brake', KeyS: 'brake', Space: 'brake',
  };
  window.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('a')) return;
    if (KEYMAP[e.code] && (mode === 'play' || mode === 'countdown')) {
      e.preventDefault();
      keys.add(KEYMAP[e.code]);
      syncInput();
      return;
    }
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (mode === 'paused') resume();
      else pause();
    } else if (e.code === 'KeyM') {
      toggleSound();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (!KEYMAP[e.code]) return;
    keys.delete(KEYMAP[e.code]);
    syncInput();
  });
  canvas.addEventListener('pointerdown', (e) => {
    if (mode !== 'play' && mode !== 'countdown') return;
    e.preventDefault();
    pointers.set(e.pointerId, e.clientX < window.innerWidth / 2 ? 'left' : 'right');
    syncInput();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, e.clientX < window.innerWidth / 2 ? 'left' : 'right');
    syncInput();
  });
  const release = (e) => {
    if (!pointers.delete(e.pointerId)) return;
    syncInput();
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('blur', clearInputs);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });

  function toggleSound() {
    sound.on = !sound.on;
    store.set('asem.sound', sound.on);
    if (sound.on) audioInit();
    $('muteBtn').textContent = sound.on ? t('soundOn') : t('soundOff');
  }

  $('startBtn').addEventListener('click', newGame);
  $('againBtn').addEventListener('click', newGame);
  $('restartBtn').addEventListener('click', newGame);
  $('resumeBtn').addEventListener('click', resume);
  $('pauseBtn').addEventListener('click', () => (mode === 'paused' ? resume() : pause()));
  $('muteBtn').addEventListener('click', toggleSound);
  $('shareBtn').addEventListener('click', share);
  document.querySelectorAll('[data-lang]').forEach((b) => {
    b.addEventListener('click', () => {
      lang = b.dataset.lang;
      store.set('asem.lang', lang);
      renderTexts();
    });
  });
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Enter') return;
    if (e.target.closest && e.target.closest('button, a')) return;
    if (mode === 'menu' || mode === 'over') newGame();
  });
  window.addEventListener('resize', resize);

  // ---------- loop ----------

  let last = performance.now();
  let acc = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (mode !== 'paused') {
      acc += dt;
      while (acc >= STEP) {
        update(STEP);
        acc -= STEP;
      }
    }
    render();
    hud();
    engineSound();
    requestAnimationFrame(frame);
  }

  buildTrack();
  resize();
  renderTexts();
  toMenu();
  speed = MAX_SPEED * 0.5;
  requestAnimationFrame(frame);

  // ?og renders a clean frame for the link preview image (og.png)
  if (/[?&]og\b/.test(location.search)) {
    document.body.classList.add('og');
    position = (zoneStart[1] + 170) * SEG;
    const title = document.createElement('div');
    title.className = 'og-title';
    const h = document.createElement('b');
    h.textContent = 'Әсем Жол';
    const p = document.createElement('span');
    p.textContent = t('tag').split('. ')[0];
    title.append(h, p);
    document.body.append(title);
  }

  if (/[?&]debug\b/.test(location.search)) {
    window.__asem = {
      step(n = 60) {
        for (let k = 0; k < n; k++) update(STEP);
        render();
        hud();
      },
      start: newGame,
      press(name, on) {
        if (on) keys.add(name);
        else keys.delete(name);
        syncInput();
      },
      get state() {
        return { mode, position, speed, playerX, distance, timeLeft, lap, nextZone, segments: segments.length, zoneStart, zoneSeconds };
      },
      set timeLeft(v) { timeLeft = v; },
      set position(v) { position = v; },
    };
  }
})();
