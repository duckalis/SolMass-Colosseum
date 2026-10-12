import type { IDosGamesClient } from "@idosgames/core";
import type { AppNotifications } from "@idosgames/module-sdk";
import type { Look } from "../data/cosmetics";
import type { Session } from "../game/session";
import { joinArena } from "./matchmaking";
import { OnlineGame } from "./OnlineGame";

// Turns the session's "online" into an arena and back: when the player presses Play Online it
// finds (or opens) a room and puts an OnlineGame on it; when the player returns to the menu — or
// the arena ends — it leaves the room. The arena on screen asks `current()` what to play.

export interface OnlineController {
  /** The online arena the player is on right now; `null` — none (still connecting included). */
  current(): OnlineGame | null;
  dispose(): void;
}

export function createOnlineController(
  client: IDosGamesClient,
  session: Session,
  notifications: AppNotifications,
  look: () => Look,
): OnlineController {
  let game: OnlineGame | null = null;
  /** Bumped every time the player leaves online: a search still under way is then nobody's. */
  let attempt = 0;
  /** Rooms whose host this device could not reach — not worth joining again. */
  const unreachable = new Set<string>();

  const leave = (): void => {
    attempt++;
    game?.dispose();
    game = null;
  };

  const fail = (message: string): void => {
    notifications.toast({
      level: "error",
      message,
      key: "sol-mass:online",
      source: null,
    });
    session.toMenu();
  };

  const connect = async (): Promise<void> => {
    const mine = ++attempt;
    const found = await joinArena(client, unreachable).catch((error: unknown) => ({
      ok: false as const,
      error: error instanceof Error ? error.message : String(error),
    }));
    if (mine !== attempt) {
      // The player went back to the menu while the room was being found.
      if (found.ok) void found.session.leave();
      return;
    }
    if (!found.ok) {
      fail(`Online is not available: ${found.error}`);
      return;
    }
    const room = found.session.roomId;
    game = new OnlineGame(found.session, session, look, (reason, reached) => {
      if (!reached) unreachable.add(room);
      game = null;
      fail(reason);
    });
  };

  let online = session.get().online;
  const unsubscribe = session.subscribe(() => {
    const now = session.get().online;
    if (now === online) return;
    online = now;
    if (now) void connect();
    else leave();
  });

  return {
    current: () => game,
    dispose() {
      unsubscribe();
      leave();
    },
  };
}
