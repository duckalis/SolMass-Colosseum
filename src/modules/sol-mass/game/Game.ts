import type { Point, World } from "./cells";

/**
 * What the arena on screen plays: an offline round against bots, or an online arena. The arena
 * (Arena.ts) owns the canvas, the camera and the input; a Game owns the world and what happens in it.
 */
export interface Game {
  /** What is drawn. An online arena that is not the host only copies it from the host. */
  readonly world: World;
  /** Id of this device's player in `world.players`. */
  readonly selfId: string;
  /**
   * How fast drawn cells chase their real positions, per second (see PieceSmoother): `Infinity`
   * while the simulation runs on this device, a finite rate while positions come over the network.
   */
  readonly smoothing: number;
  /** One frame: `target` — where the player's cursor is, in world coordinates. */
  update(dtSeconds: number, target: Point | null): void;
  /** The player pressed Split. */
  split(): void;
  /** Extra facts for the agent's debug surface. */
  describe(): Record<string, unknown>;
}
