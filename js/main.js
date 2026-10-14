import { clamp, wrap, overlap, store, el } from './util.js';
import { t, L, km, clock, getLang, setLang } from './i18n.js';
import { MAPS, CHAPTERS, CARS, PAINTS, FRIENDS, mapById } from './maps.js';
import { Track, SEG, PLAYER_Z, PLAYER_W, BASE_MAX, KMH_AT_MAX, ROAD_W, GATE_AT, M_PER_SEG } from './track.js';
import { Renderer } from './render.js';
import { drawVehicle, VEHICLES } from './sprites.js';
import { sound, audioInit, setSound, engine, beep, noise, fanfare, scream, bonk } from './audio.js';
import { music, playMusic, setMusic, pauseMusic } from './music.js';
import { online, getBoard, submit, flushPending, newGroupCode, boardId } from './scores.js';

const STEP = 1 / 60;
const $ = (id) => document.getElementById(id);
const isTouch = window.matchMedia('(pointer: coarse)').matches;

// ---------- progress ----------

const progress = Object.assign({ stars: {}, times: {}, best: {}, paint: {}, car: 'hatch', map: 'city' }, store.get('asem.progress', {}));
if (!progress.paint) progress.paint = {};
{
  // a friend's invite link: asemface.com/?group=code
  const invited = new URLSearchParams(location.search).get('group');
  if (invited && /^[a-z0-9]{4,12}$/i.test(invited)) {
    progress.group = invited.toLowerCase();
    store.set('asem.progress', progress);
  }
}
const oldBest = store.get('asem.best', 0);
if (oldBest && !progress.best.city) progress.best.city = oldBest;
const saveProgress = () => store.set('asem.progress', progress);

const totalStars = () => CHAPTERS.reduce((a, ch, i) => a + (progress.stars[i] || 0), 0);
const chapterOpen = (i) => i === 0 || (progress.stars[i - 1] || 0) > 0;
const mapOpen = (id) => id === 'city' || CHAPTERS.some((ch, i) => ch.map === id && chapterOpen(i));
const carOpen = (car) => totalStars() >= car.stars;
const carColor = (car) => progress.paint[car.id] || car.color;
const currentCar = () => {
  let car = CARS.find((c) => c.id === progress.car) || CARS[0];
  if (!carOpen(car)) car = CARS[0];
  return { ...car, color: carColor(car) };
};

const tracks = {};
const getTrack = (id) => (tracks[id] ||= new Track(mapById(id)));

// ---------- game state ----------

const g = {
  mode: 'menu',
  kind: 'free',
  chapter: 0,
  map: null,
  track: null,
  position: 0,
  speed: BASE_MAX * 0.5,
  playerX: 0,
  steer: 0,
  braking: false,
  boosting: false,
  nitro: 0,
  distance: 0,
  timeLeft: 0,
  elapsed: 0,
  lap: 1,
  nextZone: 1,
  countdown: 0,
  parallax: 0,
  shake: 0,
  flash: 0,
  crashCool: 0,
  scrapeCool: 0,
  time: 0,
  endTimer: 0,
  autoLane: null,
  result: null,
};

const canvas = $('game');
const renderer = new Renderer(canvas);

function setMap(id) {
  if (g.map && g.map.id === id) return;
  g.map = mapById(id);
  g.track = getTrack(id);
  renderer.setMap(g.map);
  populate(99);
  if (audioUnlocked) playMusic(id, racingNow() ? 1 : 0);
  g.position = 0;
  g.playerX = g.track.lanes === 2 ? 0.5 : 0;
  g.autoLane = null;
}

function populate(seed) {
  g.track.spawnCars(seed);
  g.track.addFriends(FRIENDS, seed + 1);
  g.travel = 0;
}

// friends change lanes around slower traffic, on two-lane roads only when the oncoming lane is clear
function friendsAI(T, dt) {
  const N = T.segments.length;
  for (const f of T.cars) {
    if (!f.friend) continue;
    if (g.mode === 'countdown') {
      f.speed = 0;
      continue;
    }
    const si = Math.floor(f.z / SEG);
    const find = (laneX, from, to, test) => {
      for (let n = from; n <= to; n++) {
        for (const c of T.segments[(si + n + N) % N].cars) {
          if (c !== f && Math.abs(c.offset - laneX) < 0.4 && test(c)) return c;
        }
      }
      return null;
    };
    const slow = (c) => c.dir > 0 && !c.friend && c.speed < f.base * 0.95;
    if (find(f.target, 0, 7, slow)) {
      for (const lane of T.laneX) {
        if (Math.abs(lane - f.target) < 0.1) continue;
        const clear = T.lanes === 2 && lane < 0
          ? !find(lane, 0, 60, (c) => c.dir < 0) && !find(lane, -2, 8, () => true)
          : !find(lane, -2, 10, () => true);
        if (clear) {
          f.target = lane;
          break;
        }
      }
    } else if (T.lanes === 2 && f.target < 0 && !find(T.laneX[1], -3, 8, () => true)) {
      f.target = T.laneX[1];
    }
    const front = find(f.offset, 0, 3, slow);
    if (front) f.speed = Math.max(front.speed, f.speed - BASE_MAX * 0.6 * dt);
    else f.speed = Math.min(f.base, f.speed + BASE_MAX * 0.2 * dt);
    const d = f.target - f.offset;
    f.offset += Math.sign(d) * Math.min(Math.abs(d), dt * 1.4);
    f.travel += f.speed * dt;
  }
}

const friendsAhead = () => g.track.cars.filter((c) => c.friend && c.travel > g.travel + PLAYER_Z).length;

// ---------- update ----------

const input = { left: false, right: false, brake: false, nitro: false };

function autopilot(T, pSeg) {
  const N = T.segments.length;
  const ahead = (laneX, range) => {
    for (let n = 1; n <= range; n++) {
      for (const c of T.segments[(pSeg.i + n) % N].cars) if (Math.abs(c.offset - laneX) < 0.4) return c;
    }
    return null;
  };
  const lanes = T.laneX;
  let target = g.autoLane ?? lanes[lanes.length - 1];
  if (ahead(target, 16)) {
    const alt = lanes.find((l) => l !== target && !ahead(l, 40));
    if (alt != null) target = alt;
  }
  if (T.lanes === 2 && target < 0 && !ahead(lanes[1], 24)) target = lanes[1];
  g.autoLane = target;
  g.steer = clamp((target - g.playerX) * 4, -1, 1);
  return ahead(g.playerX, 8);
}

