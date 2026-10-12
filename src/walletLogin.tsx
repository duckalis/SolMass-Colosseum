import type { RenderLinkWallet, RenderWalletLogin } from "@idosgames/app-shell";
import { ENV_WALLETCONNECT_PROJECT_ID } from "./env";
import {
  IDOS_WEB3_NETWORK_ID,
  IDOS_WEB3_WALLETCONNECT_PROJECT_ID,
} from "./idos.title";
import { SolanaWalletButton } from "./shared/ui/SolanaWalletButton";

// Wallet sign-in seam — "Sign in with wallet" on the sign-in screen. SolMass is a Solana game: the
// message the wallet signs is issued for the title's Solana network (IDOS_WEB3_NETWORK_ID). Signing
// in proves the wallet is the player's — it sends no transaction and moves no tokens.
//
// The title must have that network and `Blockchain.WalletLogin.Enabled` in its configuration, or
// the server's refusal shows under the button — fix it there (backend MCP: get_blockchain /
// save_blockchain), not by hiding the button.
//
// The button itself is ./shared/ui/SolanaWalletButton: the wallet the browser already has (an
// extension, or the wallet app's own browser) while the title has no WalletConnect project id, the
// SDK's Reown AppKit button — QR codes, phone wallets — once it does. The id comes from the title's
// blockchain config (IDOS_WEB3_WALLETCONNECT_PROJECT_ID, baked by the platform);
// VITE_WALLETCONNECT_PROJECT_ID in .env.local is a local-dev fallback.

const NETWORK_ID = IDOS_WEB3_NETWORK_ID || "solana";
const WALLETCONNECT_PROJECT_ID =
  IDOS_WEB3_WALLETCONNECT_PROJECT_ID || ENV_WALLETCONNECT_PROJECT_ID || undefined;

export const renderWalletLogin: RenderWalletLogin = ({
  client,
  onAuthenticated,
  disabled,
  style,
}) => (
  <SolanaWalletButton
    client={client}
    networkID={NETWORK_ID}
    onAuthenticated={onAuthenticated}
    disabled={disabled}
    style={style}
    walletConnectProjectId={WALLETCONNECT_PROJECT_ID}
  />
);

// "Link wallet" on the play-access screen (mounted in ./main.tsx) — the same button in link mode. When
// the title's login mode requires a token balance, a player who signed in another way attaches a
// wallet to the account by signature, and the server checks the balance against exactly that
// wallet. `networkID` is the network a requirement needs; the title's own network otherwise.
export const renderWalletLink: RenderLinkWallet = ({
  client,
  networkID,
  onLinked,
  disabled,
  style,
}) => (
  <SolanaWalletButton
    mode="link"
    client={client}
    networkID={networkID || NETWORK_ID}
    onLinked={onLinked}
    disabled={disabled}
    style={style}
    walletConnectProjectId={WALLETCONNECT_PROJECT_ID}
  />
);
