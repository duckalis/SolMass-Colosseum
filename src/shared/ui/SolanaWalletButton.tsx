import { useState, type CSSProperties, type ReactNode } from "react";
import {
  authErrorText,
  type IDosGamesClient,
  type PlayAccessStatus,
} from "@idosgames/core";
import { linkWalletSolana, loginWithWalletSolana } from "@idosgames/wallet";
import {
  isEmbeddedInPlatform,
  LazySolanaWalletLogin,
} from "@idosgames/wallet/react/lazy";

// "Sign in with wallet" / "Connect wallet" for Solana — shared by the sign-in screen (the host) and
// the Skins / Shop screens (the game's module).
//
// The SDK's own button (LazySolanaWalletLogin) connects through Reown AppKit, which cannot start
// without the title's WalletConnect project id. Until the title has one, this button talks to the
// wallet the browser already has — the Phantom / Solflare / Backpack extension, or the wallet
// app's built-in browser on a phone — which needs no project id at all. With a project id (QR codes,
// phone wallets from a desktop page), and inside the idosgames.com frame (where the site's own
// wallet signs for the game), the SDK's button takes over.
//
// Either way the wallet only SIGNS A MESSAGE that proves it is the player's: no transaction is
// sent and nothing can be moved.

/** What Phantom, Solflare and Backpack all put on the page. */
interface InjectedWallet {
  connect(): Promise<unknown>;
  publicKey?: { toString(): string } | null;
  signMessage(
    message: Uint8Array,
    display?: string,
  ): Promise<Uint8Array | { signature: Uint8Array }>;
}

function injectedWallet(): InjectedWallet | null {
  const page = window as unknown as {
    phantom?: { solana?: InjectedWallet };
    solflare?: InjectedWallet;
    backpack?: InjectedWallet;
    solana?: InjectedWallet;
  };
  return page.phantom?.solana ?? page.solflare ?? page.backpack ?? page.solana ?? null;
}

export interface SolanaWalletButtonProps {
  client: IDosGamesClient;
  /** Key of the title's Solana network. */
  networkID: string;
  /** "login" — sign in with the wallet; "link" — attach it to the account that is signed in. */
  mode?: "login" | "link";
  /** The title's WalletConnect / Reown project id, when it has one. */
  walletConnectProjectId?: string;
  onAuthenticated?: () => void;
  onLinked?: (playAccess: PlayAccessStatus | null) => void;
  label?: string;
  disabled?: boolean;
  style?: CSSProperties;
}

export function SolanaWalletButton(props: SolanaWalletButtonProps): ReactNode {
  const { walletConnectProjectId, mode = "login", label, disabled, style } = props;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (walletConnectProjectId || isEmbeddedInPlatform())
    return <LazySolanaWalletLogin {...props} appName="SolMass" />;

  const press = async (): Promise<void> => {
    const wallet = injectedWallet();
    if (!wallet) {
      setError(
        "No Solana wallet found in this browser. Install Phantom, Solflare or Backpack, or open the game in the wallet app's own browser.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const connected = (await wallet.connect()) as
        | { publicKey?: { toString(): string } | null }
        | undefined;
      const address = (connected?.publicKey ?? wallet.publicKey)?.toString();
      if (!address) throw new Error("The wallet did not share its address.");

      const request = {
        client: props.client,
        networkID: props.networkID,
        walletAddress: address,
        signMessage: async (message: Uint8Array): Promise<Uint8Array> => {
          const signed = await wallet.signMessage(message, "utf8");
          return signed instanceof Uint8Array ? signed : signed.signature;
        },
      };
      if (mode === "link") {
        const res = await linkWalletSolana(request);
        if (res.ok) props.onLinked?.(res.data.PlayAccess ?? null);
        else
          setError(
            res.stage === "sign"
              ? "Signature declined."
              : authErrorText(res.error, "Could not link the wallet."),
          );
      } else {
        const res = await loginWithWalletSolana(request);
        if (res.ok) props.onAuthenticated?.();
        else
          setError(
            res.stage === "sign"
              ? "Signature declined."
              : authErrorText(res.error, "Wallet sign-in failed."),
          );
      }
    } catch (cause) {
      // The player closed the wallet's window, or the wallet refused.
      setError(cause instanceof Error && cause.message ? cause.message : "The wallet did not connect.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void press()}
        disabled={disabled || busy}
        style={{ ...base, ...(disabled || busy ? { opacity: 0.6, cursor: "default" } : null), ...style }}
      >
        {busy
          ? "Check your wallet…"
          : (label ?? (mode === "link" ? "Link wallet" : "Sign in with wallet"))}
      </button>
      {error ? (
        <span role="alert" style={alert}>
          {error}
        </span>
      ) : null}
    </>
  );
}

const base: CSSProperties = {
  padding: "11px 16px",
  borderRadius: 8,
  border: "none",
  background: "#4c3fa8",
  color: "#ffffff",
  font: "inherit",
  fontWeight: 600,
  cursor: "pointer",
};

const alert: CSSProperties = {
  display: "block",
  marginTop: 6,
  fontSize: 13,
  lineHeight: 1.35,
  color: "#ff8f9f",
};