function update(dt) {
  const T = g.track;
  const N = T.segments.length;
  g.time += dt;
  const pSeg = T.segAt(g.position + PLAYER_Z);
  const st = currentCar().stats;
  const maxSpeed = BASE_MAX * st.speed * (g.boosting ? 1.22 : 1);
  const speedPct = g.speed / BASE_MAX;
  const dx = dt * 2 * speedPct * (0.85 + 0.15 * st.grip);
  const startPos = g.position;

  friendsAI(T, dt);
  for (const c of T.cars) {
    const before = T.segAt(c.z);
    c.z = wrap(c.z + dt * c.speed, T.length);
    c.percent = (c.z % SEG) / SEG;
    const after = T.segAt(c.z);
    if (before !== after) {
      before.cars.splice(before.cars.indexOf(c), 1);
      after.cars.push(c);
    }
  }

  g.position = wrap(g.position + dt * g.speed, T.length);

  const driving = g.mode === 'play';
  let blocker = null;
  if (driving) g.steer = input.left && !input.right ? -1 : input.right && !input.left ? 1 : 0;
  else if (g.mode === 'menu') blocker = autopilot(T, pSeg);
  else g.steer = 0;
  g.playerX += dx * g.steer;
  g.playerX -= dx * speedPct * pSeg.curve * (0.3 / st.grip);

  g.braking = driving && input.brake;
  g.boosting = driving && input.nitro && g.nitro > 0;
  if (g.boosting) g.nitro = Math.max(0, g.nitro - dt * 0.33);
  const accel = (BASE_MAX / 5) * st.accel * (g.boosting ? 1.8 : 1);
  if (g.mode === 'countdown') g.speed -= BASE_MAX * 0.4 * dt;
  else if (['ending', 'finish', 'done', 'over', 'fail'].includes(g.mode)) g.speed -= BASE_MAX * 0.35 * dt;
  else if (g.braking) g.speed -= BASE_MAX * dt;
  else if (g.mode === 'menu' && (g.speed > BASE_MAX * 0.55 || (blocker && g.speed > blocker.speed))) g.speed -= (BASE_MAX / 4) * dt;
  else if (g.speed > maxSpeed) g.speed -= (BASE_MAX / 3) * dt;
  else g.speed += accel * dt;

  if (g.mode === 'play' || g.mode === 'ending') {
    // guard rails hold the car on the road and scrape off some speed
    if (pSeg.rail && pSeg.rail * g.playerX > 1) {
      g.playerX = pSeg.rail;
      if (g.speed > BASE_MAX * 0.35) g.speed -= BASE_MAX * 0.8 * dt;
      g.shake = Math.max(g.shake, 0.25);
      if (g.scrapeCool <= 0) {
        noise(0.15, 0.1, 2600);
        g.scrapeCool = 0.25;
      }
    }
    if (g.playerX < -1 || g.playerX > 1) {
      const limit = (BASE_MAX / 4) * st.offroad;
      if (g.speed > limit) g.speed -= (BASE_MAX / 2 / st.offroad) * dt;
      for (const s of pSeg.sprites) {
        if (s.def.walker || s.def.breakable) continue;
        const sw = (s.w || s.def.w) / ROAD_W;
        const center = s.offset + (s.offset > 0 ? sw / 2 : -sw / 2);
        if (overlap(g.playerX, PLAYER_W, center, sw * s.def.hit)) {
          crash();
          g.speed = BASE_MAX / 5;
          g.position = wrap(pSeg.p1.z - PLAYER_Z, T.length);
          break;
        }
      }
    }
    for (const c of pSeg.cars) {
      if (!overlap(g.playerX, PLAYER_W * 0.9, c.offset, (c.w / ROAD_W) * 0.9)) continue;
      if (c.dir > 0 && g.speed > c.speed) {
        crash();
        g.speed = c.speed * (c.speed / g.speed);
        g.position = wrap(c.z - PLAYER_Z, T.length);
        break;
      }
      if (c.dir < 0 && g.crashCool <= 0) {
        crash();
        g.speed = Math.min(g.speed, BASE_MAX * 0.12);
        g.playerX += g.playerX > c.offset ? 0.35 : -0.35;
        break;
      }
    }
  }

  funStuff(T, pSeg, dt);

  // close calls charge the nitro
  if (g.mode === 'play') {
    const pz = g.position + PLAYER_Z;
    for (const c of T.cars) {
      let rel = c.z - pz;
      if (rel > T.length / 2) rel -= T.length;
      if (rel < -T.length / 2) rel += T.length;
      if (c.rel != null && c.rel > 0 && rel <= 0 && rel > -SEG * 30) {
        const lat = Math.abs(c.offset - g.playerX);
        if (c.friend) {
          g.nitro = Math.min(1, g.nitro + 0.1);
          toast(t('friendBehind', { name: L(c.name) }));
          beep(990, 0.1, 'triangle', 0.08);
        } else if (lat < 0.72 && g.crashCool <= 0) {
          g.nitro = Math.min(1, g.nitro + (c.dir < 0 ? 0.3 : 0.22));
          toast(t('nearMiss'));
          beep(1250, 0.08, 'sine', 0.06);
        } else if (lat < 1.5) {
          g.nitro = Math.min(1, g.nitro + 0.05);
        }
      } else if (c.friend && c.rel != null && c.rel < 0 && rel >= 0 && rel < SEG * 30) {
        toast(t('friendPasses', { name: L(c.name) }));
      }
      c.rel = rel;
    }
  }

  g.playerX = clamp(g.playerX, -2.6, 2.6);
  g.speed = clamp(g.speed, 0, BASE_MAX * 1.4);
  g.parallax += pSeg.curve * (wrap(g.position - startPos, T.length) / SEG);

  if (g.mode === 'countdown') {
    const before = Math.ceil(g.countdown);
    g.countdown -= dt;
    if (Math.ceil(g.countdown) !== before && g.countdown > 0) {
      banner(String(Math.ceil(g.countdown)));
      beep(440, 0.12);
    }
    if (g.countdown <= 0) {
      g.mode = 'play';
      banner(t('goText'));
      beep(880, 0.25);
    }
  }

  if (g.mode === 'play' || g.mode === 'ending') {
    g.distance += ((g.speed / BASE_MAX) * KMH_AT_MAX) / 3.6 / 1000 * dt;
    // signed, so being pushed back after a crash counts too
    let moved = g.position - startPos;
    if (moved > T.length / 2) moved -= T.length;
    if (moved < -T.length / 2) moved += T.length;
    g.travel += moved;
  }
  if (g.mode === 'play') {
    g.timeLeft -= dt;
    g.elapsed += dt;
    const seg = T.segAt(g.position + PLAYER_Z);
    if (seg.zone === g.nextZone && (g.nextZone !== 0 || seg.i >= GATE_AT)) enterZone(seg.zone);
    if (g.mode === 'play' && g.timeLeft <= 0) {
      g.timeLeft = 0;
      g.mode = 'ending';
    }
  }
  if (g.mode === 'ending' && g.speed <= 0) {
    if (g.kind === 'story') showFail();
    else showOver();
  }
  if (g.mode === 'finish') {
    g.endTimer -= dt;
    if (g.endTimer <= 0) {
      g.mode = 'done';
      showFinish();
    }
  }

  if (g.crashCool > 0) g.crashCool -= dt;
  if (g.scrapeCool > 0) g.scrapeCool -= dt;
  if (g.shake > 0) g.shake = Math.max(0, g.shake - dt * 2.5);
  if (g.flash > 0) g.flash = Math.max(0, g.flash - dt * 3);
}

