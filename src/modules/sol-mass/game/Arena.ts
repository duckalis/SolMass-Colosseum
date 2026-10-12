import { arenaById, type Look } from "../data/cosmetics";
import { MIN_ZOOM, START_MASS, ZOOM_FALLOFF } from "../data/tuning";
import {
  radiusForMass,
  speedForRadius,
  totalMass,
  type Point,
} from "./cells";
import type { Game } from "./Game";
import { OfflineGame } from "./OfflineGame";
import { drawArena, type Camera } from "./render";
import type { Session } from "./session";
import { PieceSmoother } from "./smooth";

// The arena on screen: owns the <canvas>, the frame loop, the input and the camera, and plays
// whatever Game is on — the offline one it keeps itself, or the online one handed to it. The scene
// creates it on mount; the Mode Router pauses and resumes it via setRunning.

const START_RADIUS = radiusForMass(START_MASS);
const MAX_DPR = 2;
/** A frame never simulates more than this — a tab that was in the background does not teleport the cell. */
const MAX_STEP_SECONDS = 0.05;

/** Frame-rate independent easing: the share of the remaining distance covered in `dt`. */
function ease(dt: number, rate: number): number {
  return 1 - Math.exp(-rate * dt);
}

export class Arena {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly offline: OfflineGame;
  private readonly camera: Camera;
  private readonly resizeObserver: ResizeObserver;
  private smoother = new PieceSmoother();
  /** The game the smoother and the camera were last used for. */
  private shown: Game | null = null;
  /** Whether the camera is on the player's cells; off — it jumps to a newborn cell at once. */
  private following = false;
  /** The cursor, in CSS pixels from the canvas's top-left corner; `null` until it first moves. */
  private pointer: Point | null = null;
  /** Bumped by every pointer change, so a finished `steer` does not undo a newer one. */
  private pointerVersion = 0;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private running = false;
  private raf = 0;
  private lastFrame = 0;

  /**
   * `online` — the online arena the player is on right now, if any; it takes over the screen.
   * `look` — the player's skin, RGB nickname and arena background, as their tier allows them.
   */
  constructor(
    private readonly host: HTMLElement,
    private readonly session: Session,
    private readonly online: () => Game | null,
    private readonly look: () => Look,
  ) {
    this.canvas = document.createElement("canvas");
    Object.assign(this.canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      display: "block",
      // A finger steers the cell; it must not scroll or zoom the page.
      touchAction: "none",
    });
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("[sol-mass] 2D canvas is not available");
    this.ctx = ctx;
    host.appendChild(this.canvas);

