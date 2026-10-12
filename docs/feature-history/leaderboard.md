# Leaderboard — the global top of final masses

What the code does not show:

- **The board is title data, not code.** `Leaderboard.Definitions.top_mass`: `ScoreAggregation`
  `BestScore`, `Schedule` Cyclic with `Reset: Never` (one all-time table), `BracketSize: 0` — the
  engine's default of 50 would split players into brackets, and the top would stop being global —
  `TopUsersLimit: 100`. The id is `LEADERBOARD_ID` in `src/modules/sol-mass/leaderboard.ts`.
- **Where it exists.** Saved on both the sandbox title `JNFMH60I-DEV` and the live title `JNFMH60I`
  on 2026-10-12 (the same definition). On a title without it, Game Over shows no record line and
  the Leaderboard button answers "not available yet".
- **The score is sent by the client** (`client.leaderboard.submitScore`), so anyone can post any
  number. The owner decided on 2026-10-12 that this does not matter for now. If it comes back, the
  route that was tried on the sandbox and works (then reverted):
  - the engine has no "submit a score" call for scripts, and granting leaderboard event tokens from
    CloudCode moves only the milestone track, not the ranked score;
  - what does move it: a board with `ScoreAggregation: "Sum"` and
    `ScoreSources: [{ SourceType: "CurrencyEarned", Params: { CurrencyID }, BaseWeight: 1,
    ScaleWithRollMultiplier: true }]` on a `Status: "Hidden"` virtual currency, plus a CloudCode
    handler that grants that currency with
    `server.ApplyResourceOperation({ Reason, Operation: { Grant: { Standard: { Entries: [...] } } } })`
    (needs `CloudCode.ResourcePolicy.Enabled`). Such a board refuses a client's own `submitScore`
    ("scored by the server only"). A Sum board holds a best score if the handler grants only the
    improvement over the best it keeps in the player's `ReadOnly` custom data;
  - the mass is still reported by the client: a handler can only bound it (a round token issued at
    the start, the server's clock, a ceiling on mass per second).
- **Rows cannot be deleted.** Nothing reachable through the title config removes entries: changing
  the reset mode does not start a new cycle for a board created with `Reset: Never`, and removing
  the definition and adding it back brings the same rows back. A clean table means a new
  `LeaderboardID`. The sandbox table holds test rows; the live one has never been written to.
- **The name in the table is the account's username.** The menu's NICKNAME is written to it when a
  round starts (the server takes 3–24 characters; a shorter one stays local), i.e. before the score
  of that round is submitted — keep that order, the table snapshots the name at submit time.
