# Product

## What is SolMass?

SolMass is a competitive arena game in the browser, inspired by Agar.io. The player steers a cell, eats food and smaller cells to grow, splits to catch a runner, and is out when a bigger cell swallows them. The final mass of the round goes to a global leaderboard.

It is also an experiment in a token economy with no emission: the game's Solana token, $MASS, is never minted, earned or spent in the game. It is held.

## Target Users

- **Casual .io players** — the game is free, opens in a tab and needs no wallet to play
- **Solana holders** — a reason to hold a token that is visible to other players, with no staking contract and no lock-up
- **Web3 game builders** — a small, readable example of hold-gated content with a read-only balance check

## Core Value Propositions

1. **Zero inflation** — the game has no mint function and no rewards in tokens; the supply is fixed on-chain
2. **Hold-to-Play** — utility comes from keeping tokens in a wallet, not from spending them
3. **No pay-to-win** — everything a holder gets is cosmetic; a free player competes on equal terms
4. **One-minute onboarding** — a browser tab and one signed message; no transaction to play

## The Hold-to-Play Economy

| | Free | Hold 500 $MASS | Hold 1,000 $MASS |
|---|---|---|---|
| Skins | 8 solid colours | + 6 gradients (Sunset, Ocean, Aurora, Lava, Candy, Solana) | + Rainbow |
| Arena background | Default | + Black, White, Red, Yellow, Green | |
| Nickname | Plain | | Animated RGB, seen by every player on an online arena |
| Gameplay | Everything | Everything | Everything |

- The check is "does the linked wallet hold at least this much right now". Tokens stay in the player's wallet and under the player's keys.
- A locked item is dimmed, cannot be picked and says how much to hold: "Hold 500 $MASS to unlock".
- A pick is saved in the player's profile. If the tokens are sold the look locks; when they are back, the saved pick is worn again.

## The Token

| | |
|---|---|
| Name | SolMass ($MASS) |
| Network | Solana mainnet |
| Mint | `FJX66t2J9WyZNtSYPHJBRFcScytZLFa84h8yQzFiidos` |
| Supply | 1,000,000,000, 6 decimals |
| Mint authority | none (revoked) — the supply cannot grow |
| Freeze authority | none |
| Where to get it | The bonding curve on the game's [iDos Games page](https://idosgames.com/app/JNFMH60I/) |

These values were read from the chain on 2026-10-12; they can be checked at any time on [Solscan](https://solscan.io/token/FJX66t2J9WyZNtSYPHJBRFcScytZLFa84h8yQzFiidos).

## How It Differs from Play-to-Earn

| | Typical play-to-earn | SolMass |
|---|---|---|
| Token emission | Minted as rewards | None |
| Token utility | Spend to play or to progress | Hold to unlock looks |
| What the game asks of a wallet | Approvals and transactions | One signed message to sign in |
| Advantage for holders | Often stronger characters | Cosmetic only |
| Cost to start | Often an NFT or a deposit | Free |

## What It Is Not Yet

SolMass is a hackathon MVP that went live on 2026-10-12. It has no usage numbers to show, and the token launched the same day. The current limits of the build are listed in the [README](../README.md#status-and-limitations).
