// ПЕРВЫЙ импорт сознательно: зонд превью (из SDK, отдельная точка входа) ставит перехват console/ошибок
// при загрузке своего модуля, и всё, что упадёт ниже по старту (включая config.ts на нераспознанном
// тайтле), уже попадёт в его лог — а значит доедет до AI-кодера. Вне превью не делает ничего.
import { installPreviewProbe } from "@idosgames/app-shell/preview-probe";
// Second on purpose, before any other SDK import: it pins the interface language (see the file).
import "./language";
import { createIDosGamesClient } from "@idosgames/core";
import {
  DefaultLoginScreen,
  DefaultPlayAccessScreen,
  createBaseModule,
  mountHost,
} from "@idosgames/app-shell";
import appConfig from "./app.config";
import { modules } from "./modules";
import { TITLE_ID, BUILD_KEY } from "./config";
import { ENV_GOOGLE_CLIENT_ID, IS_DEV } from "./env";
import { IDOS_WEB3, IDOS_WEB3_NETWORK_ID } from "./idos.title";
import { renderWalletLink, renderWalletLogin } from "./walletLogin";
import { WalletButton, WalletTopUp } from "./walletButton";
import ui from "./ui.config";

// Тайтл зонду — отдельным вызовом: сам он встал раньше, чем config.ts успел его разрешить.
installPreviewProbe({ titleId: TITLE_ID });

const app = document.getElementById("app");
if (!app) throw new Error("#app container not found");

// Always runs against the real backend (https://api.idosgames.com) via the global fetch.
const client = createIDosGamesClient({
  titleID: TITLE_ID,
  buildKey: BUILD_KEY.length > 0 ? BUILD_KEY : undefined,
  throttleMs: 0,
});

client.on("error:global", (message) => {
  console.error("[idos] global error:", message);
});
client.on("error:connection", (message) => {
  console.error("[idos] connection error:", message);
});

if (IS_DEV) {
  (
    globalThis as typeof globalThis & { idosClient?: typeof client }
  ).idosClient = client;
}

// The host owns sign-in: mountHost replays the previous session (autoLogin) and, when there is
// none, renders the login screen. Do NOT log in here — that would skip the screen, and with it the
// player's ability to pick a provider or switch accounts.
//
// The app = the base (sign-in and the lobby, both from @idosgames/app-shell) + the modules of
// ./modules.ts (the shop, heroes, leaderboards… and the games). The base goes first; what happens
// after sign-in and the order of the lobby's tabs is ./app.config.ts, the look is ./ui.config.ts.
//
// The wallet stack is the project's (the base knows nothing about it): the lobby's wallet button is
// ./walletButton (with the top-up window for a purchase short on crypto), sign-in / "link wallet"
// buttons are ./walletLogin.
mountHost({
  container: app,
  client,
  modules: [
    createBaseModule(appConfig, {
      web3: IDOS_WEB3,
      networkID: IDOS_WEB3_NETWORK_ID,
      WalletButton,
      WalletTopUp,
    }),
    ...modules,
  ],
  // The ready-made sign-in: wallet, iDos Games, Google, Apple, Telegram, e-mail, and the title's login
  // mode. "Play as guest" is off until `auth.guest` in ./app.config.ts turns it on; a Google client
  // id for local development is VITE_IDOS_GOOGLE_CLIENT_ID (a published game shows Google only when
  // the publisher set up the title's own Google sign-in). A game that needs another layout renders
  // its own screen here and keeps calling client.auth.login*() and props.onAuthenticated().
  renderLogin: (props) => (
    <DefaultLoginScreen
      {...props}
      renderWalletLogin={renderWalletLogin}
      allowGuest={appConfig.auth.guest}
      googleClientId={ENV_GOOGLE_CLIENT_ID}
    />
  ),
  // Shown instead of the app when the title's login mode requires a token balance the player has
  // not confirmed yet: it lists the requirements, the linked wallets, "Link wallet" and "Check".
  renderPlayAccess: (props) => (
    <DefaultPlayAccessScreen {...props} renderLinkWallet={renderWalletLink} />
  ),
  // Look, animations and sounds of every module's interface — edit ./ui.config.ts, not the modules.
  ui,
});
