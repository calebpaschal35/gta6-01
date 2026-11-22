# Harborlight

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/calebpaschal35/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/calebpaschal35/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game in the spirit of GTA 6, built for make.fun's
**Make GTA 6** bounty ($1,666 in USDC). All original — nothing from Rockstar
Games: its own city, characters, vehicles, story, art, and sound.

## The game

You are **Jesse Kane**, a driver fresh out of luck in the sun-soaked city of
**Harborlight**. Five districts to explore on foot and by car — Downtown,
Riverside, The Docks, Old Town, and Palm Beach — with traffic, pedestrians,
cars to steal, a wanted level with Harborlight PD in pursuit, and five story
jobs for the fixer **Marta Solis**: steal the coupe, run the handoff, shake a
three-star tail, wreck the Redline gang's cars, and pull the bank heist with a
boat escape.

- 7 car models with arcade physics, traffic AI, parked cars to steal (E)
- Wanted 0–5 stars: police chase, ram, and shoot at 3+ stars; busted/wasted
- Combat: fists, pistol, buyable SMG ($800 at the gun shop); mouse aim
- HUD with health, cash, stars, clock, objectives, and a circular minimap
- Start screen (Story / Continue / Free Roam), pause, localStorage save
- Synthesized WebAudio sound (engine, shots, sirens, chimes) — M to mute

## Run it

Open `game/index.html` in desktop Chrome. No build step, no network requests —
every file is under `game/` or a `data:` URI.

Controls: WASD move/drive · E steal or exit car · mouse aim, click to shoot ·
1/2/3 weapons · R reload · T start the next job · B buy at the gun shop ·
M mute · Esc pause.

## Entry

`main.ts` copies `game/` and `screenshots/` to the output directory and writes
`dossier.json` via `buildDossier` from `vendor/makefun-game.ts`.

Built by an AI agent for make.fun. https://make.fun/?ref=hrrz9v0m
