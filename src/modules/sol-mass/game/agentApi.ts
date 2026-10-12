import type { ModuleAgentApi } from "@idosgames/module-sdk";
import type { Look } from "../data/cosmetics";
import type { Holdings } from "../web3/holdings";
import type { Arena } from "./Arena";
import type { Session } from "./session";

// The module's debug surface: the game is one <canvas>, so where the cells are and how big they
// got is invisible from the DOM. The menu, the shop, the HUD and the game-over screen are ordinary
// React — an agent reads and presses them like a person; the actions here cover what has no
// button, or needs an argument: steering the cell.

const MAX_STEER_MS = 3000;

export function createArenaAgentApi(
  getArena: () => Arena | null,
  session: Session,
  holdings: Holdings,
  look: () => Look,
): ModuleAgentApi {
  const api: ModuleAgentApi = {
    state() {
      const arena = getArena();
      const { status, wallet, balance, tier, error } = holdings.get();
      return {
        ...(arena
          ? { mounted: true, ...arena.describe() }
          : { mounted: false, ...session.get() }),
        // What the player's wallet holds, and the look it allows them right now.
        holdings: { status, wallet, balance, tier, error },
        look: look(),
      };
    },
    actions: {
      play(args) {
        if (typeof args?.nickname === "string")
          session.setNickname(args.nickname);
        session.play();
      },
      playOnline(args) {
        if (typeof args?.nickname === "string")
          session.setNickname(args.nickname);
        session.playOnline();
      },
      async steer(args) {
        const arena = getArena();
        if (!arena) throw new Error("The arena is not mounted yet.");
        if (session.get().phase !== "playing")
          throw new Error("Nobody is playing — call play first.");
        const angle = Number(args?.angle);
        if (!Number.isFinite(angle))
          throw new Error("steer needs { angle: number } in degrees.");
        const ms = Number(args?.ms ?? 1000);
        if (!Number.isFinite(ms) || ms <= 0)
          throw new Error("steer: ms must be a positive number.");
        await arena.steer(angle, Math.min(ms, MAX_STEER_MS));
      },
      split() {
        getArena()?.split();
      },
      menu() {
        session.toMenu();
      },
    },
    describeActions: {
      play: "Start an offline round against bots, from the main menu — or play again from the game-over screen: { nickname?: string }.",
      playOnline:
        "From the main menu: join an online arena with other players (phase 'connecting', then 'playing'): { nickname?: string }.",
      steer:
        "Hold the cursor in a direction from the cell, then stop: { angle: degrees (0 right, 90 down), ms?: number (default 1000, max 3000) }.",
      split:
        "Split the cell in two toward the cursor (the Space key); nothing happens under the minimum mass.",
      menu: "Leave the round (and an online arena) and return to the main menu.",
    },
  };

  // Only in a development build: there is no other way to see the 500 and 1000 token tiers
  // without a wallet that holds the tokens. A built game has no such action.
  if (import.meta.env.DEV && api.actions && api.describeActions) {
    api.actions.pretendHolding = (args) => {
      const amount = args?.amount;
      holdings.pretend(typeof amount === "number" && amount >= 0 ? amount : null);
    };
    api.describeActions.pretendHolding =
      "Development builds only: act as if the wallet held { amount: number } $MASS; no amount — back to the real balance.";
  }
  return api;
}
