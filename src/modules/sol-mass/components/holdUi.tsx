import {
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { BlockchainDefinitions } from "@idosgames/core";
import { useIDosGamesClient } from "@idosgames/react";
import { SolanaWalletButton } from "../../../shared/ui/SolanaWalletButton";
import { TIER_MIN, TOKEN_SYMBOL, unlockText, type Tier } from "../data/cosmetics";
import type { Holdings } from "../web3/holdings";
import { MenuButton } from "./MenuButton";
import { backdrop, caption, card } from "./menuStyles";

// What the Skins and Shop screens share: the frame, the line about the player's wallet and its
// $MASS, and the look of an option the player does not hold enough tokens for.

interface Store<T> {
  get(): T;
  subscribe(listener: () => void): () => void;
}

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get);
}

/** A screen opened from the main menu: a title, the wallet line, the options, and the way back. */
export function ScreenFrame({
  title,
  holdings,
  onBack,
  children,
}: {
  title: string;
  holdings: Holdings;
  onBack: () => void;
  children: ReactNode;
}): ReactNode {
  return (
    <div style={backdrop}>
      <div style={{ ...card, maxWidth: 560, gap: 16 }}>
        <h1 style={heading}>{title}</h1>
        <HoldBar holdings={holdings} />
        {children}
        <MenuButton tone="white" onClick={onBack}>
          Back
        </MenuButton>
      </div>
    </div>
  );
}

/** "7xKX…9fGh holds 742 $MASS" — or the button that connects a wallet. */
function HoldBar({ holdings }: { holdings: Holdings }): ReactNode {
  const client = useIDosGamesClient();
  const state = useStore(holdings);
  const projectId =
    client.data.config.getSection<BlockchainDefinitions>("Blockchain")?.WalletLogin
      ?.WalletConnectProjectId ?? undefined;

  if (state.status === "no-wallet")
    return (
      <div style={bar}>
        <span>
          Connect a Solana wallet: skins and shop options open by how much {TOKEN_SYMBOL} it
          holds. Nothing is spent.
        </span>
        {/* Links the wallet to this account by a signed message — no transaction. */}
        <span style={{ flex: "none", maxWidth: "100%" }}>
          <SolanaWalletButton
            client={client}
            networkID={holdings.networkID}
            mode="link"
            label="Connect wallet"
            walletConnectProjectId={projectId}
            onLinked={() => void holdings.refresh(true)}
            style={barButton}
          />
        </span>
      </div>
    );

  const wallet = state.wallet ?? "";
  const short = wallet.length > 12 ? `${wallet.slice(0, 4)}…${wallet.slice(-4)}` : wallet;
  return (
    <div style={bar}>
      <span>
        {state.status === "checking" ? (
          <>Checking wallet {short}…</>
        ) : state.status === "failed" ? (
          <span style={{ color: "#ff8f9f" }}>
            Could not read wallet {short}: {state.error}
          </span>
        ) : (
          <>
            Wallet {short} holds{" "}
            <b style={{ color: "#14f195" }}>
              {formatTokens(state.balance)} {TOKEN_SYMBOL}
            </b>
          </>
        )}
      </span>
      <button
        type="button"
        style={barButton}
        disabled={state.status === "checking"}
        onClick={() => void holdings.refresh(true)}
      >
        {state.status === "failed" ? "Try again" : "Refresh"}
      </button>
    </div>
  );
}

function formatTokens(amount: number): string {
  return amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** A group of options with the hold it takes: "Gradients · Hold 500 $MASS". */
export function Section({
  title,
  tier,
  children,
}: {
  title: string;
  tier: Tier;
  children: ReactNode;
}): ReactNode {
  return (
    <section style={{ display: "grid", gap: 10 }}>
      <div style={caption}>
        {title.toUpperCase()}
        {tier > 0 ? ` · HOLD ${TIER_MIN[tier]} ${TOKEN_SYMBOL}` : " · FREE"}
      </div>
      {children}
    </section>
  );
}

/** The veil over an option the player's wallet does not hold enough for. */
export function LockedVeil({ tier }: { tier: Tier }): ReactNode {
  return <span style={veil}>{unlockText(tier)}</span>;
}

/** The frame of an option: a ring when it is the chosen one, dimmed and dead when locked. */
export function optionStyle(selected: boolean, locked: boolean): CSSProperties {
  return {
    position: "relative",
    display: "grid",
    justifyItems: "center",
    gap: 6,
    padding: 8,
    borderRadius: 14,
    border: `2px solid ${selected ? "#14f195" : "rgba(255, 255, 255, 0.12)"}`,
    background: selected ? "rgba(20, 241, 149, 0.1)" : "rgba(6, 8, 24, 0.45)",
    color: "#ffffff",
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 700,
    cursor: locked ? "not-allowed" : "pointer",
    overflow: "hidden",
  };
}

const heading: CSSProperties = {
  margin: 0,
  fontSize: 30,
  lineHeight: 1.1,
  fontWeight: 800,
  textAlign: "center",
  color: "#ffffff",
};

const bar: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 12,
  background: "rgba(6, 8, 24, 0.6)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  color: "rgba(255, 255, 255, 0.85)",
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1.35,
};

const barButton: CSSProperties = {
  flex: "none",
  padding: "8px 14px",
  borderRadius: 10,
  border: "none",
  background: "#9945ff",
  color: "#ffffff",
  fontFamily: "inherit",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
};

const veil: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeItems: "center",
  padding: 6,
  background: "rgba(6, 8, 24, 0.78)",
  color: "#ffffff",
  fontSize: 11,
  fontWeight: 800,
  lineHeight: 1.25,
  textAlign: "center",
};