    this.offline = new OfflineGame(session, look);
    const centre = this.offline.world.size / 2;
    this.camera = { x: centre, y: centre, zoom: 1 };
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
  }

  setRunning(on: boolean): void {
    if (on === this.running) return;
    this.running = on;
    if (on) {
      // On the window, not the canvas: the HUD and the menu lie over the canvas, and the cell must
      // keep following the cursor while it passes over them.
      window.addEventListener("pointermove", this.onPointer);
      window.addEventListener("pointerdown", this.onPointer);
      window.addEventListener("keydown", this.onKey);
      this.lastFrame = performance.now();
      this.raf = requestAnimationFrame(this.frame);
    } else {
      window.removeEventListener("pointermove", this.onPointer);
      window.removeEventListener("pointerdown", this.onPointer);
      window.removeEventListener("keydown", this.onKey);
      cancelAnimationFrame(this.raf);
    }
  }

  /** The player's Split — the Space key, the HUD's button, the agent. */
  split(): void {
    if (this.session.get().phase === "playing") this.game().split();
  }

  /** One still frame, for the platform's "share a shot" button. */
  capture(): Promise<Blob | null> {
    if (this.width === 0 || this.height === 0) return Promise.resolve(null);
    this.draw();
    return new Promise((resolve) => this.canvas.toBlob(resolve, "image/png"));
  }

  /** What is going on, for the agent's debug surface — the canvas shows none of it to the DOM. */
  describe(): Record<string, unknown> {
    const { camera } = this;
    const game = this.game();
    const world = game.world;
    const state = this.session.get();
    // The cell is added and removed on the next frame; between frames the session is what is true.
    const self =
      state.phase === "playing"
        ? world.players.find((player) => player.id === game.selfId)
        : undefined;
    const first = self?.pieces[0];
    const radius = first ? radiusForMass(first.mass) : 0;
    const round = (value: number): number => Math.round(value);
    return {
      running: this.running,
      phase: state.phase,
      online: state.online,
      nickname: state.nickname,
      viewport: { width: this.width, height: this.height },
      camera: {
        x: round(camera.x),
        y: round(camera.y),
        zoom: Number(camera.zoom.toFixed(3)),
      },
      world: {
        size: world.size,
        food: world.food.length,
        // Two devices on one online arena must agree on this.
        foodChecksum: world.food.reduce(
          (sum, food, index) =>
            (sum + (index + 1) * (round(food.x) * 4099 + round(food.y))) % 1_000_000_007,
          0,
        ),
      },
      player:
        self && first
          ? {
              // The first cell; `mass` is the whole player, `cells` every cell after a split.
              x: round(first.x),
              y: round(first.y),
              mass: totalMass(self),
              radius: Number(radius.toFixed(1)),
              speed: Number(speedForRadius(radius).toFixed(1)),
              eaten: self.eaten,
              skin: self.skin,
              rgbName: self.rgbName,
              cells: self.pieces.map((piece) => ({
                x: round(piece.x),
                y: round(piece.y),
                mass: piece.mass,
              })),
            }
          : null,
      bots: world.players
        .filter((player) => player.bot && player.pieces[0])
        .map((bot) => ({
          name: bot.name,
          x: round(bot.pieces[0]?.x ?? 0),
          y: round(bot.pieces[0]?.y ?? 0),
          mass: totalMass(bot),
        })),
      others: world.players
        .filter((player) => !player.bot && player.id !== game.selfId)
        .map((other) => ({
          name: other.name,
          skin: other.skin,
          rgbName: other.rgbName,
          mass: totalMass(other),
          cells: other.pieces.map((piece) => ({
            x: round(piece.x),
            y: round(piece.y),
            mass: piece.mass,
          })),
        })),
      result: state.result,
      record: state.record,
      ...game.describe(),
    };
  }

  /**
   * For the agent: holds the cursor `angleDegrees` from the cell (0 — right, 90 — down) for `ms`,
   * then parks it on the cell. It fills the same `pointer` the mouse does, so the cell moves by the
   * game's own rules.
   */
  steer(angleDegrees: number, ms: number): Promise<void> {
    const angle = (angleDegrees * Math.PI) / 180;
    const reach = Math.min(this.width, this.height) / 2;
    this.setPointer({
      x: this.width / 2 + Math.cos(angle) * reach,
      y: this.height / 2 + Math.sin(angle) * reach,
    });
    const version = this.pointerVersion;
    return new Promise((resolve) => {
      window.setTimeout(() => {
        if (version === this.pointerVersion)
          this.setPointer({ x: this.width / 2, y: this.height / 2 });
        resolve();
      }, ms);
    });
  }

  destroy(): void {
    this.setRunning(false);
    this.resizeObserver.disconnect();
    this.canvas.remove();
  }

  private game(): Game {
    return this.online() ?? this.offline;
  }

  private setPointer(point: Point): void {
    this.pointer = point;
    this.pointerVersion++;
  }

  private readonly onPointer = (event: PointerEvent): void => {
    // A press on a HUD button (Split, Menu) is not a place to go: on a phone the cell would turn
    // toward the button, and Split would shoot at it.
    if (event.target instanceof Element && event.target.closest("button")) return;
    const rect = this.canvas.getBoundingClientRect();
    this.setPointer({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  };

  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      this.session.toMenu();
    } else if (event.code === "Space" && this.session.get().phase === "playing") {
      // Not the page's scroll, and not a "click" on whatever button still has the focus.
      event.preventDefault();
      if (!event.repeat) this.split();
    }
  };

  private resize(): void {
    this.width = this.host.clientWidth;
    this.height = this.host.clientHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    // Resizing clears the canvas; repaint now rather than flash until the next frame.
    this.draw();
  }

  private readonly frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(
      MAX_STEP_SECONDS,
      Math.max(0, (now - this.lastFrame) / 1000),
    );
    this.lastFrame = now;
    this.update(dt, now / 1000);
    this.draw();
  };

  private update(dt: number, time: number): void {
    const { camera } = this;
    const game = this.game();
    if (game !== this.shown) {
      // Another arena: nothing drawn so far belongs to it.
      this.shown = game;
      this.smoother = new PieceSmoother();
      this.following = false;
    }
    game.update(dt, this.pointerInWorld());
    this.smoother.update(game.world, dt, game.smoothing);

    const world = game.world;
    // A small screen sees the same piece of the arena as a large one.
    const fit = Math.min(1.4, Math.max(0.7, Math.min(this.width, this.height) / 640));
    const self = world.players.find((player) => player.id === game.selfId);
    if (self && self.pieces.length > 0) {
      // The camera sits on the centre of mass of the player's cells, as they are drawn.
      let x = 0;
      let y = 0;
      let mass = 0;
      for (const piece of self.pieces) {
        const at = this.smoother.get(piece);
        x += at.x * piece.mass;
        y += at.y * piece.mass;
        mass += piece.mass;
      }
      x /= mass;
      y /= mass;
      if (this.following) {
        camera.x += (x - camera.x) * ease(dt, 12);
        camera.y += (y - camera.y) * ease(dt, 12);
      } else {
        camera.x = x;
        camera.y = y;
        this.following = true;
      }
      const zoom =
        fit * Math.max(MIN_ZOOM, (START_RADIUS / radiusForMass(mass)) ** ZOOM_FALLOFF);
      camera.zoom += (zoom - camera.zoom) * ease(dt, 3);
      return;
    }

    this.following = false;
    if (this.session.get().phase !== "gameover") {
      // Behind the main menu the camera drifts over the arena.
      const centre = world.size / 2;
      const reach = world.size * 0.25;
      camera.x += (centre + Math.cos(time * 0.05) * reach - camera.x) * ease(dt, 1.5);
      camera.y += (centre + Math.sin(time * 0.07) * reach - camera.y) * ease(dt, 1.5);
      camera.zoom += (fit * 0.8 - camera.zoom) * ease(dt, 3);
    }
    // Game over: the camera stays where the cell was swallowed.
  }

  private pointerInWorld(): Point | null {
    const { pointer, camera } = this;
    if (!pointer) return null;
    return {
      x: camera.x + (pointer.x - this.width / 2) / camera.zoom,
      y: camera.y + (pointer.y - this.height / 2) / camera.zoom,
    };
  }

  private draw(): void {
    drawArena(
      this.ctx,
      this.game().world,
      this.camera,
      { width: this.width, height: this.height, dpr: this.dpr },
      this.smoother,
      arenaById(this.look().arena),
      performance.now() / 1000,
    );
  }
}
