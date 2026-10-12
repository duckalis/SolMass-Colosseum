# Release — putting a build on the title

What the code does not show:

- **The game is built here and uploaded**, not built by the platform: `begin_build_upload` (backend
  MCP) gives a build id, an upload URL and an asset base; `vite build --base=<asset base>`; zip the
  CONTENTS of `dist/` (index.html at the zip's root); `curl -T build.zip "<upload url>"`;
  `finish_build_upload` — first without `deploy` (the answer has a `TestUrl` on the sandbox
  address to try the uploaded files), then with `deploy: true`.
- **`npm run dev` talks to the sandbox because of the committed `.env.development`.** The baked
  default (`IDOS_DEFAULT_ENV` in `src/idos.title.ts`) is `prod`, and the dev server offers guest
  sign-in — without that file anyone who cloned the repository and ran it would create guest
  accounts on the live title. Vite reads it in development mode only, never for a build.
- **Build with `VITE_IDOS_ENV=prod` in the environment** on a machine whose `.env.local` says
  `dev`: Vite reads that file for a production build too. On the platform's own addresses the
  address decides (`{id}.idos.games` is live, `{id}-dev.idos.games` the sandbox), but anywhere else
  a build baked with `dev` would talk to the sandbox. A variable set in the shell wins over the file.
- **Version 1 has been live since 2026-10-12** at https://jnfmh60i.idos.games/ and on
  https://idosgames.com/app/JNFMH60I/ (the game opens there in a frame after "PLAY NOW"). The
  uploaded files were walked through on the test address — wallet sign-in, a round, Play Online,
  the leaderboard; on the live address only the sign-in screen was looked at, so as not to leave
  test accounts on the live title.
- **A production build has no guest sign-in and no `pretendHolding`** — both exist only under
  `npm run dev`.
- **Where players get $MASS.** The title's page on idosgames.com sells it from a bonding curve
  (Buy / Sell next to the game). That is, presumably, why the whole supply sat in one wallet's
  non-standard token account on the day the token was made: it is the curve's reserve, not a
  player. Tokens bought there go to the buyer's wallet, where the game reads them.
