# asemface.com: Әсем Жол

A small night racing game in the browser. You drive through Almaty: Abay Avenue, Al-Farabi, the mountain road and up to Medeu, then back down to the city for the next lap. Overtake traffic, hit the checkpoints before the clock runs out, beat your best distance.

Plain canvas and JS, no build step, no images, no requests. Everything you see (cars, poplars, apple trees, pines, buildings, lamps, the Alatau on the horizon) is drawn with canvas shapes. Best distance and settings stay in localStorage.

Controls: arrows or A/D to steer, down or space to brake, P to pause, M for sound. On a phone, hold the left or right half of the screen to steer and both halves to brake. The gas is automatic.

The road uses the classic pseudo-3D segment projection. Jake Gordon's write-up of his javascript-racer explains it best.

Run it with any static server, for example `npx serve .`. `?debug` exposes `window.__asem` for stepping the game by hand, `?og` renders the clean frame used for `og.png`.