// people next to the road dive out of the way; cones, snowmen, inflatable men and melon stalls fly
const animating = new Set();
let screamCool = 0;
function funStuff(T, pSeg, dt) {
  const N = T.segments.length;
  screamCool -= dt;
  const racing = g.mode === 'play' || g.mode === 'ending';
  if (racing && g.speed > BASE_MAX * 0.2) {
    for (let n = 0; n <= 26; n++) {
      const seg = T.segments[(pSeg.i + n) % N];
      for (const s of seg.sprites) {
        if (!s.def.walker || s.dodge) continue;
        if (Math.abs(s.offset - g.playerX) > 0.62) continue;
        s.dodge = true;
        s.t0 = g.time;
        s.dir = s.offset > g.playerX ? 1 : -1;
        const phrases = t('screams');
        s.say = phrases[Math.floor(Math.random() * phrases.length)];
        s.sayUntil = g.time + 1.4;
        animating.add(s);
        if (screamCool <= 0) {
          scream();
          screamCool = 0.35;
        }
      }
    }
    for (let n = 0; n <= 1; n++) {
      const seg = T.segments[(pSeg.i + n) % N];
      for (const s of seg.sprites) {
        if (!s.def.breakable || s.fly) continue;
        const sw = (s.w || s.def.w) / ROAD_W;
        const center = s.offset + (s.offset > 0 ? sw / 2 : -sw / 2);
        if (!overlap(g.playerX, PLAYER_W, center, sw * s.def.hit)) continue;
        s.fly = true;
        s.t0 = g.time;
        s.dir = center >= g.playerX ? 1 : -1;
        s.spin = (Math.random() * 6 + 4) * s.dir;
        animating.add(s);
        bonk(s.def.breakable);
        g.nitro = Math.min(1, g.nitro + 0.04);
        g.shake = Math.max(g.shake, 0.3);
        if (g.speed > BASE_MAX * 0.4) g.speed -= BASE_MAX * 0.04;
      }
    }
  }
  for (const s of animating) {
    const k = g.time - s.t0;
    if (s.fly) {
      s.offset = s.base + s.dir * k * 2.4;
      s.lift = Math.max(0, 3400 * k - 2400 * k * k);
      s.rot = s.spin * k;
      s.alpha = Math.max(0, Math.min(1, 1.8 - k));
      if (k > 1.8) {
        s.gone = true;
        animating.delete(s);
      }
    } else {
      // jump sideways, land on the back, get up and stand there shaking
      const p = Math.min(1, k / 0.45);
      s.offset = s.base + s.dir * 1.1 * (1 - (1 - p) * (1 - p));
      s.lift = Math.sin(p * Math.PI) * 420;
      s.rot = k < 1.4 ? s.dir * Math.min(1.45, p * 1.6) : s.dir * Math.max(0, 1.45 - (k - 1.4) * 2.4);
      if (k > 2.2) {
        s.rot = 0;
        s.lift = 0;
        animating.delete(s);
      }
    }
  }
}

function enterZone(z) {
  const T = g.track;
  if (g.kind === 'story' && z === 0) {
    finish();
    return;
  }
  if (z === 0) g.lap++;
  const factor = g.kind === 'free' ? Math.pow(0.9, g.lap - 1) : 1;
  const bonus = Math.max(7, Math.round((T.zoneSeconds[z] + 3) * factor));
  g.timeLeft += bonus;
  banner(L(g.map.zones[z].name), (z === 0 ? t('lap', { n: g.lap }) + '  ' : '') + t('checkpoint', { s: bonus }));
  beep(660, 0.1);
  setTimeout(() => beep(990, 0.14), 110);
  g.nextZone = (z + 1) % T.zoneStart.length;
}

function crash() {
  if (g.crashCool > 0) return;
  g.crashCool = 0.6;
  g.shake = 1;
  g.flash = 0.6;
  noise(0.35);
  if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) {
    try { navigator.vibrate(60); } catch { /* not allowed */ }
  }
}

function finish() {
  g.mode = 'finish';
  g.endTimer = 1.5;
  const ideal = g.track.segments.length / 58;
  const stars = g.elapsed <= ideal * 1.15 ? 3 : g.elapsed <= ideal * 1.35 ? 2 : 1;
  const prevTime = progress.times[g.chapter];
  g.result = { place: friendsAhead() + 1, stars, time: g.elapsed, best: prevTime == null || g.elapsed < prevTime, prevStars: progress.stars[g.chapter] || 0 };
  progress.stars[g.chapter] = Math.max(progress.stars[g.chapter] || 0, stars);
  if (g.result.best) progress.times[g.chapter] = g.elapsed;
  saveProgress();
  banner(t('finishTitle'));
  fanfare();
}

// ---------- start, pause, menus ----------

