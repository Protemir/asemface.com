import { store } from './util.js';

const TEXT = {
  ru: {
    title: 'Әсем Жол: ночная гонка по Алматы',
    tag: 'Гонка по Алматы и горам вокруг: от ночного города до Медеу, Шымбулака, Капчагая и Чарына.',
    story: 'Сюжет',
    storySub: 'Глава {n} из {m}',
    storyDoneSub: 'Пройден, звёзд {s} из {m}',
    free: 'Свободная езда',
    freeSub: 'Бесконечные круги на любой открытой карте',
    garage: 'Гараж',
    back: 'Назад',
    chapter: 'Глава {n}',
    lockedChapter: 'Сначала пройди главу {n}',
    lockedStars: 'Откроется за {n} ★',
    go: 'Поехали',
    goal: 'Цель',
    best: 'Рекорд: {d} км',
    noBest: 'Рекорда пока нет',
    kmh: 'км/ч',
    km: 'км',
    sec: 'с',
    checkpoint: '+{s} с',
    lap: 'Круг {n}',
    goText: 'Газ!',
    paused: 'Пауза',
    resume: 'Продолжить',
    restart: 'Заново',
    menu: 'В меню',
    next: 'Следующая глава',
    again: 'Ещё раз',
    share: 'Поделиться',
    copied: 'Ссылка скопирована',
    finishTitle: 'Финиш',
    failTitle: 'Не успели',
    failText: 'Время кончилось раньше финиша. Попробуй ещё раз, чекпоинты добавляют время.',
    overTitle: 'Время вышло',
    overSub: 'Проехано',
    record: 'Новый рекорд',
    yourTime: 'Время: {t}',
    toFinish: 'До финиша {d} км',
    nearMiss: 'Впритык! +нитро',
    nitro: 'Нитро',
    soundOn: 'Звук',
    soundOff: 'Тихо',
    pause: 'Пауза',
    keys: '← → руль, ↓ тормоз, ↑ или Shift нитро, P пауза. Газ жмётся сам.',
    keysTouch: 'Руль: палец слева или справа. Тормоз: оба сразу. Нитро: круглая кнопка справа внизу. Газ жмётся сам.',
    more: 'Ещё игра: тест реакции на gamemetric.dev',
    shareFree: 'Мой результат в «Әсем Жол» на карте «{m}»: {d} км. Побьёшь?',
    shareStory: 'Прошёл главу «{c}» в «Әсем Жол» на {n} из 3 ★. Попробуй быстрее.',
    stat_speed: 'Скорость',
    stat_accel: 'Разгон',
    stat_grip: 'Сцепление',
    stat_offroad: 'Бездорожье',
    selected: 'Выбрана',
    choose: 'Выбрать',
    starsTotal: 'Звёзд: {n} из {m}',
    storyEnd: 'История пройдена. Все карты открыты в свободной езде.',
    car_hatch: 'Хэтчбек Әсем',
    car_niva: 'Нива',
    car_sport: 'Спорткар',
    car_hatch_note: 'Красная, быстрая, своя. С ней всё начиналось.',
    car_niva_note: 'Медленнее, но обочина, снег и степь ей почти не мешают.',
    car_sport_note: 'Самая быстрая, но в поворотах её тянет наружу.',
    nitroBtn: 'Нитро',
    gateStart: 'СТАРТ',
    place: 'Место {n} из {m}',
    friendBehind: '{name} позади!',
    friendPasses: '{name} обгоняет!',
    finishPlace: 'Место на финише: {n} из {m}',
    firstPlace: 'Первое место! Друзья только в зеркале.',
    gateFinish: 'ФИНИШ',
  },
  en: {
    title: 'Asem Road: a night race through Almaty',
    tag: 'A race through Almaty and the mountains around it: from the night city to Medeu, Shymbulak, Kapchagay and Charyn.',
    story: 'Story',
    storySub: 'Chapter {n} of {m}',
    storyDoneSub: 'Done, {s} of {m} stars',
    free: 'Free ride',
    freeSub: 'Endless laps on any unlocked map',
    garage: 'Garage',
    back: 'Back',
    chapter: 'Chapter {n}',
    lockedChapter: 'Finish chapter {n} first',
    lockedStars: 'Unlocks at {n} ★',
    go: 'Drive',
    goal: 'Goal',
    best: 'Best: {d} km',
    noBest: 'No best yet',
    kmh: 'km/h',
    km: 'km',
    sec: 's',
    checkpoint: '+{s} s',
    lap: 'Lap {n}',
    goText: 'Go!',
    paused: 'Paused',
    resume: 'Resume',
    restart: 'Restart',
    menu: 'Menu',
    next: 'Next chapter',
    again: 'Again',
    share: 'Share',
    copied: 'Link copied',
    finishTitle: 'Finish',
    failTitle: 'Too late',
    failText: 'The clock ran out before the finish. Try again, checkpoints add time.',
    overTitle: 'Time is up',
    overSub: 'Distance',
    record: 'New best',
    yourTime: 'Time: {t}',
    toFinish: '{d} km to the finish',
    nearMiss: 'Close call! +nitro',
    nitro: 'Nitro',
    soundOn: 'Sound',
    soundOff: 'Muted',
    pause: 'Pause',
    keys: '← → steer, ↓ brake, ↑ or Shift nitro, P pause. The gas is automatic.',
    keysTouch: 'Left or right side to steer, both at once to brake, the round button for nitro. The gas is automatic.',
    more: 'One more game: a reaction test at gamemetric.dev',
    shareFree: 'I drove {d} km on the {m} map in Asem Road. Can you beat it?',
    shareStory: 'I finished "{c}" in Asem Road with {n} of 3 stars. Try to be faster.',
    stat_speed: 'Speed',
    stat_accel: 'Acceleration',
    stat_grip: 'Grip',
    stat_offroad: 'Off-road',
    selected: 'Selected',
    choose: 'Choose',
    starsTotal: 'Stars: {n} of {m}',
    storyEnd: 'Story complete. Every map is open in free ride.',
    car_hatch: 'Asem\'s hatchback',
    car_niva: 'Niva',
    car_sport: 'Sports car',
    car_hatch_note: 'Red, quick and hers. Where it all started.',
    car_niva_note: 'Slower, but shoulders, snow and steppe barely slow it down.',
    car_sport_note: 'The fastest, but it drifts wide in the corners.',
    nitroBtn: 'Nitro',
    gateStart: 'START',
    place: 'Place {n} of {m}',
    friendBehind: '{name} is behind you!',
    friendPasses: '{name} overtakes!',
    finishPlace: 'Finished {n} of {m}',
    firstPlace: 'First place! Your friends are only in the mirror.',
    gateFinish: 'FINISH',
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

export const getLang = () => lang;
export function setLang(next) {
  if (!TEXT[next]) return;
  lang = next;
  store.set('asem.lang', lang);
}

export function t(key, vars) {
  let s = TEXT[lang][key] ?? TEXT.ru[key] ?? key;
  if (vars && typeof s === 'string') s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return s;
}

// map and chapter texts live next to their data as { ru, en }
export const L = (obj) => (obj == null ? '' : typeof obj === 'string' ? obj : obj[lang] ?? obj.ru);

export const km = (d) => d.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function clock(sec) {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}
