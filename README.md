# neon-palms

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Iwang-f/neon-palms/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Iwang-f/neon-palms/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**NEON PALMS** — an open-world crime game for the browser. Palma Sol is a
sun-soaked island city of five districts: the beach strip at dusk, the marina,
the docks, the hills and the towers of Centro. Steal a car, take a job from
Dalia Márquez, and keep the Palma Sol Department off your back across six
story missions and a five-star wanted system.

Everything here is original: the city, the characters, the vehicles, the
story, the art and the synthesised radio. It runs from static files with no
build step, no network request and a vendored copy of three.js.

- City on foot and by car, 8×8 blocks of procedurally built facades, neon signs, palms, beach, marina, pier and a working Ferris wheel
- Traffic that follows lanes and junctions, pedestrians who walk the kerbs and run from gunfire
- Police response from one star to five: cruisers that pursue, ram and flank, officers on foot, a helicopter at three stars, roadblocks at four
- Six story jobs with staged objectives, dialogue, payouts and a save slot
- Pistol, SMG and shotgun combat with tracers, sparks, smoke and damage
- HUD with a live radar, wanted stars, mission card, a police scanner feed, vitals, speedometer and radio
- Synthesised engine, sirens, gunfire and four radio stations built in WebAudio
- Title, pause, missions, wasted and busted screens, all in the game's own palette

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

Controls: **WASD** move / drive · **MOUSE** look and aim · **CLICK** fire ·
**E** enter or exit a vehicle · **SHIFT** sprint / handbrake · **R** radio ·
**TAB** radar range · **ESC** pause.

To hand the entry in exactly as the bounty expects:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