function startRace(opts) {
  audioInit();
  g.kind = opts.kind;
  g.chapter = opts.chapter ?? 0;
  const mapId = g.kind === 'story' ? CHAPTERS[g.chapter].map : opts.mapId;
  progress.map = mapId;
  saveProgress();
  setMap(mapId);
  const T = g.track;
  populate((Date.now() & 0xffff) + 1);
  T.resetDynamic();
  animating.clear();
  unlockAudio();
  playMusic(mapId, 1);
  for (const c of T.cars) c.rel = null;
  Object.assign(g, {
    position: 0,
    speed: 0,
    playerX: T.lanes === 2 ? 0.5 : 0,
    steer: 0,
    nitro: 0.25,
    distance: 0,
    elapsed: 0,
    lap: 1,
    nextZone: 1,
    timeLeft: T.zoneSeconds[0] + (g.kind === 'story' ? 10 : 12),
    countdown: 3,
    mode: 'countdown',
    crashCool: 0,
    result: null,
  });
  g.last = opts;
  clearInputs();
  ui.replaceChildren();
  showHud(true);
  banner('3');
  beep(440, 0.12);
}

let pausedFrom = 'play';
function pause() {
  if (g.mode !== 'play' && g.mode !== 'countdown') return;
  pausedFrom = g.mode;
  g.mode = 'paused';
  pauseMusic(true);
  clearInputs();
  screenPause();
}
function resume() {
  if (g.mode !== 'paused') return;
  g.mode = pausedFrom;
  pauseMusic(false);
  ui.replaceChildren();
  showHud(true);
}

function toMenu(screen = screenMain) {
  if (!['menu'].includes(g.mode)) {
    g.mode = 'menu';
    if (g.track) populate(99);
    g.speed = Math.max(g.speed, BASE_MAX * 0.3);
  }
  showHud(false);
  if (audioUnlocked) playMusic(g.map.id, 0);
  screen();
}

// browsers only allow sound after the first tap or key press
let audioUnlocked = false;
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  audioInit();
  playMusic(g.map.id, racingNow() ? 1 : 0);
}
const racingNow = () => ['countdown', 'play', 'ending', 'finish'].includes(g.mode);
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

// ---------- HUD ----------

const hud = { place: $('hudPlace'), root: $('hud'), speed: $('hudSpeed'), kmh: $('hudKmh'), dist: $('hudDist'), time: $('hudTime'), zone: $('hudZone'), nitro: $('hudNitro') };
const cache = {};
function setText(key, node, value) {
  if (cache[key] === value) return;
  cache[key] = value;
  node.textContent = value;
}
function showHud(on) {
  hud.root.hidden = !on;
  $('nitroBtn').hidden = !(on && isTouch);
  for (const k of Object.keys(cache)) delete cache[k];
}
function updateHud() {
  if (hud.root.hidden) return;
  const T = g.track;
  setText('speed', hud.speed, String(Math.round((g.speed / BASE_MAX) * KMH_AT_MAX)));
  setText('kmh', hud.kmh, t('kmh'));
  if (g.kind === 'story') {
    const seg = T.segAt(g.position + PLAYER_Z);
    const left = g.nextZone === 0 && seg.zone === 0 && seg.i < GATE_AT ? GATE_AT - seg.i : T.segments.length - seg.i + GATE_AT;
    const leftKm = g.mode === 'finish' || g.mode === 'done' ? 0 : (left * M_PER_SEG) / 1000;
    setText('dist', hud.dist, t('toFinish', { d: km(leftKm) }));
  } else {
    setText('dist', hud.dist, `${km(g.distance)} ${t('km')}`);
  }
  setText('time', hud.time, g.timeLeft < 10 ? g.timeLeft.toFixed(1) : String(Math.ceil(g.timeLeft)));
  hud.time.classList.toggle('low', g.timeLeft < 6 && g.mode === 'play');
  setText('zone', hud.zone, L(g.map.zones[Math.max(0, T.segAt(g.position + PLAYER_Z).zone)].name));
  setText('place', hud.place, t('place', { n: friendsAhead() + 1, m: FRIENDS.length + 1 }));
  const n = Math.round(g.nitro * 100);
  if (cache.nitro !== n) {
    cache.nitro = n;
    hud.nitro.style.transform = `scaleX(${g.nitro})`;
  }
  hud.root.classList.toggle('boost', g.boosting);
}

const bannerEl = $('banner');
function banner(big, small) {
  bannerEl.replaceChildren(el('b', '', big));
  if (small) bannerEl.append(el('span', '', small));
  bannerEl.classList.remove('show');
  void bannerEl.offsetWidth;
  bannerEl.classList.add('show');
}
const toastEl = $('toast');
let toastTimer = 0;
function toast(text) {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 900);
}

// ---------- screens ----------

const ui = $('ui');

