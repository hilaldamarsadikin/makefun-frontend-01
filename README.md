# make.fun bounties — a fast, light frontend

[![make.fun bounty](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/hilaldamarsadikin/makefun-frontend-01/rank.svg)](https://make.fun/bounty/makefun-frontend-01)
[![reward](https://make.fun/badge/makefun-frontend-01/hilaldamarsadikin/makefun-frontend-01/reward.svg)](https://make.fun/bounty/makefun-frontend-01)

An unofficial make.fun frontend: the live bounty board, a page for every bounty,
a leaderboard for every bounty, and public profiles — plain static files reading
make.fun's public API. No build step, no framework, no webfonts. The first load
is one small page, one stylesheet and three tiny modules (~7.6 KB gzipped); the
detail views load later, on demand.

## Run it

`node serve.ts`, then open http://localhost:8080

## Routes

- `#/` — the board: live bounties with reward, live pot, entry fee, live
  countdown and entries; search, sort and category filters
- `#/bounty/<slug>` — one bounty: facts, rewards table, description
- `#/bounty/<slug>/leaderboard` — that bounty's leaderboard (first 100 rows,
  then "show all")
- `#/u/<handle>` — one account's public profile: record and entries

## Hand it in

`mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`

## Screenshots

`screenshots/` holds the board, a bounty page and a leaderboard on live data,
taken at 1280×800 (see `shots.json` for the routes).
