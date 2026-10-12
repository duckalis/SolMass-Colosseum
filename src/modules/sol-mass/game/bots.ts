import {
  BOT_COUNT,
  BOT_GRAZE_CHANCE,
  BOT_MASS_CAP_MIN,
  BOT_MASS_OVER_PLAYER,
  BOT_MAX_MASS,
  BOT_NAMES,
  BOT_SPAWN_CLEARANCE,
  BOT_VISION,
  START_MASS,
} from "../data/tuning";
import { DEFAULT_SKIN, FREE_SKINS } from "../data/cosmetics";
import {
  clamp,
  newPiece,
  pick,
  radiusForMass,
  totalMass,
  type Food,
  type Piece,
  type Player,
  type Random,
  type World,
} from "./cells";

// The bots: where they appear and how they decide where to go. A bot that sees a player's cell
// hunts it when it is the bigger one and runs when it is the smaller one; with nobody around it
// grazes the nearest pellet or just wanders. Moving and eating are world.ts — the same rules as
// for a player; a bot only chooses its `target`.

/** How wide a running bot scatters around "straight away from the player", radians. */
const FLEE_SCATTER = 1.2;

export function createBots(world: World, random: Random): Player[] {
  const bots: Player[] = [];
  for (let i = 0; i < BOT_COUNT; i++) {
    const bot: Player = {
      id: `bot:${i}`,
      name: BOT_NAMES[i % BOT_NAMES.length] as string,
      skin: DEFAULT_SKIN.id,
      rgbName: false,
      pieces: [],
      target: null,
      bot: { retargetIn: 0 },
      eaten: 0,
    };
    respawnBot(bot, world, random);
    bots.push(bot);
  }
  return bots;
}

/** Puts the bot back on the arena as a new cell: a new place, a new mass, the same name. */
export function respawnBot(bot: Player, world: World, random: Random): void {
  const humans = world.players.filter((player) => !player.bot);
  // Most bots start small, a few start big — and some are always bigger than the player.
  const biggest = Math.max(0, ...humans.map(totalMass));
  const cap = Math.min(
    BOT_MAX_MASS,
    Math.max(BOT_MASS_CAP_MIN, biggest * BOT_MASS_OVER_PLAYER),
  );
  const mass = Math.round(START_MASS + random() ** 2 * (cap - START_MASS));

  let x = 0;
  let y = 0;
  // Never next to a player's cell: not on screen, and not beside a newborn one.
  for (let attempt = 0; attempt < 8; attempt++) {
    x = random() * world.size;
    y = random() * world.size;
    const clear = humans.every((human) =>
      human.pieces.every(
        (piece) => Math.hypot(x - piece.x, y - piece.y) > BOT_SPAWN_CLEARANCE,
      ),
    );
    if (clear) break;
  }

  bot.skin = pick(FREE_SKINS, random).id;
  bot.pieces = [newPiece(world, x, y, mass)];
  bot.target = { x, y };
  bot.eaten = 0;
  if (bot.bot) bot.bot.retargetIn = 0;
}

/** One step of a bot's mind: re-decide where to go when it is time, or it has arrived. */
export function steerBot(
  bot: Player,
  world: World,
  dtSeconds: number,
  random: Random,
): void {
  const mind = bot.bot;
  const piece = bot.pieces[0];
  if (!mind || !piece) return;
  const radius = radiusForMass(piece.mass);
  mind.retargetIn -= dtSeconds;
  const target = bot.target;
  const arrived =
    !target ||
    Math.hypot(target.x - piece.x, target.y - piece.y) < radius * 0.3;
  if (mind.retargetIn > 0 && !arrived) return;

  const seen = nearestPlayerPiece(piece, world, radius);
  if (seen) {
    if (piece.mass > seen.mass) {
      bot.target = { x: seen.x, y: seen.y };
    } else {
      // Not a perfect line away: the scatter is what lets the player cut a runner off. Against
      // a wall the target collapses onto the bot itself — it is cornered.
      const angle =
        Math.atan2(piece.y - seen.y, piece.x - seen.x) +
        (random() - 0.5) * FLEE_SCATTER;
      bot.target = {
        x: clamp(piece.x + Math.cos(angle) * BOT_VISION, 0, world.size),
        y: clamp(piece.y + Math.sin(angle) * BOT_VISION, 0, world.size),
      };
    }
    mind.retargetIn = 0.25 + random() * 0.35;
    return;
  }

  const food =
    random() < BOT_GRAZE_CHANCE ? nearestFood(piece, world, radius) : null;
  if (food) {
    bot.target = { x: food.x, y: food.y };
  } else {
    const angle = random() * Math.PI * 2;
    const reach = 200 + random() * 500;
    bot.target = {
      x: clamp(piece.x + Math.cos(angle) * reach, 0, world.size),
      y: clamp(piece.y + Math.sin(angle) * reach, 0, world.size),
    };
  }
  mind.retargetIn = 0.6 + random() * 1.4;
}

/** The closest cell of a player the bot can see and is not the same size as. */
function nearestPlayerPiece(
  piece: Piece,
  world: World,
  radius: number,
): Piece | null {
  let nearest: Piece | null = null;
  let best = Infinity;
  for (const player of world.players) {
    if (player.bot) continue;
    for (const other of player.pieces) {
      if (other.mass === piece.mass) continue;
      const distance = Math.hypot(other.x - piece.x, other.y - piece.y);
      const sight = BOT_VISION + radius + radiusForMass(other.mass);
      if (distance < sight && distance < best) {
        best = distance;
        nearest = other;
      }
    }
  }
  return nearest;
}

function nearestFood(piece: Piece, world: World, radius: number): Food | null {
  let nearest: Food | null = null;
  let best = (BOT_VISION + radius) ** 2;
  for (const food of world.food) {
    const dx = food.x - piece.x;
    const dy = food.y - piece.y;
    const squared = dx * dx + dy * dy;
    if (squared < best) {
      best = squared;
      nearest = food;
    }
  }
  return nearest;
}
