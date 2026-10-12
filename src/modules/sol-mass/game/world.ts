import {
  BOT_MAX_MASS,
  BOT_SPEED_FACTOR,
  EAT_DEPTH,
  FOOD_COLORS,
  FOOD_COUNT,
  FOOD_MASS,
  FOOD_RADIUS,
  PLAYER_MAX_PIECES,
  SPLIT_BOOST_DRAG,
  SPLIT_BOOST_SPEED,
  SPLIT_MERGE_SECONDS,
  SPLIT_MIN_MASS,
  START_MASS,
  WORLD_SIZE,
} from "../data/tuning";
import { DEFAULT_SKIN } from "../data/cosmetics";
import { createBots, respawnBot, steerBot } from "./bots";
import {
  clamp,
  newPiece,
  pick,
  radiusForMass,
  speedForRadius,
  type Food,
  type Piece,
  type Player,
  type Random,
  type World,
} from "./cells";

// The simulation of the arena — plain data and pure functions, no canvas, no DOM and no network, so
// the rules (growth, speed, eating, splitting) can be read and tested on their own. The same code
// runs an offline round against bots and, on the host of an online arena, a round between players.

/** A player lost their last cell. */
export interface Death {
  playerId: string;
  /** Name of whoever swallowed it. */
  by: string;
  /** Mass of that last cell — the player's final mass. */
  mass: number;
}

/** Below this a split's launch is over: the piece moves normally and is solid to its sibling. */
const BOOST_REST = 40;

export function randomFood(world: World, random: Random): Food {
  let x = 0;
  let y = 0;
  // Not under a player's cell: a pellet born inside one would be eaten on the same frame.
  for (let attempt = 0; attempt < 4; attempt++) {
    x = FOOD_RADIUS + random() * (world.size - FOOD_RADIUS * 2);
    y = FOOD_RADIUS + random() * (world.size - FOOD_RADIUS * 2);
    const covered = world.players.some(
      (player) =>
        !player.bot &&
        player.pieces.some(
          (piece) =>
            Math.hypot(x - piece.x, y - piece.y) <
            radiusForMass(piece.mass) + FOOD_RADIUS * 4,
        ),
    );
    if (!covered) break;
  }
  return { x, y, radius: FOOD_RADIUS, color: pick(FOOD_COLORS, random) };
}

/** An arena full of food and with nobody on it. */
export function createWorld(random: Random = Math.random): World {
  const world: World = {
    size: WORLD_SIZE,
    time: 0,
    food: [],
    players: [],
    nextPieceId: 1,
    foodLog: null,
  };
  for (let i = 0; i < FOOD_COUNT; i++) world.food.push(randomFood(world, random));
  return world;
}

/** Replaces whatever bots the arena has with a fresh set, away from the players' cells. */
export function resetBots(world: World, random: Random = Math.random): void {
  world.players = world.players.filter((player) => !player.bot);
  world.players.push(...createBots(world, random));
}

/** Adds a player with no cell yet (see spawnPlayer). `skin` — a skin's id; a free one by default. */
export function addPlayer(
  world: World,
  id: string,
  name: string,
  skin: string = DEFAULT_SKIN.id,
  rgbName = false,
): Player {
  const player: Player = {
    id,
    name,
    skin,
    rgbName,
    pieces: [],
    target: null,
    bot: null,
    eaten: 0,
  };
  world.players.push(player);
  return player;
}

export function removePlayer(world: World, id: string): void {
  world.players = world.players.filter((player) => player.id !== id);
}

/**
 * Gives the player a fresh cell of the starting mass: away from the border and, of a handful of
 * random places, the one farthest from every other cell.
 */
export function spawnPlayer(
  world: World,
  player: Player,
  random: Random = Math.random,
): void {
  const margin = world.size * 0.15;
  let x = world.size / 2;
  let y = world.size / 2;
  let bestClearance = -Infinity;
  for (let attempt = 0; attempt < 12; attempt++) {
    const px = margin + random() * (world.size - margin * 2);
    const py = margin + random() * (world.size - margin * 2);
    let clearance = Infinity;
    for (const other of world.players) {
      if (other === player) continue;
      for (const piece of other.pieces) {
        clearance = Math.min(
          clearance,
          Math.hypot(piece.x - px, piece.y - py) - radiusForMass(piece.mass),
        );
      }
    }
    if (clearance > bestClearance) {
      bestClearance = clearance;
      x = px;
      y = py;
    }
  }
  player.pieces = [newPiece(world, x, y, START_MASS)];
  player.target = null;
  player.eaten = 0;
}

