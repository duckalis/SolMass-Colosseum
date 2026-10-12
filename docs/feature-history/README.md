# Feature history

One file per game system or feature: what was built, why, and the decisions the code alone does not
show. Not loaded automatically — open the entry you need before changing that system. A new system
gets a new file here plus ONE line below; an existing one gets its file updated. Never grow IDOS.md
instead.

<!-- One line per entry: - [Title](slug.md) — one-line gist -->

- [Leaderboard](leaderboard.md) — the `top_mass` board is title data (saved on DEV and live), client-submitted, named by the account's username
- [Release](release.md) — how a build gets onto the title (built here, uploaded; build with `VITE_IDOS_ENV=prod`), what is live, where players get $MASS
- [Web3](web3.md) — $MASS is the title's Main token; looks open by holding it, the tier is client-side; how a balance is read from a browser; what wallet sign-in needs from the title (set on both)
- [Online](online.md) — quick match on the engine's rooms, the arena runs on the host player's device and must survive it leaving; needs the title's Multiplayer section (set on both)
