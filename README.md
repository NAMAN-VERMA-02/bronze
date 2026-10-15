# Bronze

A free, browser-based 3D strategy board game about building canals, railways and industry across the 1770s Midlands. Play against AI opponents on a Victorian workshop tabletop.

> Bronze is a free fan project, not affiliated with Roxley Games or Martin Wallace. It uses original code and assets only.

## Run

```bash
npm install
npm run client      # http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run typecheck` | TypeScript check for every workspace |
| `npm test` | Rules tests and 20 randomized full-game smoke games |
| `npm run build` | Production build into `client/dist/` |

See `HOW_TO_RUN.md` for the file map and known rule simplifications.

## License

MIT for the code. See `LICENSE`.
Requested by naman · project thread

Before: The README was a short intro with run commands only. It had no screenshots, no rules and no link to the live game.

After: The README opens with a "Play now" link to the live game and a screenshot of the table. It then covers how the game looks and plays (six real screenshots in docs/screens/), card controls, a short rules summary (goal, setup, actions, income, scoring) and run instructions.

How: The screenshots were taken from the built game with Playwright. The rules text was checked against shared/src/bronze/state.ts. No code changes.

