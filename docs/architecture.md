# Architecture

## System Overview

SolMass is a browser game with no server of its own. It is one module (`src/modules/sol-mass/`) on the iDos Games host shell: the shell signs the player in and owns the session, the module draws the arena on a canvas and its own screens over it. Accounts, the leaderboard, player profiles and multiplayer rooms are services of the iDos Games title; $MASS balances are read straight from a Solana RPC node.

```
┌───────────────────────── Browser tab (React + Vite) ─────────────────────────┐
│  iDos Games host shell: sign-in, session, leaderboard screen                 │
│  ┌──────────────────────────── sol-mass module ───────────────────────────┐  │
│  │  components/   menu · HUD · Skins · Shop · Game Over         (React)   │  │
│  │  game/         world rules · bots · renderer             (Canvas 2D)   │  │
│  │  net/          quick match · binary protocol · host migration          │  │
│  │  web3/         token account address · balance read · hold tiers       │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└────────┬───────────────────────────┬──────────────────────────┬──────────────┘
         │ HTTPS                     │ WebRTC, peer to peer     │ JSON-RPC, read-only
         ▼                           ▼                          ▼
┌───────────────────┐      ┌───────────────────┐      ┌───────────────────────┐
│ iDos Games title  │      │ Other players     │      │ Solana mainnet RPC    │
│ accounts, profile │      │ one device hosts  │      │ getAccountInfo of the │
│ leaderboard       │      │ the arena, the    │      │ wallet's $MASS token  │
│ rooms, signaling  │      │ rest send cursors │      │ account               │
└───────────────────┘      └───────────────────┘      └───────────────────────┘
```

## Components

### Host shell (`src/main.tsx`, `src/app.config.ts`, `src/walletLogin.tsx`)
Creates the one iDos Games client, shows the sign-in screen and mounts the modules listed in `src/modules.ts`: `sol-mass` (the game) and `leaderboard` (the catalog's leaderboard screen). The app starts straight in the game's main menu.

### World (`game/world.ts`, `game/cells.ts`, `data/tuning.ts`)
The rules of the arena as plain functions over plain data: movement, eating food, absorbing cells, splitting and merging. They have no browser dependencies, so the same code steps an offline round, an online arena on the host's device, and could step one on a server. Every number that shapes the game — arena size, speed curve, split threshold, bot behaviour — is in `data/tuning.ts`.

### Bots (`game/bots.ts`)
A bot only chooses where to go; it moves and eats by the same rules as a player. Seeing a player's cell it hunts when it is the bigger one and runs when it is the smaller one, with a scatter that lets the player cut a runner off. Otherwise it goes for the nearest pellet or wanders.

### Renderer and input (`game/Arena.ts`, `game/render.ts`, `game/smooth.ts`)
One `<canvas>`: camera, zoom that follows the cell's size, arena themes, skin fills (solid, gradient, conic rainbow) and the RGB nickname. Mouse, touch and keyboard are read here.

### Online (`net/`)
- `matchmaking.ts` — "Play Online" finds the fullest open arena among the title's rooms or opens a new one.
- `OnlineGame.ts` — the room's host simulates the arena and sends its state 20 times a second; the others send their cursors. Every device keeps the whole arena, so when the host leaves or its tab dies another player takes over and the round goes on.
- `protocol.ts` — a compact binary protocol for spawn, input, split, roster, food and state messages.
- `ticker.ts` — a worker timer that keeps the host simulating while its tab is hidden.

### Web3 (`web3/`)
- `holdings.ts` — takes the wallet linked to the signed-in account (the link is signature-verified by the platform at sign-in) and turns its balance into a tier.
- `address.ts` — derives the wallet's associated token account of the $MASS mint: base58 and the program-derived-address rule in about a hundred lines, checked against `@solana/web3.js` on 400 random wallet and mint pairs.
- `balance.ts` — one read-only `getAccountInfo` call. With an RPC provider of its own (`VITE_SOLANA_RPC_URL`) it reads every token account of the wallet instead.
- `looks.ts` — saves the player's picks in their iDos Games profile. What is stored is the pick; what is worn is what the current tier allows.

The game has no code that builds, signs or sends a Solana transaction, and the platform's deposit / withdraw wallet panel is switched off (`IDOS_WEB3 = false` in `src/idos.title.ts`).

### Screens (`components/`)
Main menu, HUD, Skins, Shop, Connecting and Game Over, in React over the canvas.

## Hold tiers

| $MASS in the linked wallet | Unlocks |
|---|---|
| any | 8 solid-colour skins, the default arena |
| 500 or more | 6 gradient skins, 5 arena backgrounds |
| 1,000 or more | Rainbow skin, RGB nickname |

## Trust boundaries

| What | Decided by | Consequence |
|---|---|---|
| Who owns a wallet | iDos Games backend (signed message) | A player cannot claim somebody else's wallet |
| Hold tier | The player's device | A modified client can show itself any look; a look is worth nothing |
| Online arena state | The host player's device | The host could cheat; guests play with their ping to the host |
| Leaderboard score | The player's device | A modified client can post any number |

Moving the last three to a server is the first thing on the [roadmap](roadmap.md). More detail on each decision: [feature-history/](feature-history/).
