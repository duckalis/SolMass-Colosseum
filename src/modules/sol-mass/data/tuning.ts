// Tuning of the arena. Lengths are world units (1 unit = 1 CSS pixel at zoom 1), speeds are world
// units per second.

/** Side of the square arena. */
export const WORLD_SIZE = 3600;

/** Food pellets on the arena at any moment — an eaten one is replaced at once. */
export const FOOD_COUNT = 1000;
export const FOOD_RADIUS = 7;
/** Mass one pellet adds. */
export const FOOD_MASS = 1;

/** Mass a cell starts with. */
export const START_MASS = 10;
/** radius = sqrt(mass) * this, so the cell's AREA grows with what it ate (20 units at the start). */
export const RADIUS_PER_ROOT_MASS = 6.4;

/** Speed of a cell of START_MASS. */
export const BASE_SPEED = 260;
/** How fast speed drops with size: speed = BASE_SPEED * (startRadius / radius) ^ SPEED_FALLOFF. */
export const SPEED_FALLOFF = 0.45;
/** A huge cell still crawls. */
export const MIN_SPEED = 45;

/**
 * How deep the smaller cell must sit in the bigger one to be swallowed: its centre has to be this
 * share of its OWN radius inside the bigger cell's edge. 0 — the centre merely on the edge (about
 * half of the cell covered), 0.5 — about 80% covered, 1 — entirely inside.
 */
export const EAT_DEPTH = 0.5;

// ── Split ────────────────────────────────────────────────────────────────────────────────────

/** A cell splits only while it is heavier than this. */
export const SPLIT_MIN_MASS = 40;
/** Cells one player can have at once. */
export const PLAYER_MAX_PIECES = 2;
/** Speed the shot-out half starts with, on top of its normal movement. */
export const SPLIT_BOOST_SPEED = 850;
/** How fast that extra speed fades, per second (speed × e^(−drag × t)): ~240 units of throw. */
export const SPLIT_BOOST_DRAG = 3.5;
/** Seconds after a split before the halves may merge back when they touch. */
export const SPLIT_MERGE_SECONDS = 30;

// ── Online ───────────────────────────────────────────────────────────────────────────────────

/** Players on one online arena (the title's Multiplayer.MaxPlayersPerRoom caps it). */
export const ONLINE_MAX_PLAYERS = 12;
/** How often the host sends the arena to the others, and they send their cursors to it. */
export const ONLINE_SEND_HZ = 20;

/** The camera zooms out as the cell grows: zoom = (startRadius / radius) ^ ZOOM_FALLOFF. */
export const ZOOM_FALLOFF = 0.4;
export const MIN_ZOOM = 0.3;

export const GRID_STEP = 60;

export const FOOD_COLORS = [
  "#ff5c7a",
  "#ff9f1a",
  "#ffd93d",
  "#6bff8f",
  "#14f195",
  "#38c8f5",
  "#5b8cff",
  "#9945ff",
  "#ff6bf0",
] as const;

export const NICKNAME_MAX = 15;

// ── Bots ─────────────────────────────────────────────────────────────────────────────────────

export const BOT_COUNT = 14;
/** A bot is slower than a player of the same mass, so a bigger player can run a bot down. */
export const BOT_SPEED_FACTOR = 0.85;
/** How far beyond the two cells' edges a bot notices the player, and looks for food. */
export const BOT_VISION = 420;
/** Past this a bot stops growing — a board left open on the menu does not fill up with giants. */
export const BOT_MAX_MASS = 500;
/** A new bot's mass is between START_MASS and max(this, player mass × BOT_MASS_OVER_PLAYER)… */
export const BOT_MASS_CAP_MIN = 90;
/** …so however big the player gets, some of the bots are still bigger. */
export const BOT_MASS_OVER_PLAYER = 1.6;
/** Of a bot's free decisions, the share that goes for the nearest pellet; the rest just wander. */
export const BOT_GRAZE_CHANCE = 0.45;
/** A bot never appears closer than this to the player: not on screen, and not beside a newborn cell. */
export const BOT_SPAWN_CLEARANCE = 900;

export const BOT_NAMES = [
  "Bonk",
  "Jup",
  "Orca",
  "Pyth",
  "Wif",
  "Jito",
  "Drift",
  "Tensor",
  "Helium",
  "Raydium",
  "Phantom",
  "Mango",
  "Saga",
  "Marinade",
] as const;