/**
 * Splits the player's cell in two equal halves: one stays, the other is shot toward the player's
 * target and flies on its own for a moment. Nothing happens — `false` — while the cell is too light
 * or the player already has all the pieces allowed.
 */
export function splitPlayer(world: World, player: Player): boolean {
  let split = false;
  for (const piece of [...player.pieces]) {
    if (player.pieces.length >= PLAYER_MAX_PIECES) break;
    if (piece.mass <= SPLIT_MIN_MASS) continue;

    let dx = (player.target?.x ?? piece.x) - piece.x;
    let dy = (player.target?.y ?? piece.y) - piece.y;
    const distance = Math.hypot(dx, dy);
    // No cursor to aim at (or it is dead centre): shoot to the right rather than not at all.
    if (distance < 1) {
      dx = 1;
      dy = 0;
    } else {
      dx /= distance;
      dy /= distance;
    }

    const half = Math.floor(piece.mass / 2);
    piece.mass -= half;
    const shot = newPiece(world, piece.x, piece.y, half);
    shot.boostX = dx * SPLIT_BOOST_SPEED;
    shot.boostY = dy * SPLIT_BOOST_SPEED;
    shot.mergeAt = piece.mergeAt = world.time + SPLIT_MERGE_SECONDS;
    player.pieces.push(shot);
    split = true;
  }
  return split;
}

/**
 * One step of the simulation: every cell moves toward its owner's target (a bot picks its own),
 * and every cell eats what it covers. Returns the players who lost their last cell on this step;
 * a bot in that position simply comes back as a new cell elsewhere.
 */
export function stepWorld(
  world: World,
  dtSeconds: number,
  random: Random = Math.random,
): Death[] {
  world.time += dtSeconds;
  for (const player of world.players) {
    if (player.bot) steerBot(player, world, dtSeconds, random);
    movePieces(player, world, dtSeconds);
  }
  eatFood(world, random);
  const deaths = eatPieces(world, random);
  for (const player of world.players) {
    if (!player.bot) continue;
    for (const piece of player.pieces)
      piece.mass = Math.min(piece.mass, BOT_MAX_MASS);
  }
  return deaths;
}

function movePieces(player: Player, world: World, dtSeconds: number): void {
  const pace = player.bot ? BOT_SPEED_FACTOR : 1;
  const target = player.target;
  for (const piece of player.pieces) {
    let moveX = 0;
    let moveY = 0;
    if (target) {
      const radius = radiusForMass(piece.mass);
      const dx = target.x - piece.x;
      const dy = target.y - piece.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 0.5) {
        // Full speed once the target is a radius away; slower when it is closer, so a cell can be
        // parked under the cursor instead of jittering around it.
        const throttle = Math.min(1, distance / radius);
        const step = Math.min(
          distance,
          speedForRadius(radius) * pace * throttle * dtSeconds,
        );
        moveX = (dx / distance) * step;
        moveY = (dy / distance) * step;
      }
    }
    if (piece.boostX !== 0 || piece.boostY !== 0) {
      moveX += piece.boostX * dtSeconds;
      moveY += piece.boostY * dtSeconds;
      const fade = Math.exp(-SPLIT_BOOST_DRAG * dtSeconds);
      piece.boostX *= fade;
      piece.boostY *= fade;
      if (Math.hypot(piece.boostX, piece.boostY) < BOOST_REST) {
        piece.boostX = 0;
        piece.boostY = 0;
      }
    }
    piece.x = clamp(piece.x + moveX, 0, world.size);
    piece.y = clamp(piece.y + moveY, 0, world.size);
  }
  if (player.pieces.length > 1) settlePieces(player, world);
}

