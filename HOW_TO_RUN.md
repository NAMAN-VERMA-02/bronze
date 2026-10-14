# HOW TO RUN — BRONZE

A rule-driven digital tabletop strategy game inspired by the Midlands industrial board-game genre,
presented as a physical Victorian-industrial tabletop inside a dark workshop.

---

## 1. Prerequisites

- **Node.js ≥ 18** (tested with Node 20+ / npm 11)
- A Chromium- or Firefox-class browser with WebGL2 (Chrome/Edge/Firefox current)
- No database, no external services. Everything runs locally.

## 2. Install & Run

From the repository root (`ai26aug/`):

```bash
npm install          # installs all workspaces
npm run client       # dev server → http://localhost:5173
```

Useful scripts (defined in the root `package.json`):

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs **server + client** together (full multiplayer forge + game) |
| `npm run client` | Client only — Home page & BRONZE game |
| `npm run typecheck` | TypeScript check across shared/server/client |
| `npm run build` | Production build of every workspace |
| `npm run smoke` | Shared-package smoke tests |

Production output lands in `client/dist/` (multi-page: `index.html`,
`kinetic.html`, `forge.html`).

## 3. URLs

| URL | Experience |
| --- | --- |
| `/` | **HOME** — cinematic Victorian workshop entry (Create / Join / Play-with-AI) |
| `/kinetic.html` | **GAME** — the full BRONZE tabletop (also reachable via home buttons, deep-links `#create`, `#join`, `#ai`) |
| `/forge.html` | Legacy multiplayer "Digital Forge" (PixiJS + socket.io prototype) |

Opening `/` never starts a game. Starting a match is always an explicit action.

## 4. Folder Structure (what lives where)

```
ai26aug/
├─ docs/
│  └─ visual-design-spec.md      # art-direction & prompt engineering spec
├─ HOW_TO_RUN.md                 # this file
├─ package.json                  # workspaces + scripts
├─ shared/src/
│  ├─ engine/{logic,setup,rng}.ts# original multiplayer rules prototype
│  └─ data/{map,tiles,cards}.ts  # legacy multiplayer data
├─ server/src/                   # socket.io host for the legacy forge
└─ client/
   ├─ index.html                 # HOME page (pure CSS/SVG atmosphere)
   ├─ kinetic.html               # GAME page shell (HUD markup + styles)
   ├─ forge.html                 # legacy multiplayer page
   ├─ vite.config.ts             # dev proxy + multi-page build inputs
   └─ src/
      ├─ main.ts                 # legacy forge entry
      └─ kinetic/                # ★ THE GAME
         ├─ main.ts              # scene bootstrap, camera, interaction glue,
         │                       #   opening cinematic, reveal uniforms,
         │                       #   pause/reset wiring, contextual trays
         ├─ state.ts             # RULE ENGINE — single source of truth:
         │                       #   MAP_DATA (27 locations, canal/rail links),
         │                       #   players/supplies/deck, legal-action queries,
         │                       #   resolve* mutations, era scoring, turn order
         ├─ ai.ts                # AI — reads state via the same legality queries
         ├─ session.ts           # table codes, local join/create registry
         ├─ screens.ts           # HOME-hub / CREATE / JOIN / LOBBY controllers
         ├─ hud.ts               # DOM HUD (plates, cards, log, popover, menu)
         ├─ audio.ts             # SFX bus (WebAudio, compressor-limited)
         ├─ music.ts             # generative adaptive soundtrack (8 tracks)
         ├─ textures.ts          # procedural parchment map, labels, mural
         ├─ pieces.ts            # industry miniatures, skyline, pawns helpers
         └─ palette.ts           # shared colors
```

## 5. Where Things Are (state / rules / data)

- **Authoritative game state:** `client/src/kinetic/state.ts`
  - `createInitialGameState(seats?, seed?)` — deterministic setup (seed ⇒ same deal & turn order on Reset)
  - Legal queries: `legalActions`, `buildOptionsForCity`, `allBuildOptions`, `legalNetworkLinks`, `getLegalDevelopments`, `sellableIndustries`
  - Resolvers: `resolveBuild/resolveNetwork/applyNetworkDouble/resolveDevelop/resolveSell/resolveLoan/resolveScout/resolvePass/advanceTurn`
- **Map data:** same file — `CITIES`, `LINKS`, `MAP_AUDIT_EXPECTED` (audited against the official player-aid card-distribution table; merchants Warrington/Shrewsbury/Gloucester/Oxford/Nottingham included)
- **Card deck/hands:** generated in `state.ts`; wilds enter only through Scout
- **AI:** `client/src/kinetic/ai.ts` — uses only the exported legality queries and resolve* mutations
- **Reveal/lighting state:** derived in `main.ts` from placements + owned links (`torchTarget`, `segIntensity`, `revealUniforms.uGlobal`)
- **Persistence:** none yet. Table codes are stored in `localStorage` under `kinetic.tables` for Join flow only. Save/resume is *prepared* (state is plain serializable data) but not implemented.

## 6. Rules Coverage (honest status)

Implemented per official rules: player-count rounds 10/9/8, first Canal round = 1 action, two actions afterwards, spend-based turn order each round, 8-card hands with mandatory discards, lowest-tile builds from player mats, canal £3 / rail £5+coal / double-rail £15+coal×2+brewery-beer, network adjacency (+first-link exception), Develop (iron cost, mat removal, pottery Canal lock), Sell (merchant connection, brewery→merchant beer sourcing, +1 merchant VP), Loan (£30, income −3, floor), Scout (3 discards → Wild Location + Wild Industry), era-end scoring (links 1/2 VP, flipped industries) with L1 cleanup, final scoring & tiebreak by income then money.

Known simplifications (do **not** claim full parity): link scoring is flat per link rather than per adjacent town/city; overbuilding is not implemented; coal/iron market purchase system absent (mines/works grant resources directly); merchant tile bonuses other than the sale bonus are not modelled; Scout discard total fixed at three cards.

## 7. Debug Mode

On the game page press **`` ` `` (backquote)** for the developer panel:

map audit (data vs rendered), session phase/era/round/current player, legal actions, reveal stats (torches/routes/global %), current music track, hand/context card counts.

Set `localStorage.kb.debug = '1'` to log blocked-interaction reasons to the console.

## 8. Demo / Fast Mode

There is no timer-based short game. For quick testing use PLAY WITH AI ×3 on EASY — the AI plays fast, but the structure (2 eras × N rounds) remains official.

## 9. Common Errors & Troubleshooting

| Symptom | Fix |
| --- | --- |
| Port 5173 already in use | kill the stray `node.exe` running vite or change `port` in `client/vite.config.ts` |
| Black screen on `/kinetic.html` | WebGL unavailable/disabled — try hardware acceleration on |
| No sound | browsers require a user gesture; click anywhere once, and check TABLE → MUSIC/SFX toggles |
| Join says “no such table” | tables live in this browser’s localStorage only; create one first (single-device prototype) |
| Cards feel locked | it is not your seat (AI thinking) or the opening sequence is still playing — wait for ROUND 1 banner |

## 10. Safe Modification Notes

- Gameplay: change **only** `state.ts`; keep resolvers authoritative and re-export any new query the UI needs.
- Visuals: derive everything from state (see how trays/mats/reveal do it). Never mutate state from animation code.
- Map edits: update `CITIES`/`LINKS` — positions are world units; `textures.ts` auto-redraws the parchment, mats/pawns follow anchors.
- After touching anything: `npm run typecheck -w client && npm run build -w client`.
