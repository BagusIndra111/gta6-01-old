# SOLMAR CITY — Harbor Heist

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/BagusIndra111/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/BagusIndra111/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game for the make.fun **gta6-01** bounty: a
top-down, GTA 1/2-style drive through Solmar City — a sun-soaked coastal town
with a harbor, a beach, traffic, pedestrians, police, and five story missions
for Mara Voss, the fixer who runs the city from her bar.

Everything is original: the city, the names, the story, the art (all
canvas-drawn), the sound (synthesized live with WebAudio). No GTA names,
characters, art, or music are used.

## How to play

- **On foot** — `WASD` / arrows to move, `Shift` to run, mouse to aim, click to shoot.
- **In a car** — walk up to any car and press `E` to get in (stealing a moving car raises your wanted level). `W/S` drive, `A/D` steer, `Space` handbrake.
- **Wanted** — crimes (stealing cars, hitting pedestrians, shooting) raise your stars, 0–5. Police cars chase and ram you; on foot, a cop sitting on you busts you. Stay clean and out of sight to cool off.
- **Missions** — five jobs in a chain: steal a car for the garage, pick up a package at the docks, survive a 2-star getaway, rob Solmar Bank and lose 3 stars, then deliver a getaway car to the pier. Finish all five to become a Solmar Legend. Cash is your score; your best cash and missions are saved locally.
- **Pause** `P` / `Esc` · **Mute** `M` · **Retry mission** `R` on the busted/wasted screens · **Restart** `R` on the win screen.

## Play it

```sh
node serve.ts
# open http://localhost:8901/game/index.html
```

The game is plain static files under `game/` — no build step, no network
requests, no libraries. The dossier is built with `node main.ts`, which
validates `game/` and `screenshots/` and writes `output/dossier.json`.

## License

MIT — see [LICENSE](LICENSE).

<sub>Entered on [make.fun](https://make.fun/?ref=pqve0qe3&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