function panel(cls, ...children) {
  const p = el('section', 'panel ' + (cls || ''));
  p.append(...children.filter(Boolean));
  ui.replaceChildren(p);
  const first = p.querySelector('.btn.primary, .menu-item:not([disabled]), .card:not([disabled])');
  if (first && !isTouch) setTimeout(() => first.focus({ preventScroll: true }), 30);
  p.scrollTop = 0;
  return p;
}
function btn(label, cls, onClick) {
  const b = el('button', 'btn ' + (cls || ''), label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}
function head(title, onBack, extra) {
  const h = el('div', 'panel-head');
  const back = el('button', 'back', '←');
  back.type = 'button';
  back.setAttribute('aria-label', t('back'));
  back.addEventListener('click', onBack);
  h.append(back, el('h2', '', title));
  if (extra) h.append(extra);
  return h;
}
function starsRow(n, of = 3) {
  const s = el('span', 'stars');
  s.setAttribute('aria-label', `${n} / ${of}`);
  for (let k = 0; k < of; k++) s.append(el('i', k < n ? 'on' : '', '★'));
  return s;
}
function langs() {
  const box = el('div', 'langs');
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', 'Language');
  for (const code of ['ru', 'en']) {
    const b = el('button', '', code.toUpperCase());
    b.type = 'button';
    b.setAttribute('aria-pressed', String(getLang() === code));
    b.addEventListener('click', () => {
      setLang(code);
      applyLang();
      screenMain();
    });
    box.append(b);
  }
  return box;
}

let currentScreen = null;
function screen(fn) {
  return (...args) => {
    currentScreen = () => fn(...args);
    fn(...args);
  };
}

const screenMain = screen(() => {
  const top = el('div', 'panel-top');
  const mus = el('button', 'chip-btn', music.on ? '♪ ' + t('musicOn') : '♪ ' + t('musicOff'));
  mus.type = 'button';
  mus.setAttribute('aria-pressed', String(music.on));
  mus.addEventListener('click', () => {
    unlockAudio();
    toggleMusic();
    screenMain();
  });
  const right = el('div', 'top-right');
  right.append(mus, langs());
  top.append(el('span', 'mark'), right);
  const doneAll = CHAPTERS.every((ch, i) => progress.stars[i]);
  const nextCh = CHAPTERS.findIndex((ch, i) => !progress.stars[i]);
  const menu = el('div', 'menu');
  const item = (title, sub, primary, onClick) => {
    const b = el('button', 'menu-item' + (primary ? ' primary' : ''));
    b.type = 'button';
    b.append(el('b', '', title), el('span', '', sub));
    b.addEventListener('click', onClick);
    return b;
  };
  menu.append(
    item(t('story'), doneAll ? t('storyDoneSub', { s: totalStars(), m: CHAPTERS.length * 3 }) : t('storySub', { n: nextCh + 1, m: CHAPTERS.length }), true, () => screenChapters()),
    item(t('free'), t('freeSub'), false, () => screenMaps()),
    item(t('garage'), t('car_' + currentCar().id), false, () => screenGarage()),
    item(t('records'), progress.group ? t('groupMine', { g: progress.group }) : t('recordsSub'), false, () => screenScores()),
  );
  panel('main', top, el('h1', '', 'Әсем Жол'), el('p', 'tag', t('tag')), menu, el('p', 'keys', isTouch ? t('keysTouch') : t('keys')), (() => {
    const a = el('a', 'more', t('more'));
    a.href = 'https://gamemetric.dev/';
    return a;
  })());
});

const screenChapters = screen(() => {
  const list = el('div', 'cards');
  CHAPTERS.forEach((ch, i) => {
    const open = chapterOpen(i);
    const card = el('button', 'card');
    card.type = 'button';
    if (!open) card.setAttribute('disabled', '');
    const img = el('img');
    img.alt = '';
    img.src = thumb(ch.map);
    const body = el('span', 'card-body');
    body.append(el('small', '', t('chapter', { n: i + 1 })), el('b', '', L(ch.title)));
    if (open) body.append(starsRow(progress.stars[i] || 0));
    else body.append(el('span', 'lock', t('lockedChapter', { n: i })));
    card.append(img, body);
    if (open) card.addEventListener('click', () => screenStory(i));
    list.append(card);
  });
  const total = el('span', 'head-note', t('starsTotal', { n: totalStars(), m: CHAPTERS.length * 3 }));
  panel('wide', head(t('story'), () => screenMain(), total), list, CHAPTERS.every((c, i) => progress.stars[i]) ? el('p', 'note', t('storyEnd')) : null);
});

const screenStory = screen((i) => {
  const ch = CHAPTERS[i];
  setMap(ch.map);
  const img = el('img', 'hero-img');
  img.alt = '';
  img.src = thumb(ch.map);
  const goal = el('p', 'goal');
  goal.append(el('b', '', t('goal') + ': '), document.createTextNode(L(ch.goal)));
  const best = progress.times[i] != null ? el('p', 'best', `${clock(progress.times[i])}  `) : null;
  if (best) best.append(starsRow(progress.stars[i] || 0));
  panel('', head(t('chapter', { n: i + 1 }), () => screenChapters()), img, el('h2', 'story-title', L(ch.title)), el('p', 'tag', L(ch.intro)), goal, best, btn(t('go'), 'primary', () => startRace({ kind: 'story', chapter: i })));
});

const screenMaps = screen(() => {
  const list = el('div', 'cards');
  MAPS.forEach((m) => {
    const open = mapOpen(m.id);
    const card = el('button', 'card');
    card.type = 'button';
    if (!open) card.setAttribute('disabled', '');
    const img = el('img');
    img.alt = '';
    img.src = thumb(m.id);
    const body = el('span', 'card-body');
    body.append(el('b', '', L(m.name)));
    if (open) body.append(el('span', 'best', progress.best[m.id] ? t('best', { d: km(progress.best[m.id]) }) : t('noBest')));
    else body.append(el('span', 'lock', t('lockedChapter', { n: CHAPTERS.findIndex((c) => c.map === m.id) })));
    card.append(img, body);
    if (open) card.addEventListener('click', () => startRace({ kind: 'free', mapId: m.id }));
    list.append(card);
  });
  panel('wide', head(t('free'), () => screenMain()), list);
});

let garageView = null;
const screenGarage = screen(() => {
  const chosen = currentCar();
  const view = CARS.find((c) => c.id === garageView) || CARS.find((c) => c.id === chosen.id);
  const open = carOpen(view);
  const color = carColor(view);

  const show = el('div', 'showcase');
  const big = el('canvas', 'car-big');
  big.width = 520;
  big.height = 260;
  paintCar(big, { ...view, color }, open);
  const info = el('div', 'car-body');
  info.append(el('b', '', t('car_' + view.id)), el('p', 'car-note', t('car_' + view.id + '_note')));
  const stats = el('dl', 'car-stats');
  for (const key of ['speed', 'accel', 'grip', 'offroad']) {
    const v = view.stats[key];
    const lvl = clamp(Math.round(key === 'offroad' ? 1 + v * 1.5 : key === 'accel' ? (v - 0.7) * 7 : (v - 0.7) * 10), 1, 5);
    const bar = el('dd', 'bar');
    for (let k = 0; k < 5; k++) bar.append(el('i', k < lvl ? 'on' : ''));
    stats.append(el('dt', '', t('stat_' + key)), bar);
  }
  info.append(stats);
  if (!open) {
    info.append(el('span', 'lock', t('lockedStars', { n: view.stars })));
  } else {
    const paints = el('div', 'paints');
    paints.setAttribute('role', 'group');
    paints.setAttribute('aria-label', t('paint'));
    PAINTS.forEach((p, k) => {
      const b = el('button', 'paint' + (p === color ? ' on' : ''));
      b.type = 'button';
      b.style.background = p;
      b.setAttribute('aria-label', t('paint') + ' ' + (k + 1));
      b.setAttribute('aria-pressed', String(p === color));
      b.addEventListener('click', () => {
        progress.paint[view.id] = p;
        progress.car = view.id;
        saveProgress();
        screenGarage();
      });
      paints.append(b);
    });
    info.append(el('span', 'paint-label', t('paint')), paints);
    if (chosen.id === view.id) info.append(el('span', 'picked', t('selected')));
    else info.append(btn(t('choose'), 'primary', () => {
      progress.car = view.id;
      saveProgress();
      screenGarage();
    }));
  }
  show.append(big, info);

  const grid = el('div', 'car-grid');
  for (const car of CARS) {
    const tile = el('button', 'car-tile' + (car.id === view.id ? ' viewing' : '') + (car.id === chosen.id ? ' chosen' : ''));
    tile.type = 'button';
    const cv = el('canvas');
    cv.width = 200;
    cv.height = 110;
    paintCar(cv, { ...car, color: carColor(car) }, carOpen(car));
    tile.append(cv, el('span', '', t('car_' + car.id)));
    if (!carOpen(car)) tile.append(el('small', 'lock', car.stars + ' ★'));
    tile.addEventListener('click', () => {
      garageView = car.id;
      if (carOpen(car)) {
        progress.car = car.id;
        saveProgress();
      }
      screenGarage();
    });
    grid.append(tile);
  }
  panel('wide', head(t('garage'), () => { garageView = null; screenMain(); }, el('span', 'head-note', t('starsTotal', { n: totalStars(), m: CHAPTERS.length * 3 }))), show, grid);
});

function paintCar(cv, car, open) {
  const c = cv.getContext('2d');
  const g2 = c.createLinearGradient(0, 0, 0, cv.height);
  g2.addColorStop(0, '#141a2e');
  g2.addColorStop(1, '#2a3047');
  c.fillStyle = g2;
  c.fillRect(0, 0, cv.width, cv.height);
  c.fillStyle = '#3b404c';
  c.beginPath();
  c.moveTo(cv.width * 0.3, cv.height * 0.55);
  c.lineTo(cv.width * 0.7, cv.height * 0.55);
  c.lineTo(cv.width, cv.height);
  c.lineTo(0, cv.height);
  c.closePath();
  c.fill();
  const v = VEHICLES[car.kind];
  const w = cv.width * 0.56;
  const h = w * v.ratio;
  c.globalAlpha = open ? 1 : 0.35;
  drawVehicle(c, (cv.width - w) / 2, cv.height * 0.92 - h, w, h, car.kind, car.color, { lights: 1 });
  c.globalAlpha = 1;
}

// ---------- leaderboard ----------

let scoreBoard = 'ch0';
let scoreGroup = 'all';
let boardToken = 0;

function npcEntries(board) {
  if (!board.startsWith('ch')) return [];
  const ch = CHAPTERS[Number(board.slice(2))];
  const segs = getTrack(ch.map).segments.length;
  return FRIENDS.map((f, k) => ({ name: L(f.name), value: Math.round((segs / (60 * (0.695 + k * 0.025)) + 4) * 10) / 10, color: f.color, npc: true }));
}

function boardValue(board, v) {
  return board.startsWith('ch') ? clock(v) : `${km(v)} ${t('km')}`;
}

function fillBoard(table, board, entries) {
  const asc = board.startsWith('ch');
  const rows = [...entries, ...npcEntries(board)].sort((a, b) => (asc ? a.value - b.value : b.value - a.value)).slice(0, 20);
  table.replaceChildren();
  rows.forEach((e, k) => {
    const me = progress.nick && !e.npc && e.name.toLowerCase() === progress.nick.toLowerCase();
    const li = el('li', 'row-entry' + (me ? ' me' : '') + (e.npc ? ' npc' : ''));
    const dot = el('i', 'dot');
    dot.style.background = e.color || '#888';
    const name = el('span', 'who', e.name);
    if (e.npc) name.append(el('small', '', t('bot')));
    if (me) name.append(el('small', '', t('you')));
    li.append(el('b', 'pos', String(k + 1)), dot, name, el('span', 'val', boardValue(board, e.value)));
    table.append(li);
  });
  if (!rows.length) table.append(el('li', 'empty', t('boardEmpty')));
}

const screenScores = screen(() => {
  const chip = (label, active, onClick) => {
    const b = el('button', 'chip' + (active ? ' on' : ''), label);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(active));
    b.addEventListener('click', onClick);
    return b;
  };
  if (scoreGroup !== 'all' && scoreGroup !== progress.group) scoreGroup = 'all';
  const groups = el('div', 'chips');
  groups.append(chip(t('groupAll'), scoreGroup === 'all', () => { scoreGroup = 'all'; screenScores(); }));
  if (progress.group) groups.append(chip(t('groupMine', { g: progress.group }), scoreGroup === progress.group, () => { scoreGroup = progress.group; screenScores(); }));
  else groups.append(chip(t('groupCreate'), false, () => {
    progress.group = newGroupCode();
    saveProgress();
    scoreGroup = progress.group;
    screenScores();
  }));
  const boards = el('div', 'chips boards');
  CHAPTERS.forEach((ch, i) => boards.append(chip(t('chapterShort', { n: i + 1 }), scoreBoard === 'ch' + i, () => { scoreBoard = 'ch' + i; screenScores(); })));
  MAPS.forEach((m) => boards.append(chip(L(m.name), scoreBoard === 'free-' + m.id, () => { scoreBoard = 'free-' + m.id; screenScores(); })));

  const table = el('ol', 'board');
  const status = el('p', 'board-note', '');
  fillBoard(table, scoreBoard, []);
  if (online()) {
    const token = ++boardToken;
    status.textContent = t('boardLoading');
    getBoard(scoreBoard, scoreGroup).then((res) => {
      if (token !== boardToken) return;
      status.textContent = '';
      fillBoard(table, scoreBoard, res.entries || []);
    }).catch(() => {
      if (token === boardToken) status.textContent = t('boardError');
    });
  } else {
    status.textContent = t('boardOffline');
  }

  const nameBox = el('div', 'name-box');
  const label = el('label', '', t('yourName'));
  label.htmlFor = 'nickInput';
  const input = el('input');
  input.id = 'nickInput';
  input.maxLength = 16;
  input.autocomplete = 'nickname';
  input.value = progress.nick || '';
  const saved = el('span', 'note', '');
  const saveBtn = btn(t('save'), '', () => {
    const v = input.value.replace(/\s+/g, ' ').trim().slice(0, 16);
    if (v.length < 2) { saved.textContent = t('nameHint'); return; }
    progress.nick = v;
    saveProgress();
    saved.textContent = t('saved');
  });
  const line = el('div', 'row');
  line.append(input, saveBtn);
  nameBox.append(label, line, el('small', 'hint', t('nameHint')), saved);

  let invite = null;
  if (progress.group) {
    invite = el('div', 'row');
    const note = el('p', 'note', '');
    invite.append(btn(t('groupInvite'), 'primary', async () => {
      const link = `https://asemface.com/?group=${progress.group}`;
      try {
        if (navigator.share) await navigator.share({ title: 'Әсем Жол', text: t('groupMine', { g: progress.group }), url: link });
        else {
          await navigator.clipboard.writeText(link);
          note.textContent = t('groupLink');
        }
      } catch {
        note.textContent = link;
      }
    }), btn(t('groupLeave'), 'ghost', () => {
      progress.group = null;
      saveProgress();
      scoreGroup = 'all';
      screenScores();
    }), note);
  }
  panel('wide', head(t('records'), () => screenMain()), groups, boards, table, status, nameBox, invite);
});

