# Web3 — wallet sign-in, $MASS holdings, Skins and Shop

What the code does not show:

- **What "$MASS" is.** The title's Main crypto currency ("SolMass") on Solana mainnet, mint
  `FJX66t2J9WyZNtSYPHJBRFcScytZLFa84h8yQzFiidos`, 6 decimals, supply 1,000,000,000. Only the live
  title's configuration carries it (the sandbox has no crypto currency), which is why
  `web3/token.ts` keeps the mint as a fallback.
- **Nothing is spent or minted.** Skins and Shop options open by HOLDING: 500 $MASS — six gradient
  skins and the arena's background colours; 1000 — the rainbow skin and the RGB nickname
  (`data/cosmetics.ts`). The game only reads a balance. The lobby's deposit/withdraw wallet panel is
  deliberately off (`IDOS_WEB3 = false` in `src/idos.title.ts`) for the same reason.
- **The tier is worked out on the player's device**, so a tampered client can show itself any look.
  Acceptable because a look is worth nothing; anything that is must not hang on this check. The
  engine's own, server-side balance check is `Blockchain.PlayAccess` token gates — but that is a
  gate on PLAYING at all, not a set of tiers.
- **Reading the balance from a browser is the hard part.** Solana's public node
  (api.mainnet-beta.solana.com) answers a web page with 403; the free PublicNode refuses the
  "indexed" queries (a wallet's list of token accounts) and serves only reads of a known account.
  So without an RPC provider of its own the game reads ONE account — the wallet's associated token
  account of the mint. Tokens kept in any other token account of the wallet read as 0. With
  `VITE_SOLANA_RPC_URL` set (the game's own provider) it asks for all of the wallet's accounts
  instead. Whatever the node is, its host must be in the title's `Blockchain.IframeConnectHosts`,
  or the game embedded on idosgames.com cannot reach it.
- **As of 2026-10-12 no player can pass a tier.** The token was created that day and its whole
  supply sits in one wallet (`FhVo3mqL8PW5pH5U2CN4XE33DokiyZnUwuGpH2hmHLuM`), in a token account
  that is NOT that wallet's associated one — through the free node even that wallet reads 0.
  Tokens sent to players land in their associated accounts and are read correctly.
- **Wallet sign-in needs the title's `Blockchain.WalletLogin.Enabled`**, and the balance read needs
  the node's host in `Blockchain.IframeConnectHosts`. Both titles have them since 2026-10-12
  (`WalletLogin.Enabled: true`, `IframeConnectHosts: ["solana-rpc.publicnode.com"]`): the sandbox
  `JNFMH60I-DEV` with the Solana network copied from the live title, the live `JNFMH60I` on the
  owner's approval — checked there by asking the server for a sign-in message, which it issues.
  Signing in with a wallet links it to the account (signature-verified), and that
  linked wallet is the one whose $MASS is read; an account made another way links one with
  "Connect wallet" on the Skins / Shop screens (guest accounts cannot link a wallet).
- **The SDK's Solana button cannot start without a WalletConnect (Reown) project id** — it answers
  "Wallet sign-in is not configured for this title." The title has none yet, so
  `src/shared/ui/SolanaWalletButton.tsx` talks to the wallet the browser already has (the Phantom /
  Solflare / Backpack extension, or the wallet app's own browser), which needs no id, and hands
  over to the SDK's button as soon as an id exists (`Blockchain.WalletLogin.WalletConnectProjectId`
  in the title, baked into `IDOS_WEB3_WALLETCONNECT_PROJECT_ID`; `VITE_WALLETCONNECT_PROJECT_ID`
  locally) or the game runs inside the idosgames.com frame. Without the id there is no QR code and
  no way to use a phone's wallet from a desktop page. Not tried with a real wallet extension: the
  tests put a stand-in on the page the way Phantom does and sign with a key of their own.
- **The token account's address is computed by the game's own code** (`web3/address.ts`: base58
  and the program-derived-address rule, ~100 lines) rather than by `@solana/web3.js`: the library is
  megabytes and wants a Node `Buffer` in the browser. It was checked against the library on 400
  random wallet × mint pairs and on the token's real accounts; re-check it that way if it is ever
  touched.
- **A player's picks live in their profile** — UserCustomData, Private bucket, key
  `sol_mass_look`. What is stored is the pick; what is worn is what the current tier allows
  (`allowedLook`), so a pick whose tokens were sold comes back by itself with the tokens.
- **On an online arena a look is the player's own word.** A skin travels as its index in `SKINS`
  (append only — never insert or reorder) with the RGB flag; the host has no way to see anybody's
  wallet. The arena's background is local: every player sees their own.
- **The default arena stayed dark.** The brief called white "standard"; the game's actual default
  is the navy one, kept as the free "Default", and white is one of the five colours for 500 $MASS.
- **`pretendHolding`** on the agent's debug surface exists only in development builds
  (`import.meta.env.DEV`): the one way to see the 500 and 1000 tiers without tokens.
