import {
  BASE_SPEED,
  MIN_SPEED,
  RADIUS_PER_ROOT_MASS,
  SPEED_FALLOFF,
  START_MASS,
} from "../data/tuning";

// What the arena is made of, and the two rules every cell obeys — a player's and a bot's alike:
// the radius grows with the mass, the speed drops with the radius.

export interface Point {
  x: number;
  y: number;
}

export interface Food extends Point {
  radius: number;
  color: string;
}

/** One cell on the arena. A player is one piece, or two after a split. */
export interface Piece extends Point {
  /** Unique in the world: how the renderer and a network copy follow one piece between frames. */
  id: number;
  mass: number;
  /** Velocity of a split's launch, on top of the normal movement, units per second; fades out. */
  boostX: number;
  boostY: number;
  /** World time from which the piece may merge with the player's other piece. */
  mergeAt: number;
}

/** What steers a bot instead of a cursor. */
export interface BotMind {
  /** Seconds until it picks a new target. */
  retargetIn: number;
}

/** Whoever owns cells on the arena: the local player, a remote one, or a bot. */
export interface Player {
  id: string;
  name: string;
  /** How the cells are painted — a skin's id (data/cosmetics.ts). */
  skin: string;
  /** The name over the cells shimmers through the rainbow. */
  rgbName: boolean;
  /** Empty — swallowed, and not back on the arena yet. */
  pieces: Piece[];
  /** Where the pieces are heading, world coordinates; `null` — they stay where they are. */
  target: Point | null;
  bot: BotMind | null;
  /** Pellets eaten since the player's cell appeared. */
  eaten: number;
}

export interface World {
  size: number;
  /** Seconds simulated so far. */
  time: number;
  food: Food[];
  players: Player[];
  nextPieceId: number;
  /**
   * Indices of the pellets replaced since the log was last emptied — what an online host sends to
   * the others. `null` — nobody needs it (an offline arena).
   */
  foodLog: number[] | null;
}

/** Returns a number in [0, 1) — `Math.random` in the game, a seeded one in a test. */
export type Random = () => number;

export function radiusForMass(mass: number): number {
  return Math.sqrt(mass) * RADIUS_PER_ROOT_MASS;
}

const START_RADIUS = radiusForMass(START_MASS);

/** The bigger the cell, the slower it moves. */
export function speedForRadius(radius: number): number {
  return Math.max(
    MIN_SPEED,
    BASE_SPEED * (START_RADIUS / radius) ** SPEED_FALLOFF,
  );
}

export function totalMass(player: Player): number {
  let mass = 0;
  for (const piece of player.pieces) mass += piece.mass;
  return mass;
}

export function newPiece(world: World, x: number, y: number, mass: number): Piece {
  const id = world.nextPieceId;
  // Ids travel over the network as 16 bits; by the time they wrap, the first ones are long gone.
  world.nextPieceId = (id % 0xffff) + 1;
  return { id, x, y, mass, boostX: 0, boostY: 0, mergeAt: 0 };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function pick<T>(list: readonly T[], random: Random): T {
  return list[Math.floor(random() * list.length)] as T;
}
