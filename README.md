# Harborlight — an open-world crime game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/calebpaschal35/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/calebpaschal35/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Harborlight is a complete open-world crime game in the spirit of GTA 6, built as
static files with no libraries and no network requests. Explore the city of
Harborlight on foot and by car, steal cars, dodge or outrun the Harborlight PD
through a 0–5 star wanted system, take on 5 story jobs for the fixer Marta Solis,
fight with fists and firearms, and save your progress — all in the browser.

## Run it

```sh
# Open game/index.html in desktop Chrome. No server needed, no network requests.
open game/index.html
```

## What's inside

- A 3200×3200 city with 5 districts (Downtown, Riverside, The Docks, Old Town,
  Palm Beach), 7 car models, arcade driving physics, traffic AI and pedestrians.
- Wanted 0–5 stars: police chase, ram and shoot at 3+ stars; get busted and you
  are arrested.
- 5 linear story jobs: steal the coupe, the handoff, shake a 3-star tail in 90
  seconds, wreck 3 Redline cars, and a bank heist with a boat escape.
- Combat (fists, pistol, buyable SMG), HUD with health, cash, stars, clock and a
  circular minimap, start screen (Story / Continue / Free Roam), pause, busted and
  wasted screens, localStorage saves, and WebAudio-synthesized sound (M to mute).
- `main.ts` (Node 22) exports the game to `/output` for grading; `vendor/`
  holds the make.fun app harness unchanged.

---

<sub>Entered on [make.fun](https://make.fun/?ref=hrrz9v0m&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