/**
 * A player's own pieces: solid to each other until their merge time comes, one cell again once it
 * has and they touch. A piece still flying from a split passes through its sibling.
 */
function settlePieces(player: Player, world: World): void {
  const pieces = player.pieces;
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      const a = pieces[i] as Piece;
      const b = pieces[j] as Piece;
      const reach = radiusForMass(a.mass) + radiusForMass(b.mass);
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let distance = Math.hypot(dx, dy);
      if (distance >= reach) continue;

      if (world.time >= a.mergeAt && world.time >= b.mergeAt) {
        const mass = a.mass + b.mass;
        a.x = (a.x * a.mass + b.x * b.mass) / mass;
        a.y = (a.y * a.mass + b.y * b.mass) / mass;
        a.mass = mass;
        pieces.splice(j, 1);
        j--;
        continue;
      }
      if (a.boostX !== 0 || a.boostY !== 0 || b.boostX !== 0 || b.boostY !== 0)
        continue;

      if (distance < 0.01) {
        dx = 1;
        dy = 0;
        distance = 1;
      }
      // Push them apart along the line between the centres, the lighter one further.
      const overlap = reach - distance;
      const mass = a.mass + b.mass;
      const ux = dx / distance;
      const uy = dy / distance;
      a.x = clamp(a.x - ux * overlap * (b.mass / mass), 0, world.size);
      a.y = clamp(a.y - uy * overlap * (b.mass / mass), 0, world.size);
      b.x = clamp(b.x + ux * overlap * (a.mass / mass), 0, world.size);
      b.y = clamp(b.y + uy * overlap * (a.mass / mass), 0, world.size);
    }
  }
}

function eatFood(world: World, random: Random): void {
  const eaters: Array<{ piece: Piece; owner: Player; reach: number }> = [];
  for (const owner of world.players) {
    for (const piece of owner.pieces)
      eaters.push({ piece, owner, reach: radiusForMass(piece.mass) ** 2 });
  }
  if (eaters.length === 0) return;

  for (let i = 0; i < world.food.length; i++) {
    const food = world.food[i] as Food;
    for (const eater of eaters) {
      const dx = food.x - eater.piece.x;
      const dy = food.y - eater.piece.y;
      // Eaten once a cell reaches the pellet's centre.
      if (dx * dx + dy * dy >= eater.reach) continue;
      eater.piece.mass += FOOD_MASS;
      eater.reach = radiusForMass(eater.piece.mass) ** 2;
      eater.owner.eaten++;
      world.food[i] = randomFood(world, random);
      world.foodLog?.push(i);
      break;
    }
  }
}

/**
 * Cell eats cell: the bigger one swallows a smaller one of ANOTHER player once the smaller sits
 * deep enough in it (EAT_DEPTH), and takes its mass.
 */
function eatPieces(world: World, random: Random): Death[] {
  const deaths: Death[] = [];
  const all: Array<{ piece: Piece; owner: Player }> = [];
  for (const owner of world.players) {
    for (const piece of owner.pieces) all.push({ piece, owner });
  }
  const gone = new Set<Piece>();

  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i] as { piece: Piece; owner: Player };
      const b = all[j] as { piece: Piece; owner: Player };
      if (a.owner === b.owner || a.piece.mass === b.piece.mass) continue;
      if (gone.has(a.piece) || gone.has(b.piece)) continue;
      const big = a.piece.mass > b.piece.mass ? a : b;
      const small = big === a ? b : a;
      const reach =
        radiusForMass(big.piece.mass) -
        radiusForMass(small.piece.mass) * EAT_DEPTH;
      const distance = Math.hypot(
        big.piece.x - small.piece.x,
        big.piece.y - small.piece.y,
      );
      if (distance >= reach) continue;

      big.piece.mass += small.piece.mass;
      gone.add(small.piece);
      const victim = small.owner;
      victim.pieces = victim.pieces.filter((piece) => piece !== small.piece);
      if (victim.pieces.length > 0) continue;
      if (victim.bot) {
        respawnBot(victim, world, random);
      } else {
        deaths.push({
          playerId: victim.id,
          by: big.owner.name,
          mass: small.piece.mass,
        });
      }
    }
  }
  return deaths;
}
