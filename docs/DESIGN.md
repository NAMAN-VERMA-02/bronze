# BRONZE: The Aurel Valley (game design)

An original economic strategy game for 1–4 players (any mix of friends and AI)
on a 3D tabletop. You mine copper, tin and coal, smelt them into bronze, turn
bronze into machines, and race to fill the valley's contracts. Play takes about
40 minutes.

## The hook in one line

**A shared, living economy on a time track.** Every action costs time.
Whoever is furthest behind on the track moves next. Prices move with every
sale and purchase. Your mines, routes and bronze become things other players
pay you to use.

## Why it's fun (design goals and how each is met)

| Goal | Mechanic |
|---|---|
| Every turn is a real choice | **Time track:** big moves cost more time, so a fast, cheap action can let you act twice before a rival acts once. |
| Players affect each other without "take that" | **Paid sourcing:** if you need copper and your rival owns the nearest copper mine, you buy from it and the money goes to them. **Tolls:** goods that cross a rival's route pay that rival £1. |
| Prices feel alive | **Exchange:** every unit sold lowers its price one step, every unit bought raises it one step, and prices drift back toward normal at each Market Tick. |
| Pressure and urgency | **Aging contracts:** at each tick, every waiting contract pays £2 more, and the oldest one leaves the table. |
| Many paths to win | Route baron (tolls + route VP), industrialist (building VP every Age), trader (exchange swings), contractor (contract VP), plus 3 random **Patron goals** each game. |
| No runaway leader | A **Wait** action pays £1 per step you skip (a headwind, not a catapult). Each new Age starts with the lowest scorer first. |
| Replay value | Random contract decks, a random event at each tick, 3 of 8 Patron goals per game, and AI personalities. |

## Components

- **Map:** the fictional Aurel Valley has 18 towns and 3 ports (Saltmouth,
  Northgate, Eastmarch). Each town has 1–3 building plots. Some towns sit on
  a **deposit** (coal, copper or tin). Links between towns are either
  **river** links or **land** links.
- **Goods (cubes):** coal, copper, tin (raw), bronze (refined), machines
  (advanced).
