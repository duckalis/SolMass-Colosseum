import { skinById, type ArenaTheme, type Skin } from "../data/cosmetics";
import { GRID_STEP } from "../data/tuning";
import type { World } from "./cells";
import type { DrawnPiece, PieceSmoother } from "./smooth";

// Draws one frame of the arena on a 2D canvas: the grid, the border, the food and every cell —
// the player's, the other players' and the bots' — each in its owner's skin.

export interface Camera {
  /** World point at the centre of the screen. */
  x: number;
  y: number;
  /** Screen pixels per world unit. */
  zoom: number;
}

export interface Viewport {
  /** CSS pixels. */
  width: number;
  height: number;
  /** Device pixels per CSS pixel the canvas was sized with. */
  dpr: number;
}

const FONT = "'Baloo 2', 'Nunito', system-ui, sans-serif";
/** Turns of the rainbow skin per second, and of the colours running along an RGB nickname. */
const RAINBOW_TURNS = 0.22;
const NAME_SHIMMER = 0.6;

/** `timeSeconds` drives what is animated: the rainbow skin and the RGB nicknames. */
export function drawArena(
  ctx: CanvasRenderingContext2D,
  world: World,
  camera: Camera,
  view: Viewport,
  smoother: PieceSmoother,
  theme: ArenaTheme,
  timeSeconds: number,
): void {
  const { width, height, dpr } = view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = theme.outside;
  ctx.fillRect(0, 0, width, height);
  if (width === 0 || height === 0) return;

  ctx.translate(width / 2, height / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  // The part of the world on screen, clipped to the arena.
  const halfW = width / 2 / camera.zoom;
  const halfH = height / 2 / camera.zoom;
  const left = Math.max(0, camera.x - halfW);
  const right = Math.min(world.size, camera.x + halfW);
  const top = Math.max(0, camera.y - halfH);
  const bottom = Math.min(world.size, camera.y + halfH);

  if (left < right && top < bottom) {
    ctx.fillStyle = theme.floor;
    ctx.fillRect(left, top, right - left, bottom - top);

    ctx.beginPath();
    for (let x = Math.ceil(left / GRID_STEP) * GRID_STEP; x <= right; x += GRID_STEP) {
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
    }
    for (let y = Math.ceil(top / GRID_STEP) * GRID_STEP; y <= bottom; y += GRID_STEP) {
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
    }
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1 / camera.zoom;
    ctx.stroke();
  }

  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, world.size, world.size);

  for (const food of world.food) {
    if (
      food.x < left - food.radius ||
      food.x > right + food.radius ||
      food.y < top - food.radius ||
      food.y > bottom + food.radius
    )
      continue;
    ctx.beginPath();
    ctx.arc(food.x, food.y, food.radius, 0, Math.PI * 2);
    ctx.fillStyle = food.color;
    ctx.fill();
  }

  const cells: Array<{
    at: DrawnPiece;
    mass: number;
    skin: Skin;
    name: string;
    rgbName: boolean;
  }> = [];
  for (const player of world.players) {
    if (player.pieces.length === 0) continue;
    const skin = skinById(player.skin);
    for (const piece of player.pieces)
      cells.push({
        at: smoother.get(piece),
        mass: piece.mass,
        skin,
        name: player.name,
        rgbName: player.rgbName,
      });
  }
  // Small first: a bigger cell covers the one it is swallowing.
  cells.sort((a, b) => a.mass - b.mass);
  for (const cell of cells) {
    const { x, y, radius } = cell.at;
    if (
      x < left - radius ||
      x > right + radius ||
      y < top - radius ||
      y > bottom + radius
    )
      continue;
    drawCell(ctx, x, y, radius, cell.skin, cell.name, cell.rgbName, cell.mass, timeSeconds);
  }
}

/** What a cell of this skin is filled with — also used for the previews of the Skins screen. */
export function skinFill(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  x: number,
  y: number,
  radius: number,
  timeSeconds: number,
): string | CanvasGradient {
  const colors = skin.colors;
  if (skin.kind === "solid" || colors.length < 2) return colors[0] ?? "#ffffff";

  if (skin.kind === "rainbow" && typeof ctx.createConicGradient === "function") {
    // A colour wheel turning around the cell's centre.
    const wheel = ctx.createConicGradient(
      timeSeconds * RAINBOW_TURNS * Math.PI * 2,
      x,
      y,
    );
    colors.forEach((color, i) => wheel.addColorStop(i / colors.length, color));
    wheel.addColorStop(1, colors[0] as string);
    return wheel;
  }

  // Lit from the upper left: the first colour is the highlight, the last the far edge.
  const blend = ctx.createRadialGradient(
    x - radius * 0.38,
    y - radius * 0.38,
    radius * 0.05,
    x,
    y,
    radius * 1.08,
  );
  colors.forEach((color, i) => blend.addColorStop(i / (colors.length - 1), color));
  return blend;
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  skin: Skin,
  name: string,
  rgbName: boolean,
  mass: number,
  timeSeconds: number,
): void {
  const rim = Math.max(2, radius * 0.07);

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = skinFill(ctx, skin, x, y, radius, timeSeconds);
  ctx.fill();
  // A darker rim of the same colour, drawn inside the cell so the radius stays honest.
  ctx.beginPath();
  ctx.arc(x, y, radius - rim / 2, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.22)";
  ctx.lineWidth = rim;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";

  const nameSize = Math.max(12, radius * 0.4);
  const massSize = nameSize * 0.7;
  if (name) {
    ctx.font = `700 ${nameSize}px ${FONT}`;
    ctx.lineWidth = nameSize * 0.16;
    // Long names shrink to stay inside the cell.
    const maxWidth = radius * 1.7;
    const nameY = y - massSize * 0.35;
    ctx.strokeText(name, x, nameY, maxWidth);
    if (rgbName) {
      // The whole rainbow laid along the name, sliding through it.
      const half = Math.min(ctx.measureText(name).width, maxWidth) / 2;
      const hues = ctx.createLinearGradient(x - half, 0, x + half, 0);
      const shift = timeSeconds * NAME_SHIMMER;
      for (let stop = 0; stop <= 6; stop++)
        hues.addColorStop(
          stop / 6,
          `hsl(${Math.round(((stop / 6 + shift) % 1) * 360)}, 100%, 62%)`,
        );
      ctx.fillStyle = hues;
    } else {
      ctx.fillStyle = "#ffffff";
    }
    ctx.fillText(name, x, nameY, maxWidth);
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${massSize}px ${FONT}`;
  ctx.lineWidth = massSize * 0.16;
  const massY = name ? y + nameSize * 0.62 : y;
  const label = String(Math.floor(mass));
  ctx.strokeText(label, x, massY);
  ctx.fillText(label, x, massY);
}
