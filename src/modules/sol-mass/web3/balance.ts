// Reads how many tokens of one mint a Solana wallet holds. READ-ONLY by construction: plain
// queries to a node — no wallet connection, no signature, no transaction, nothing that could move
// or mint a token.
//
// Two ways, by what the node allows:
//  - `indexed` — "every token account of this wallet for this mint", summed. The complete answer,
//    but free public nodes refuse this query to a browser; it takes the game's own RPC provider.
//  - otherwise — one read of a known account: the wallet's ASSOCIATED token account of the mint,
//    whose address is worked out, not searched for. It is where every wallet and exchange keeps a
//    token by default, so for a player it is the whole balance; tokens parked in some other,
//    hand-made token account of the same wallet are not counted.

import { associatedTokenAddress } from "./address";

interface TokenAccount {
  /** The program the account belongs to. */
  owner?: string;
  data?: {
    parsed?: {
      info?: {
        mint?: string;
        owner?: string;
        tokenAmount?: { uiAmount?: number | null };
      };
    };
  };
}

async function ask<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`Solana RPC answered ${response.status}`);
  const body = (await response.json()) as {
    error?: { message?: string } | null;
    result?: { value?: T } | null;
  };
  if (body.error) throw new Error(body.error.message ?? "Solana RPC error");
  return (body.result?.value ?? null) as T;
}

const READ = { encoding: "jsonParsed", commitment: "confirmed" };

/** Which token program a mint belongs to (the classic one or Token-2022) — it never changes. */
const programOfMint = new Map<string, string>();

/** Whole tokens (already divided by the mint's decimals) the wallet holds. */
export async function fetchTokenBalance(
  rpcUrl: string,
  owner: string,
  mint: string,
  indexed = false,
): Promise<number> {
  if (indexed) {
    const accounts = await ask<Array<{ account?: TokenAccount }> | null>(
      rpcUrl,
      "getTokenAccountsByOwner",
      [owner, { mint }, READ],
    );
    let total = 0;
    for (const entry of accounts ?? [])
      total += Number(entry.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0);
    return total;
  }

  let tokenProgram = programOfMint.get(mint);
  if (!tokenProgram) {
    tokenProgram = (await ask<TokenAccount | null>(rpcUrl, "getAccountInfo", [mint, READ]))
      ?.owner;
    if (!tokenProgram) throw new Error("The token's mint was not found on the chain");
    programOfMint.set(mint, tokenProgram);
  }

  const account = await associatedTokenAddress(owner, tokenProgram, mint);
  const info = (
    await ask<TokenAccount | null>(rpcUrl, "getAccountInfo", [account, READ])
  )?.data?.parsed?.info;
  // No such account: the wallet has never held the token.
  if (!info || info.mint !== mint || info.owner !== owner) return 0;
  return Number(info.tokenAmount?.uiAmount ?? 0);
}
