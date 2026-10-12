import type { EngineScene, SceneMountContext } from "@idosgames/module-sdk";
import type { Look } from "../data/cosmetics";
import { Arena } from "./Arena";
import type { Game } from "./Game";
import type { Session } from "./session";

// Wraps the arena as a host-driven EngineScene: created on mount (it appends its own <canvas> to the
// host element), paused and resumed by the Mode Router via activate/suspend. `getArena` is for the
// agent's debug surface and the HUD, both set up in setup() before the arena exists; `online` is
// the online arena the player is on, when there is one.
export function createArenaScene(
  session: Session,
  online: () => Game | null,
  look: () => Look,
): {
  scene: EngineScene;
  getArena: () => Arena | null;
} {
  let arena: Arena | null = null;
  const scene: EngineScene = {
    surface: "fullbleed-canvas",
    mount(ctx: SceneMountContext): void {
      arena = new Arena(ctx.host, session, online, look);
    },
    activate(): void {
      arena?.setRunning(true);
    },
    suspend(): void {
      arena?.setRunning(false);
      // The player went to the lobby: an online arena is not something to keep a place on unseen.
      if (session.get().online) session.toMenu();
    },
    capture(): Promise<Blob | null> {
      return arena?.capture() ?? Promise.resolve(null);
    },
    destroy(): void {
      arena?.destroy();
      arena = null;
    },
  };
  return { scene, getArena: () => arena };
}
