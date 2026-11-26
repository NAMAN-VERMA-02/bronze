<div align="center">

# BRONZE: The Aurel Valley

**Mine it. Smelt it. Forge it. Rule the valley.**

A free 3D strategy game for 1–4 lords. Play against AI, with friends on one
screen, or online, all in the browser.

### [▶ Play now](https://naman-verma-02.github.io/bronze/)

</div>

---

You sit on a throne at the edge of a dark, lantern-lit valley. You raise mines
on copper, tin and coal, smelt bronze, and (from Age II) forge arms. You claim
the river and the roads, and you race rival lords to fill the valley's
contracts, while a market prices every good from what everyone just did.

## What makes it play differently

- **A time track, not turns.** Every action costs time, and whoever is furthest
  behind acts next. Cheap moves can let you act twice before a rival acts once.
- **A shared economy.** If you need copper and a rival owns the nearest mine,
  you buy from that mine and the rival gets paid. Goods that cross a rival's
  river or road pay that rival a toll.
- **Live prices.** Every sale lowers a price one step, and every purchase
  raises it. Market ticks at 6, 12 and 18 pull prices back toward normal,
  reveal an event, and age the contracts: each waiting contract pays 2 marks
  more, and the oldest one is lost.
- **Three Ages:** Rivers, Roads and Crowns. Roads and forges open in Age II,
  and level III buildings open in Age III.
- **Several paths to win:** route networks, industry, trading or contracts,
  plus 3 random Patron goals each game.

Full rules and design notes: [docs/DESIGN.md](docs/DESIGN.md).

## Play modes

| Mode | How |
|---|---|
| vs AI | 1–3 rivals, 3 difficulties, 4 personalities (baron, industrialist, trader, balanced) |
| Same screen | 2–4 lords pass the mouse; the camera swings to each lord's throne |
| Online | The host shares a 5-letter code. Play is peer-to-peer over WebRTC (PeerJS), with the rules engine running in the host's browser. No server of our own. |

Solo and same-screen games autosave. Choose **Continue campaign** to resume.

## Controls

| Input | Does |
|---|---|
| `1`–`7` or the action bar | Build, Route, Run, Deliver, Trade, Bond, Wait |
| Click a glowing plot, link, building or town | Choose the target. Hovering shows the exact cost and gain first. |
| `V` | Switch between the throne view and the war map |
| `Esc` | Cancel |
| Drag / scroll | Look around / zoom |

## Balance (AI vs AI)

`npm run balance 24` plays 24 four-player games, one AI personality per seat,
rotating seats between games. On the current rules:

| | |
|---|---|
| Wins by personality | balanced 6, baron 9, industrialist 4, trader 5 |
| Average winning margin | 3.0 glory |
| Average actions per game | 147 |

These numbers come from AI self-play only, not from human games. The sample
is small (24 games), and the second seat won less often (2 of 24). I'm still
looking into whether that is a real seat effect.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # rules tests
npm run balance    # AI-vs-AI report
npm run build      # production build in client/dist
```

## Code map

| Path | What |
|---|---|
| `shared/src/valley/data.ts` | Map, buildings, prices, contracts, events: every tunable number |
| `shared/src/valley/engine.ts` | Pure, deterministic rules engine: `apply(state, player, action)` |
| `shared/src/valley/ai.ts` | AI rivals: values a position, scores every legal action |
| `client/src/valley/scene.ts` | Three.js war table, lantern lighting, keeps, workers and effects |
| `client/src/valley/main.ts` | Menus, HUD, turn flow and input |
| `client/src/valley/net.ts` | Online play over PeerJS |
| `client/src/valley/music.ts` | Generated harp, flute and drum score (Web Audio) |

## Credits

Original game design, code and art by Naman Verma. Fonts: Cinzel and
Cormorant Garamond (SIL Open Font License), served by Google Fonts.
