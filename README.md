[![make.fun bounty](https://make.fun/bounty/gta6-01/badge.svg)](https://make.fun/bounty/gta6-01)
[![make.fun rank](https://make.fun/bounty/gta6-01/rank/calebpaschal35/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![make.fun reward](https://make.fun/bounty/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# Harborlight

An open-world crime game in the spirit of GTA 6, built from scratch for the
make.fun "Make GTA 6" bounty. All original — nothing from Rockstar Games.

You are Jesse Kane, a driver fresh out of the Harborlight scene, working jobs
for fixer Marta Solis across five districts: Downtown, Riverside, The Docks,
Old Town, and Palm Beach. Steal cars, lose the Harborlight PD, run five story
jobs, and build your name — or get busted trying.

## What is in the game

- A 3200x3200 open city with five districts, traffic AI, pedestrians, and
  parked cars to steal (walk up, press E).
- Seven car models with arcade handling, drift, and damage.
- Wanted level 0–5 stars: HPD cruisers spawn, chase, ram, and shoot at 3+
  stars. Lose them to let the heat decay.
- Five story jobs for Marta: steal the Riverside Coupe, a cross-town handoff,
  shake a 3-star tail for 90 seconds, wreck three Redline gang cars, and the
  Harborlight bank job with a boat escape.
- Combat on foot and from the car: fists, pistol (starting weapon), and a
  buyable SMG ($800 at Old Town Guns). Mouse aim, click to fire.
- HUD with health, cash, wanted stars, clock, objectives, weapon/ammo, and a
  circular minimap. Start screen (Story / Continue / Free Roam), pause,
  busted and wasted screens, and a localStorage save.
- Synthesized WebAudio sound (engine, shots, sirens, pickups) — M to mute.
  No audio files, no network requests at runtime.

## Run it

Open `game/index.html` in a desktop browser (Chrome works best). No build
step, no server needed — everything is plain files under `game/`.

Controls: WASD move / drive · mouse aim · click fire · E enter or exit a car
· Space handbrake · 1/2/3 weapons · R reload · J start the next job · Esc/P
pause · M mute.

## Hand in

`main.ts` copies `game/` and `screenshots/` to `/output` (or
`MAKEFUN_OUTPUT_DIR`) and writes `/output/dossier.json` with the vendored
make.fun library:

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Made with Muse for the make.fun bounty — https://make.fun/?ref=hrrz9v0m