// sends a result after a race; asks for a name the first time
function scoreBox(board, value) {
  if (!online()) return null;
  const box = el('div', 'send-box');
  const status = el('p', 'note', '');
  const send = async (name) => {
    status.textContent = t('sending');
    try {
      const car = currentCar();
      const res = await submit({ b: board, g: progress.group || 'all', name, value, car: car.id, color: car.color });
      const all = res.results.all;
      let text = all && all.rank ? t('sent', { n: all.rank }) : t('sentOff');
      const grp = progress.group && res.results[progress.group];
      if (grp && grp.rank) text += ', ' + t('sentGroup', { n: grp.rank });
      status.textContent = text;
    } catch {
      status.textContent = t('sendFail');
    }
  };
  if (progress.nick) {
    box.append(status);
    send(progress.nick);
    return box;
  }
  const input = el('input');
  input.maxLength = 16;
  input.placeholder = t('yourName');
  input.setAttribute('aria-label', t('yourName'));
  const go = btn(t('send'), 'primary', () => {
    const v = input.value.replace(/\s+/g, ' ').trim().slice(0, 16);
    if (v.length < 2) { status.textContent = t('nameHint'); return; }
    progress.nick = v;
    saveProgress();
    line.remove();
    send(v);
  });
  const line = el('div', 'row');
  line.append(input, go);
  box.append(el('small', 'hint', t('yourName')), line, status);
  return box;
}

