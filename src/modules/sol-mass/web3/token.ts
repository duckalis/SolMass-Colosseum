import type { BlockchainDefinitions, IDosGamesClient } from "@idosgames/core";

// Which token "$MASS" is. It is the title's Main crypto currency ("SolMass") on its Solana network;
// both come from the title's configuration. The sandbox copy of the title carries no crypto
// currency, so the live title's values stand in for it there — the token is the same one.

const FALLBACK_NETWORK = "solana";
const FALLBACK_MINT = "FJX66t2J9WyZNtSYPHJBRFcScytZLFa84h8yQzFiidos";

/**
 * Where balances are read. It has to be a node that answers a BROWSER: Solana's own
 * api.mainnet-beta.solana.com refuses web pages outright (403). This free one serves plain account
 * reads, which is all the game asks for; a busy game sets VITE_SOLANA_RPC_URL to its own provider.
 * Embedded on idosgames.com the game may call only hosts listed in the title's
 * Blockchain.IframeConnectHosts: keep the two in step.
 */
const OWN_RPC_URL = import.meta.env.VITE_SOLANA_RPC_URL as string | undefined;

export const SOLANA_RPC_URL: string = OWN_RPC_URL ?? "https://solana-rpc.publicnode.com";

/**
 * Whether the node answers "indexed" queries (every token account of a wallet). The free one does
 * not — the game's own provider is assumed to — and the balance is then read from the wallet's
 * standard token account only (see balance.ts).
 */
export const SOLANA_RPC_INDEXED: boolean = Boolean(OWN_RPC_URL);

interface CurrencySection {
  CryptoCurrencies?: Record<
    string,
    {
      Networks?: Array<{
        NetworkID?: string | null;
        ContractAddress?: string | null;
      }> | null;
    } | null
  > | null;
}

export interface MassToken {
  /** Key of the title's Solana network — what a wallet is linked on. */
  networkID: string;
  /** The token's mint address. */
  mint: string;
}

export function massToken(client: IDosGamesClient): MassToken {
  const networks =
    client.data.config.getSection<BlockchainDefinitions>("Blockchain")?.Networks ?? {};
  const networkID =
    Object.entries(networks).find(([, network]) => network?.Type === "Solana")?.[0] ??
    FALLBACK_NETWORK;
  const mint = client.data.config
    .getSection<CurrencySection>("Currency")
    ?.CryptoCurrencies?.Main?.Networks?.find(
      (binding) => binding.NetworkID === networkID,
    )?.ContractAddress;
  return { networkID, mint: mint || FALLBACK_MINT };
}
