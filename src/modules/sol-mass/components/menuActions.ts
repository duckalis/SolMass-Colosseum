import type { AppNotifications, FeatureRegistry } from "@idosgames/module-sdk";
import { LEADERBOARD_ID } from "../leaderboard";

// What the buttons of the game's screens do beyond the game itself: open another system's screen —
// never importing it, through ctx.features.

export interface MenuActions {
  /** The global top of players (the catalog's `leaderboard` system, opened on this game's board). */
  openLeaderboard(): void;
}

export function createMenuActions(
  features: FeatureRegistry,
  notifications: AppNotifications,
): MenuActions {
  return {
    openLeaderboard() {
      // Refused while the title has no enabled leaderboard: the system hides its screen then.
      if (features.open("leaderboard", { leaderboardID: LEADERBOARD_ID })) return;
      notifications.toast({
        level: "info",
        message: "The leaderboard is not available yet",
        key: "sol-mass:menu",
        source: null,
      });
    },
  };
}
