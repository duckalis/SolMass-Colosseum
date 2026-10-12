import type { Look } from "../data/cosmetics";
import { totalMass, type Player, type Point, type World } from "./cells";
import type { Game } from "./Game";
import type { Session } from "./session";
import {
  addPlayer,
  createWorld,
  removePlayer,
  resetBots,
  spawnPlayer,
  splitPlayer,
  stepWorld,
} from "./world";

// An offline round against bots — and the living backdrop of the main menu between rounds, where
// the bots go on wandering with nobody to hunt.

const SELF_ID = "me";

export class OfflineGame implements Game {
  readonly world: World = createWorld();
  readonly selfId = SELF_ID;
  readonly smoothing = Infinity;
  /** The player of the round that is on; `null` between rounds. */
  private me: Player | null = null;

  /** `look` — how the player looks right now (what their tier allows of their picks). */
  constructor(
    private readonly session: Session,
    private readonly look: () => Look,
  ) {
    resetBots(this.world);
  }

  update(dtSeconds: number, target: Point | null): void {
    const { world, session } = this;
    const state = session.get();
    const playing = state.phase === "playing" && !state.online;
    if (playing && !this.me) {
      // A fresh set of bots with every round: the ones that grew behind the menu would be unfair
      // to a newborn cell, and new bots keep their distance from it.
      world.players = [];
      const { skin, rgbName } = this.look();
      this.me = addPlayer(world, SELF_ID, state.nickname.trim(), skin, rgbName);
      spawnPlayer(world, this.me);
      resetBots(world);
    } else if (!playing && this.me) {
      removePlayer(world, SELF_ID);
      this.me = null;
    }

    const me = this.me;
    if (me) me.target = target;
    for (const death of stepWorld(world, dtSeconds)) {
      if (death.playerId === SELF_ID)
        session.finish({ mass: Math.floor(death.mass), eatenBy: death.by });
    }
    if (me && me.pieces.length > 0) session.setMass(totalMass(me));
  }

  split(): void {
    if (this.me) splitPlayer(this.world, this.me);
  }

  describe(): Record<string, unknown> {
    return { mode: "offline" };
  }
}
