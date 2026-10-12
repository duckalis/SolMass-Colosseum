import { useState, type CSSProperties, type ReactNode } from "react";
import {
  LazyWalletPanel,
  isEmbeddedInPlatform,
  isEmbeddedOnForeignSite,
  openPlatformWalletPanel,
  useWalletTopUp,
} from "@idosgames/wallet/react/lazy";
import { useIDosGamesClient } from "@idosgames/react";
import {
  Icon,
  makeT,
  outlined,
  Popup,
  useGameLayout,
  useUiKit,
  well,
} from "@idosgames/react/ui";

// The one string of the button; the rest of the lobby's strings live in the SDK.
const t = makeT<"wallet" | "topUp">(
  { wallet: "Wallet", topUp: "Top up" },
  { wallet: "Кошелёк", topUp: "Пополнение" },
);

// The lobby's wallet button (passed to `createBaseModule` in main.tsx as `WalletButton`). The base is in
// @idosgames/app-shell and knows nothing about the wallet stack, so the project owns this file.
//
// The app's one wallet entry (deposit / withdraw), next to the balances in the lobby header, on any
// web3 title — EVM or Solana, the panel is the same and picks the chain by itself.
//
// Where the game runs decides what the button does (owner, 2026-09-29):
//  - inside idosgames.com's frame — crypto goes through the SITE's wallet card only, so the button
//    asks the page to show it (`openPlatformWalletPanel`); the game never opens a wallet there;
//  - framed by somebody else's site — no button: there is no wallet of ours to show;
//  - by its own link (`{id}.idos.games`, a custom domain, the AI Coder preview) — the game's own
//    panel with its own wallet connection.
//
// Import is "@idosgames/wallet/react/lazy", NOT "@idosgames/wallet/react": the latter pulls Reown
// AppKit into the startup graph. The wallet config is memoised per project id, so a wallet connected
// on the sign-in screen is already connected here.

export function WalletButton(): ReactNode {
  const client = useIDosGamesClient();
  const kit = useUiKit();
  const layout = useGameLayout();
  const [open, setOpen] = useState(false);
  const embedded = isEmbeddedInPlatform();

  if (isEmbeddedOnForeignSite()) return null;

  return (
    <>
      <button
        type="button"
        className="idos-press"
        aria-label={t("wallet")}
        onClick={() => {
          kit.play("click");
          if (embedded) void openPlatformWalletPanel();
          else setOpen(true);
        }}
        style={chip}
        data-tutorial-anchor="lobby:wallet"
      >
        <Icon glyph="👛" size={layout === "phone" ? 26 : 22} />
        {layout !== "phone" ? <span>{t("wallet")}</span> : null}
      </button>
      {open && !embedded ? (
        <Popup title={t("wallet")} onClose={() => setOpen(false)} width={420}>
          <LazyWalletPanel client={client} appName="iDosGames" />
        </Popup>
      ) : null}
    </>
  );
}

const chip: CSSProperties = {
  ...outlined,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "3px 10px 3px 5px",
  borderRadius: 999,
  ...well,
  cursor: "pointer",
  whiteSpace: "nowrap",
  fontSize: 14,
};

// The top-up window (passed to `createBaseModule` as `WalletTopUp`; the base keeps it mounted over every
// mode). A purchase refused because the player is short on crypto opens the game's own wallet on the
// missing amount, and the purchase repeats by itself once the deposit is credited (owner, 2026-10-09).
// Inside idosgames.com's frame the SITE's window does this instead, and this renders nothing.
export function WalletTopUp(): ReactNode {
  const client = useIDosGamesClient();
  const request = useWalletTopUp(client);
  if (!request) return null;
  return (
    <Popup title={t("topUp")} onClose={() => request.onDone(false)} width={420}>
      {/* A new shortfall is a new panel: it picks its network for the currency once. */}
      <LazyWalletPanel
        key={`${request.currencyID}:${request.amount}`}
        client={client}
        appName="iDosGames"
        topUp={request}
      />
    </Popup>
  );
}