- **Buildings** (each player's personal stock):

| Building | Levels | Cost | Does | VP each Age end | Income |
|---|---|---|---|---|---|
| Mine | I / II / III | £6 / £10 / £15 | Run: produces 2 / 3 / 4 of its deposit's good | 1 / 2 / 4 | +1 / +1 / +2 |
| Smelter | I / II / III | £12 / £18 / £26 | Run: up to 1 / 2 / 3 batches of 2 copper + 1 tin + 1 coal → 1 bronze | 2 / 4 / 6 | +1 / +2 / +3 |
| Works | I / II / III | £16 / £24 / £34 | Run: up to 1 / 2 / 3 batches of 2 bronze + 1 coal → 1 machine | 3 / 5 / 8 | +2 / +3 / +4 |

Stock per player: 6 mines, 3 smelters and 2 works. Level II needs Age II or
later, and level III needs Age III.

## Turn structure: the time track

Each Age has a time track from 0 to 24. The player with the **lowest time**
acts. On a tie, the player who arrived there last acts first. After acting,
you move your marker forward by the action's cost.

| Action | Time | What it does |
|---|---|---|
| **Build** | 3 | Put a building on a free plot in a town in your network (any town if you have no buildings yet). Mines go only on a matching deposit. You can also **upgrade** your own building to a higher level by paying the cost difference. |
| **Route** | 2 | Claim a free link touching your network. A river link costs £3 (any Age). A land link (rail) costs £6 + 1 coal and is only allowed from Age II. You own it from then on. |
| **Run** | 1 | Activate one of your buildings. Mines produce onto themselves. Smelters and works pull inputs in this order: your own buildings, then rivals' buildings (you pay the rival the exchange price), then the exchange (only if the town is connected to a port, and you pay the price, which then rises). Goods travel over connected links and pay tolls. |
| **Deliver** | 2 | Fill a contract: move the goods to its town over connected links (from your buildings, or bought from rivals). Collect its £ and VP. |
| **Trade** | 1 | Sell any number of one good from your buildings to the exchange. The building must connect to a port. Each unit sells at the current price, and then the price drops one step. |
| **Bond** | 1 | Take £20. Your income drops by 3 for the rest of the game (maximum 3 bonds). |
| **Wait** | — | Jump to 1 step past the next player and gain £1 per step moved. |

**Network:** your network is every town where you own a building or touching
a link you own.

**Movement and tolls:** goods move from town to town along any claimed links,
whoever owns them. For every link owned by someone else, you pay that owner
£1. The game always picks the cheapest path. If there's no path, you can't
move the goods.

## Market Ticks and Paydays (times 8, 16 and 24)

- **Payday (personal):** whenever *you* cross 8, 16 or 24, you collect your
  income. If the result is negative, you pay it, and every £ you can't pay
  costs 1 VP.
- **Market Tick (shared):** the first time *anyone* crosses 8, 16 or 24, three
  things happen. Each price moves one step back toward its start. Every
  waiting contract gains +£2, and the oldest one is discarded and replaced.
  An **event** card is also revealed (for example: "Tin rush: tin −2 steps",
  "Rail boom: land links cost £2 less until the next tick", "Foundry fever:
  bronze +2 steps").

## Contracts

There are always 4 open contracts. Each one names a town, the goods it wants
(for example "2 bronze to Northgate"), a £ reward and a VP reward. Each Age
has its own deck. Age I asks mostly for raw goods and a little bronze, Age II
asks for bronze and the first machines, and Age III asks for machines in
bulk. Ports pay the most.

## Age end (3 Ages)

When every player reaches 24, the Age ends:
1. Each building scores its VP.
2. Each route scores 1 VP for every building (anyone's) in its two end towns.
3. Times reset to 0, and the lowest VP total goes first.
4. A new contract row is dealt from the next Age's deck.

## Game end (after Age III)

Every £4 converts to 1 VP, and each bond costs 5 VP. Then the 3 Patron goals
pay 8 VP to the leader and 4 VP to the runner-up. The highest VP wins, with
money breaking ties.

**Patron goals (3 drawn from 8):** most contracts filled, most routes owned,
most tolls earned, most level-III buildings, most machines delivered, a mine
of every deposit type, most ports connected, most bronze smelted.

## Exchange prices (index 0–7, start index 3)

| Good | Price by index |
|---|---|
| Coal | 1 2 2 3 3 4 5 6 |
| Copper | 2 2 3 3 4 5 6 7 |
| Tin | 2 3 3 4 5 6 7 8 |
| Bronze | 8 10 11 12 14 16 18 21 |
| Machine | 18 21 24 27 30 34 38 42 |

## Play modes

- **Solo / AI:** 1–3 AI rivals with 3 difficulties and 4 personalities.
- **Friends, same screen:** hot-seat play.
- **Friends online:** the host shares a 5-letter table code. Connections are
  peer-to-peer over WebRTC (PeerJS), so no server is needed and it still runs
  on GitHub Pages. The host's browser runs the rules engine. Guests send
  actions and receive the updated state.

## Tuning

All numbers live in `shared/src/valley/data.ts`. The `npm run balance` script
plays thousands of AI-vs-AI games and reports win rates by personality and
strategy, game length, and average scores. The numbers above are the
starting point, and the README reports the tuned results.

## Research notes

These general design principles shaped the rules:

- A price that follows remaining supply is the classic way to build a market
  into a board game.
- The time-track turn order comes from a family of games that let bigger
  actions cost more turns.
- Designers generally prefer headwinds and multiple paths to victory over
  "catapult" catch-up bonuses.
- Shared infrastructure creates interaction without direct attacks.