const screenPause = screen(() => {
  panel('', el('h2', '', t('paused')), (() => {
    const row = el('div', 'row');
    row.append(btn(t('resume'), 'primary', resume), btn(t('restart'), '', () => startRace(g.last)), btn(t('menu'), 'ghost', () => toMenu()));
    return row;
  })());
});

function showFinish() {
  showHud(false);
  playMusic(g.map.id, 0);
  const i = g.chapter;
  const ch = CHAPTERS[i];
  const r = g.result;
  const row = el('div', 'row');
  if (i + 1 < CHAPTERS.length) row.append(btn(t('next'), 'primary', () => toMenu(() => screenStory(i + 1))));
  row.append(btn(t('again'), i + 1 < CHAPTERS.length ? '' : 'primary', () => startRace(g.last)), btn(t('share'), '', () => share()), btn(t('menu'), 'ghost', () => toMenu()));
  const note = el('p', 'note', '');
  note.id = 'shareNote';
  currentScreen = null;
  const sendBox = r.best ? scoreBox(boardId('story', i), Math.round(r.time * 100) / 100) : null;
  panel('', el('h2', '', L(ch.title)), starsRow(r.stars), el('p', 'over-dist', clock(r.time)), el('p', r.place === 1 ? 'record' : 'best', r.place === 1 ? t('firstPlace') : t('finishPlace', { n: r.place, m: FRIENDS.length + 1 })), r.best && progress.times[i] === r.time && r.prevStars ? el('p', 'record', t('record')) : null, el('p', 'tag', L(ch.outro)), i + 1 === CHAPTERS.length ? el('p', 'note', t('storyEnd')) : null, sendBox, row, note);
}

function showFail() {
  g.mode = 'fail';
  showHud(false);
  playMusic(g.map.id, 0);
  const row = el('div', 'row');
  row.append(btn(t('again'), 'primary', () => startRace(g.last)), btn(t('menu'), 'ghost', () => toMenu()));
  currentScreen = null;
  panel('', el('h2', '', t('failTitle')), el('p', 'tag', t('failText')), row);
}

function showOver() {
  g.mode = 'over';
  showHud(false);
  playMusic(g.map.id, 0);
  const id = g.map.id;
  const isRecord = g.distance > (progress.best[id] || 0) + 0.0001;
  if (isRecord) {
    progress.best[id] = g.distance;
    saveProgress();
  }
  const row = el('div', 'row');
  row.append(btn(t('again'), 'primary', () => startRace(g.last)), btn(t('share'), '', () => share()), btn(t('menu'), 'ghost', () => toMenu()));
  const note = el('p', 'note', '');
  note.id = 'shareNote';
  currentScreen = null;
  const sendBox = isRecord && g.distance >= 0.2 ? scoreBox(boardId('free', id), Math.round(g.distance * 100) / 100) : null;
  panel('', el('h2', '', t('overTitle')), el('p', 'over-label', `${L(g.map.name)}. ${t('overSub')}`), el('p', 'over-dist', `${km(g.distance)} ${t('km')}`), isRecord ? el('p', 'record', t('record')) : null, el('p', 'best', t('best', { d: km(progress.best[id]) })), sendBox, row, note);
}

