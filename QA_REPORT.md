# QA Test Report — Bronze Digital Platform

**Run date:** August 26, 2026 · **Build:** v0.1.0 (local workspace) · **Tester:** ox-alpha agent (QA persona, §5.1)
**Method:** Automated headless suites against the shared rules engine and the live Socket.IO server.
Browser-automation coverage (§4.2/§4.3.4 Playwright matrix) is out of scope for this run — no UI driver installed yet.

---

## 1. Coverage Summary

| Coverage Dimension | Total | Tested | Coverage |
|---|---|---|---|
| Rules validation cases (§4.1) | 22 | 22 | 100% |
| Multiplayer protocol cases (§4.3.2/§4.4) | 5 | 5 | 100% |
| Player actions exercised (of Build/Network/Sell/Develop/Loan/Pass) | 6 | 6 | 100% |
| Industry types verified | 6 | 6 | 100% |
| Player-count variants | 1 (2p) | 1 | 33% |
| Browser combinations | 12 | 0 | 0% |

---

## 2. Results

### 2.1 Rules Validation Suite — `shared/test/rules.test.ts` — **22/22 PASS**

| Domain | Cases | Result |
|---|---|---|
| 4.1.1 Turn sequence & action system | R01–R10 | 10/10 |
| 4.1.2 Era progression & scoring | E01–E04 | 4/4 |
| 4.1.3 Industry-specific rules | I01–I04 | 4/4 |
| 4.1.4 Market dynamics & selling | S01–S04 | 4/4 |

### 2.2 Multiplayer Protocol Suite — `server/test/net.test.ts` — **5/5 PASS**

N01 rapid duplicate burst (zero double-processing) · N02 out-of-turn rejection · N03 spectator redaction · N04 malformed action handling · N05 lobby constraints.

### 2.3 Performance Benchmarks — `server/test/perf.ts`

| Metric | Measured | Target (Table 4) | Verdict |
|---|---|---|---|
| Engine throughput | 17.8 games/s (~1,400 actions/s) | — | ample |
| `applyAction` latency | p50 0.59 ms / p95 1.16 ms | < 500 ms | **846× headroom** |
| Server action round-trip (emit → broadcast) | p50 10.7 ms / p95 27.4 ms | < 500 ms | **46× headroom** |

### 2.4 Regression Suites (unchanged-green after fixes)

Smoke (20 randomized full games, scoring-consistent) · E2E lifecycle · Reconnect/seat-reclaim · Restart-survival persistence · Client production build.

---

## 3. Defects Found & Resolved

### DEF-001 — Malformed action consumes an action slot
- **Severity:** High (§6.2)
- **Steps to reproduce:** send `{type:'TELEPORT_TO_VICTORY'}` as a game action during your turn
- **Expected:** rejection with error; no state change
- **Actual (pre-fix):** unknown types fell through the engine's switch and decremented `actionsLeft` — a garbage packet could burn a turn or force an early end-of-turn
- **Fix:** exhaustive `switch` with `default:` throwing `Unknown action` before any mutation (`shared/src/engine/logic.ts`)
- **Regression case:** R10 + N04

### DEF-002 — Spectators receive unredacted state (information leak)
- **Severity:** High
- **Steps to reproduce:** join a started room under a fresh name; inspect the emitted state
- **Expected:** spectator view hides all hands (dev brief Ch. II: "spectators see the public board state but never opponent hands")
- **Actual (pre-fix):** spectators received the complete raw state including every player's hand of 8 cards
- **Fix:** `viewFor()` now strips all hands for non-seated sockets (`server/src/index.ts`)
- **Regression case:** N03

### DEF-003 — Cotton sale did not raise income on small values
- **Severity:** Medium (rule inconsistency, §4.1.4)
- **Steps to reproduce:** sell a level-1 cotton mill (£5 income value)
- **Expected:** income marker advances £5
- **Actual (pre-fix):** income track used irregular £10 steps (`[-10,-5,0,10,20,30]`), so a £5 gain snapped back to the same space
- **Fix:** income track regrained to £5 steps `[-10..30]` (9 spaces), start index corrected to the £10 position, loan now moves the marker down two £10 levels (−£20), income gains floor-snap to the track (`tiles.ts`, `setup.ts`, `logic.ts`)
- **Regression case:** S03, R08

### OBS-001 (test-harness finding, not a product defect)
Seat order is shuffled at start; early protocol tests assumed player 0 acts first and hung when the assumption failed. Tests rewritten to derive the active socket from `order[currentTurnIdx]`.

---

## 4. Known Gaps / Recommendations

1. **Browser/UI coverage is 0%** — next milestone should add the Playwright layer (§5.2) for lobby→game flows across Chromium/Firefox/WebKit and the four viewports (§4.2.3).
2. **Player-count variants** — suites currently exercise 2p only; extend random-game soak to 3p/4p.
3. **Extended-session stability** (Table 5, 2–4 h soak with heap sampling) not yet automated; engine determinism makes a server-side soak straightforward to add.
4. **Rule-fidelity backlog** vs official rulebook: rail-era iron-market restock approximation, pottery merchant bonus VP simplification, canal-era income secrecy (turn order currently uses spend, matching Birmingham's rule).
