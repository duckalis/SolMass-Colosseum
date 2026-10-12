// What a player can change about how the game looks, and how much $MASS they must HOLD for it.
// Nothing here is bought or spent: an option is open while the player's wallet holds enough tokens.

export const TOKEN_SYMBOL = "$MASS";

/** 0 — everybody; 1 and 2 — holders of at least TIER_MIN[tier] tokens. */
export type Tier = 0 | 1 | 2;

/** Tokens a wallet must hold to be of a tier. */
export const TIER_MIN: Readonly<Record<Tier, number>> = { 0: 0, 1: 500, 2: 1000 };

export function tierForBalance(balance: number): Tier {
  if (balance >= TIER_MIN[2]) return 2;
  if (balance >= TIER_MIN[1]) return 1;
  return 0;
}

/** The text over a locked option. */
export function unlockText(tier: Tier): string {
  return `Hold ${TIER_MIN[tier]} ${TOKEN_SYMBOL} to unlock`;
}

// ── Skins ────────────────────────────────────────────────────────────────────────────────────

export interface Skin {
  id: string;
  name: string;
  tier: Tier;
  /** solid — one colour; gradient — `colors` blended across the cell; rainbow — a turning wheel. */
  kind: "solid" | "gradient" | "rainbow";
  colors: readonly string[];
}

/**
 * ⚠ Append only. A skin travels between players of an online arena as its INDEX in this list, so
 * inserting or reordering would show everybody the wrong skin while old and new builds meet.
 */
export const SKINS: readonly Skin[] = [
  { id: "mint", name: "Mint", tier: 0, kind: "solid", colors: ["#14f195"] },
  { id: "violet", name: "Violet", tier: 0, kind: "solid", colors: ["#9945ff"] },
  { id: "sky", name: "Sky", tier: 0, kind: "solid", colors: ["#38c8f5"] },
  { id: "orange", name: "Orange", tier: 0, kind: "solid", colors: ["#ff9f1a"] },
  { id: "coral", name: "Coral", tier: 0, kind: "solid", colors: ["#ff5c7a"] },
  { id: "sun", name: "Sun", tier: 0, kind: "solid", colors: ["#ffd93d"] },
  { id: "blue", name: "Blue", tier: 0, kind: "solid", colors: ["#5b8cff"] },
  { id: "pink", name: "Pink", tier: 0, kind: "solid", colors: ["#ff6bf0"] },

  { id: "sunset", name: "Sunset", tier: 1, kind: "gradient", colors: ["#ffd86f", "#fc6262", "#b5179e"] },
  { id: "ocean", name: "Ocean", tier: 1, kind: "gradient", colors: ["#7ef9ff", "#00a8ff", "#273c9c"] },
  { id: "aurora", name: "Aurora", tier: 1, kind: "gradient", colors: ["#b8ffd9", "#00f5a0", "#7f5cff"] },
  { id: "lava", name: "Lava", tier: 1, kind: "gradient", colors: ["#fff275", "#ff8c00", "#d00000"] },
  { id: "candy", name: "Candy", tier: 1, kind: "gradient", colors: ["#fff0f9", "#ff6bcb", "#7b61ff"] },
  { id: "solana", name: "Solana", tier: 1, kind: "gradient", colors: ["#14f195", "#4fa8d8", "#9945ff"] },

  {
    id: "rainbow",
    name: "Rainbow",
    tier: 2,
    kind: "rainbow",
    colors: ["#ff3b3b", "#ff9f1a", "#ffe53b", "#3bff6f", "#3bd1ff", "#6f5bff", "#ff3bd4"],
  },
];

export const FREE_SKINS: readonly Skin[] = SKINS.filter((skin) => skin.tier === 0);
export const DEFAULT_SKIN: Skin = SKINS[0] as Skin;

export function skinById(id: string): Skin {
  return SKINS.find((skin) => skin.id === id) ?? DEFAULT_SKIN;
}

// ── Arena backgrounds ────────────────────────────────────────────────────────────────────────

export interface ArenaTheme {
  id: string;
  name: string;
  tier: Tier;
  /** The arena itself. */
  floor: string;
  /** What lies beyond its border. */
  outside: string;
  /** Grid lines — light on a dark floor, dark on a light one. */
  grid: string;
  border: string;
}

export const ARENA_THEMES: readonly ArenaTheme[] = [
  { id: "default", name: "Default", tier: 0, floor: "#0f1338", outside: "#060818", grid: "rgba(255, 255, 255, 0.055)", border: "#9945ff" },
  { id: "black", name: "Black", tier: 1, floor: "#000000", outside: "#0b0b0f", grid: "rgba(255, 255, 255, 0.08)", border: "#9945ff" },
  { id: "white", name: "White", tier: 1, floor: "#ffffff", outside: "#d5d9e6", grid: "rgba(0, 0, 0, 0.09)", border: "#9945ff" },
  { id: "red", name: "Red", tier: 1, floor: "#5c0f17", outside: "#2a070b", grid: "rgba(255, 255, 255, 0.08)", border: "#ff8f9f" },
  { id: "yellow", name: "Yellow", tier: 1, floor: "#f5d547", outside: "#b89a1c", grid: "rgba(0, 0, 0, 0.1)", border: "#5b3b00" },
  { id: "green", name: "Green", tier: 1, floor: "#0e4d2c", outside: "#062615", grid: "rgba(255, 255, 255, 0.08)", border: "#14f195" },
];

export const DEFAULT_ARENA: ArenaTheme = ARENA_THEMES[0] as ArenaTheme;

export function arenaById(id: string): ArenaTheme {
  return ARENA_THEMES.find((theme) => theme.id === id) ?? DEFAULT_ARENA;
}

/** The tier that turns on the nickname that shimmers through the colours of the rainbow. */
export const RGB_NAME_TIER: Tier = 2;

// ── A player's choices ───────────────────────────────────────────────────────────────────────

export interface Look {
  skin: string;
  arena: string;
  rgbName: boolean;
}

export const DEFAULT_LOOK: Look = {
  skin: DEFAULT_SKIN.id,
  arena: DEFAULT_ARENA.id,
  rgbName: false,
};

/**
 * What of a saved look the player may actually use at their tier: an option whose tokens were sold
 * since falls back to the free one, and comes back by itself if the tokens do.
 */
export function allowedLook(look: Look, tier: Tier): Look {
  return {
    skin: skinById(look.skin).tier <= tier ? skinById(look.skin).id : DEFAULT_SKIN.id,
    arena: arenaById(look.arena).tier <= tier ? arenaById(look.arena).id : DEFAULT_ARENA.id,
    rgbName: look.rgbName && tier >= RGB_NAME_TIER,
  };
}