async function share() {
  const text = g.kind === 'story'
    ? t('shareStory', { c: L(CHAPTERS[g.chapter].title), n: g.result ? g.result.stars : 0 })
    : t('shareFree', { m: L(g.map.name), d: km(g.distance) });
  const url = 'https://asemface.com/';
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Әсем Жол', text, url });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }
  const note = $('shareNote');
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    if (note) note.textContent = t('copied');
  } catch {
    if (note) note.textContent = url;
  }
}

// ---------- map previews ----------

const thumbs = {};
function thumb(mapId) {
  if (thumbs[mapId]) return thumbs[mapId];
  const cv = document.createElement('canvas');
  const r = new Renderer(cv, { budget: 480 * 270 });
  const T = getTrack(mapId);
  r.resize(480, 270, 1);
  r.setMap(mapById(mapId));
  if (!T.cars.length) T.spawnCars(7);
  const at = T.zoneStart[Math.min(1, T.zoneStart.length - 1)] + 70;
  r.render({ track: T, position: at * SEG, playerX: T.lanes === 2 ? 0.5 : 0.2, speed: 0, steer: 0, braking: false, boosting: false, shake: 0, flash: 0, time: 1, dt: 0, parallax: 0, still: true, car: currentCar(), gateLabel: (seg) => L(mapById(mapId).zones[seg.gate - 1].gate) });
  thumbs[mapId] = cv.toDataURL('image/jpeg', 0.82);
  return thumbs[mapId];
}

// ---------- input ----------

const keys = new Set();
const pointers = new Map();
let nitroTouch = false;
function clearInputs() {
  keys.clear();
  pointers.clear();
  nitroTouch = false;
  syncInput();
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
  if (touchLeft && touchRight) brake = true;
  else if (touchLeft) left = true;
  else if (touchRight) right = true;
  input.left = left;
  input.right = right;
  input.brake = brake;
  input.nitro = keys.has('nitro') || nitroTouch;
  $('nitroBtn').classList.toggle('on', nitroTouch);
}
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowDown: 'brake', KeyS: 'brake', Space: 'brake',
  ArrowUp: 'nitro', KeyW: 'nitro', ShiftLeft: 'nitro', ShiftRight: 'nitro',
};
const racing = () => g.mode === 'play' || g.mode === 'countdown';
window.addEventListener('keydown', (e) => {
  if (KEYMAP[e.code] && racing()) {
    e.preventDefault();
    keys.add(KEYMAP[e.code]);
    syncInput();
    return;
  }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (g.mode === 'paused') resume();
    else if (racing()) pause();
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
  if (!racing()) return;
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
const nitroBtn = $('nitroBtn');
nitroBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  nitroTouch = true;
  syncInput();
});
for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
  nitroBtn.addEventListener(type, () => {
    nitroTouch = false;
    syncInput();
  });
}
window.addEventListener('blur', clearInputs);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseMusic(true);
  else if (g.mode !== 'paused') pauseMusic(false);
  if (document.hidden) pause();
});

function toggleSound() {
  setSound(!sound.on);
  $('muteBtn').textContent = sound.on ? t('soundOn') : t('soundOff');
}
$('pauseBtn').addEventListener('click', () => (g.mode === 'paused' ? resume() : pause()));
function toggleMusic() {
  setMusic(!music.on);
  if (music.on) playMusic(g.map.id, racingNow() ? 1 : 0);
  $('musicBtn').setAttribute('aria-pressed', String(music.on));
}
$('musicBtn').addEventListener('click', toggleMusic);
$('muteBtn').addEventListener('click', toggleSound);

function applyLang() {
  document.documentElement.lang = getLang();
  document.title = t('title');
  $('muteBtn').textContent = sound.on ? t('soundOn') : t('soundOff');
  $('pauseBtn').setAttribute('aria-label', t('pause'));
  $('musicBtn').setAttribute('aria-label', t('musicOn'));
  $('musicBtn').setAttribute('aria-pressed', String(music.on));
  nitroBtn.setAttribute('aria-label', t('nitroBtn'));
  for (const k of Object.keys(thumbs)) delete thumbs[k];
}

// ---------- loop ----------

function resize() {
  renderer.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);

const view = {
  get track() { return g.track; },
  get position() { return g.position; },
  get playerX() { return g.playerX; },
  get speed() { return g.speed; },
  get steer() { return g.steer; },
  get braking() { return g.braking || g.mode === 'ending'; },
  get boosting() { return g.boosting; },
  get shake() { return g.shake; },
  get flash() { return g.flash; },
  get time() { return g.time; },
  get parallax() { return g.parallax; },
  get still() { return g.mode === 'paused'; },
  get car() { return currentCar(); },
  dt: 0,
  gateLabel(seg) {
    const z = seg.gate - 1;
    if (g.kind === 'story' && z === 0 && g.mode !== 'menu') return g.nextZone === 0 || g.mode === 'finish' || g.mode === 'done' ? t('gateFinish') : t('gateStart');
    return L(g.map.zones[z].gate);
  },
};

let last = performance.now();
let acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (g.mode !== 'paused') {
    acc += dt;
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
    }
  }
  view.dt = g.mode === 'paused' ? 0 : dt;
  renderer.render(view);
  updateHud();
  engine(g.speed / BASE_MAX, ['play', 'countdown', 'ending', 'finish'].includes(g.mode), g.boosting, currentCar().electric);
  requestAnimationFrame(frame);
}

setMap(mapOpen(progress.map) ? progress.map : 'city');
flushPending();
resize();
applyLang();
toMenu();
requestAnimationFrame(frame);

// ?og renders a clean frame for the link preview image (og.png)
const params = new URLSearchParams(location.search);
if (params.has('og')) {
  document.body.classList.add('og');
  setMap(params.get('map') || 'city');
  g.position = (g.track.zoneStart[1] + 170) * SEG;
  const title = el('div', 'og-title');
  title.append(el('b', '', 'Әсем Жол'), el('span', '', t('tag').split(':')[0]));
  document.body.append(title);
}

if (params.has('debug')) {
  window.__asem = {
    g,
    progress,
    renderer,
    step(n = 60) {
      for (let k = 0; k < n; k++) update(STEP);
      view.dt = STEP;
      renderer.render(view);
      updateHud();
    },
    start: startRace,
    menu: toMenu,
    press(name, on) {
      if (on) keys.add(name);
      else keys.delete(name);
      syncInput();
    },
    screens: { screenMain, screenChapters, screenMaps, screenGarage, screenStory },
  };
}
