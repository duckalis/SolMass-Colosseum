import { radiusForMass, type Piece, type World } from "./cells";

// Where each cell is DRAWN, as opposed to where the simulation has it. A cell swells smoothly
// instead of jumping with every pellet, and on an online arena — where positions arrive a few
// times a second — it glides between them.

export interface DrawnPiece {
  x: number;
  y: number;
  radius: number;
}

/** How fast a drawn radius catches up with the real one, per second. */
const GROW_RATE = 10;

export class PieceSmoother {
  private drawn = new Map<number, DrawnPiece>();

  /**
   * Call once per frame. `positionRate` — how fast a drawn cell chases its real position, per
   * second; `Infinity` — it is drawn exactly where it is (a simulation running on this device).
   */
  update(world: World, dtSeconds: number, positionRate: number): void {
    const move = Number.isFinite(positionRate)
      ? 1 - Math.exp(-positionRate * dtSeconds)
      : 1;
    const grow = 1 - Math.exp(-GROW_RATE * dtSeconds);
    // A fresh map every frame: pieces that are gone drop out by themselves.
    const next = new Map<number, DrawnPiece>();
    for (const player of world.players) {
      for (const piece of player.pieces) {
        const radius = radiusForMass(piece.mass);
        const seen = this.drawn.get(piece.id);
        if (!seen) {
          next.set(piece.id, { x: piece.x, y: piece.y, radius });
          continue;
        }
        seen.x += (piece.x - seen.x) * move;
        seen.y += (piece.y - seen.y) * move;
        seen.radius += (radius - seen.radius) * grow;
        next.set(piece.id, seen);
      }
    }
    this.drawn = next;
  }

  get(piece: Piece): DrawnPiece {
    return (
      this.drawn.get(piece.id) ?? {
        x: piece.x,
        y: piece.y,
        radius: radiusForMass(piece.mass),
      }
    );
  }
}
