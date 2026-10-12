import type { IDosGamesClient } from "@idosgames/core";
import { tierForBalance, type Tier } from "../data/cosmetics";
import { fetchTokenBalance } from "./balance";
import { massToken, SOLANA_RPC_INDEXED, SOLANA_RPC_URL } from "./token";

// How much $MASS the player holds, and so which tier of skins and shop options is open to them.
// The wallet is the one linked to the account on the title's Solana network (signing in with a
// wallet links it; another account links one from the Skins / Shop screens); its balance is read
// straight from the chain, never from the game.
//
// The tier is worked out on the player's device: it opens looks, nothing that is worth money. A
// reward that is must be checked by the server (the title's Blockchain.PlayAccess token gates).

const RETRY_AFTER_MS = [1200, 3000];

export interface HoldingsState {
  /**
   * no-wallet — the account has no Solana wallet linked; checking — the chain is being asked;
   * ready — `balance` is what the wallet holds; failed — the chain could not be read (`error`), and
   * `balance` is what it was before.
   */
  status: "no-wallet" | "checking" | "ready" | "failed";
  wallet: string | null;
  balance: number;
  tier: Tier;
  error: string | null;
}

export interface Holdings {
  /** Key of the title's Solana network — what "Connect wallet" links a wallet on. */
  readonly networkID: string;
  get(): HoldingsState;
  subscribe(listener: () => void): () => void;
  /**
   * Looks at the wallet again. `reload` — first ask the server which wallet is linked (after the
   * player has just linked one).
   */
  refresh(reload?: boolean): Promise<void>;
  /** Development only: act as if the wallet held this much; `null` — back to the real balance. */
  pretend(balance: number | null): void;
}

export function createHoldings(client: IDosGamesClient): Holdings {
  const token = massToken(client);
  let state: HoldingsState = {
    status: "no-wallet",
    wallet: null,
    balance: 0,
    tier: 0,
    error: null,
  };
  let pretended: number | null = null;
  /** Bumped by every refresh: an answer that arrives after a newer question is dropped. */
  let asked = 0;
  const listeners = new Set<() => void>();

  const update = (patch: Partial<HoldingsState>): void => {
    state = { ...state, ...patch };
    for (const listener of [...listeners]) listener();
  };

  const linkedWallet = (): string | null =>
    client.data.user.state?.Blockchain?.LinkedWallets?.[token.networkID]?.Address ?? null;

  const refresh = async (reload = false): Promise<void> => {
    const mine = ++asked;
    if (reload) await client.blockchain.getUserState();
    if (mine !== asked) return;

    if (pretended !== null) {
      update({
        status: "ready",
        wallet: linkedWallet() ?? "pretended",
        balance: pretended,
        tier: tierForBalance(pretended),
        error: null,
      });
      return;
    }
    const wallet = linkedWallet();
    if (!wallet) {
      update({ status: "no-wallet", wallet: null, balance: 0, tier: 0, error: null });
      return;
    }
    update({ status: "checking", wallet, error: null });
    // A public node drops a request now and then; a second and a third try usually get through.
    for (let attempt = 0; ; attempt++) {
      try {
        const balance = await fetchTokenBalance(
          SOLANA_RPC_URL,
          wallet,
          token.mint,
          SOLANA_RPC_INDEXED,
        );
        if (mine !== asked) return;
        update({ status: "ready", balance, tier: tierForBalance(balance) });
        return;
      } catch (error) {
        if (mine !== asked) return;
        if (attempt < RETRY_AFTER_MS.length) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_AFTER_MS[attempt]));
          if (mine !== asked) return;
          continue;
        }
        // A node that did not answer is not an empty wallet: what was open stays open.
        update({
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
        return;
      }
    }
  };

  return {
    networkID: token.networkID,
    get: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh,
    pretend(balance) {
      pretended = balance;
      void refresh();
    },
  };
}
