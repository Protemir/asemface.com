# asemface.com: Әсем Жол

A racing game in the browser, set in Almaty and the mountains around it.

There is a story of five chapters. Asem gets a late order: hot baursaks to Shymbulak by sunrise. Each chapter is one lap of its own map with a finish line, checkpoints that add time and up to three stars for a fast run:

1. Almaty by night: Abay, Al-Farabi, up to Kok-Tobe and back along Dostyk.
2. The road to Medeu: snow, switchbacks, avalanche galleries, oncoming traffic.
3. Shymbulak at dawn: pink snow on the peaks, the cable car, the pass.
4. Kapchagay at sunset: steppe, trucks, yurts, camels, wind turbines and the lake.
5. Charyn: red table mountains, rock pillars and the ash grove.

Five friends race along in every run, each in their own car: Daurito in a Skoda, Orito in a Sorento, Sakito in a Kia, Erito in a Volkswagen and Timito in a Changan. Their names float over the cars, they shout at you in Kazakh when you pass them or they pass you, and the HUD shows your place. The horn (H, or the button on a phone) makes people jump away early, slow cars move over and friends answer back. Overtakes, especially close ones, fill the nitro. Free ride gives endless laps on any map, with a best distance per map. The garage has seven cars, three of them open with stars, and twelve paint colours. Every map has its own generated music. People on the pavements shout and dive out of the way, and inflatable men, snowmen, cones and melon stalls fly when you hit them. The leaderboard has a shared board and private groups for friends; it runs on the small Cloudflare Worker in worker/.

Plain canvas and JS modules, no build step, no images, no requests. Everything you see is drawn with canvas shapes. Progress stays in localStorage.

Controls: arrows or A/D to steer, down or space to brake, up, W or Shift for nitro, H for the horn, P to pause, M for sound. On a phone, hold the left or right half of the screen to steer, both halves to brake, and the round buttons for nitro and the horn. The gas is automatic.

Code: `js/maps.js` holds the maps, chapters, friends and cars, `js/track.js` the road and traffic, `js/render.js` the drawing, `js/sprites.js` every object and vehicle, `js/main.js` the game itself. The road uses the classic pseudo-3D segment projection; Jake Gordon's write-up of his javascript-racer explains it best.

Run it with any static server, for example `npx serve .` (modules do not load from `file://`). `?debug` exposes `window.__asem` for stepping the game by hand, `?og&map=kapchagay` renders the clean frame used for `og.png`.
