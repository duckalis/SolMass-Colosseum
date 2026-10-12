import type { RealtimeSession } from "@idosgames/core/realtime";
import { DEFAULT_SKIN, SKINS, type Look } from "../data/cosmetics";
import { FOOD_COLORS, FOOD_RADIUS, ONLINE_SEND_HZ } from "../data/tuning";
import {
  newPiece,
  totalMass,
  type Food,
  type Player,
  type Point,
  type World,
} from "../game/cells";
import type { Game } from "../game/Game";
import type { Session } from "../game/session";
import {
  addPlayer,
  createWorld,
  removePlayer,
  spawnPlayer,
  splitPlayer,
  stepWorld,
} from "../game/world";
import { decode, encode, Msg, type Message } from "./protocol";
import { startTicker } from "./ticker";

// An online arena. One player's device — the room's HOST — runs the arena: it simulates every
// player's cells and the food with the same world.ts an offline round uses (no bots), and sends
// the result to the others twenty times a second. Everybody else sends the host their cursor and
// their Split presses, and draws what comes back.
//
// Every device keeps the whole arena in a `World`, the host's being the real one. That is what
// lets the arena outlive its host: when the host leaves, the room's next host simply starts
// simulating the copy it already has.

const SEND_SECONDS = 1 / ONLINE_SEND_HZ;
/** How fast a drawn cell chases the position that came from the host, per second. */
const CLIENT_SMOOTHING = 14;
/** The host never simulates more than this in one go (a tab back from a long sleep). */
const MAX_CATCH_UP_SECONDS = 0.5;
const STEP_SECONDS = 0.05;
/**
 * A player whose link dropped keeps its cells this long, in case the link comes back — long enough
 * for everybody to link to a new host after a takeover, which goes through the server's signaling.
 */
const LINK_GRACE_MS = 20_000;
/** A newcomer that still has no arena after this gives up on the room. */
const CONNECT_TIMEOUT_MS = 40_000;
/** A spawn request that got no cell is asked again after this. */
const SPAWN_RETRY_MS = 3_000;
/**
 * With no link to the host for this long, a player may take the arena over — the server allows it
 * once the host has been silent for the title's MemberTimeoutMs (15 s by default).
 */
const TAKE_OVER_AFTER_MS = 17_000;
const TAKE_OVER_RETRY_MS = 5_000;

export class OnlineGame implements Game {
  world: World;
  readonly selfId: string;
  smoothing = CLIENT_SMOOTHING;

  private role: "host" | "client";
  /** The player's number in State messages, by player id — assigned by the host. */
  private readonly slots = new Map<string, number>();
  private target: Point | null = null;
  private lastAdvance = performance.now();
  private sinceSend = 0;
  private tick = 0;
  private ended = false;
  private readonly cleanup: Array<() => void> = [];

  // The host's books.
  /** How many times each player was swallowed — a spawn request must know the latest one. */
  private readonly deaths = new Map<string, number>();
  /** When a player's link dropped (ms), for the grace period. */
  private readonly unlinkedAt = new Map<string, number>();
  /** Players the others have been told about. */
  private readonly rostered = new Set<string>();

  // A client's books.
  /** The host has sent the arena. */
  private welcomed = false;
  private deathsSeen = 0;
  private lastTick = -1;
  private spawnAskedAt = 0;
  /** Since when there is no link to the host (ms); 0 — there is one. */
  private hostLostAt = performance.now();
  private takeOverTriedAt = 0;
  private readonly joinedAt = performance.now();

  /**
   * `look` — how this player looks right now (what their tier allows of their picks). `onEnded` —
   * the arena is over for this player: the room closed, the player was removed from it, or
   * (`reached: false`) its host could never be reached.
   */
  constructor(
    private readonly rt: RealtimeSession,
    private readonly session: Session,
    private readonly look: () => Look,
    private readonly onEnded: (reason: string, reached: boolean) => void,
  ) {
    this.selfId = rt.selfId;
    this.world = createWorld();
    this.role = "client";
    if (rt.isHost) {
      this.becomeHost(false);
    } else {
      // Nothing to draw until the host sends its arena.
      this.world.food = [];
    }

    this.cleanup.push(
      rt.on("peerOpen", ({ peerId }) => this.onPeerOpen(peerId)),
      rt.on("peerClose", ({ peerId }) => this.onPeerClose(peerId)),
      rt.on("memberLeft", ({ userId }) => this.onMemberLeft(userId)),
      rt.on("message", ({ from, data }) => this.onMessage(from, data)),
      rt.on("hostChanged", ({ hostId }) => this.onHostChanged(hostId)),
      rt.on("roomClosed", () => this.end("The arena was closed")),
      rt.on("removed", () => this.end("You are no longer on the arena")),
      // While the tab is hidden nothing calls update(): the host's arena must go on regardless.
      startTicker(STEP_SECONDS * 1000, () => {
        if (document.hidden) this.advance();
      }),
    );
  }

  // ── Game ───────────────────────────────────────────────────────────────────────────────────

  update(_dtSeconds: number, target: Point | null): void {
    this.target = target;
    this.advance();
  }

  split(): void {
    if (this.role === "host") {
      const me = this.self();
      if (me) splitPlayer(this.world, me);
    } else {
      this.toHost("rel", { type: Msg.Split });
    }
  }

  describe(): Record<string, unknown> {
    const host = this.rt.hostId;
    return {
      mode: "online",
      role: this.role,
      room: this.rt.roomId,
      members: this.rt.members.size,
      links: this.rt.openPeers().length,
      hostRttMs:
        this.role === "client" ? (this.rt.linkStats(host)?.rttMs ?? null) : null,
    };
  }

  get roomId(): string {
    return this.rt.roomId;
  }

  /** Leaves the arena: the room learns at once, and the host role passes on if this was the host. */
  dispose(): void {
    if (this.ended) return;
    this.ended = true;
    for (const stop of this.cleanup) stop();
    void this.rt.leave();
  }

  // ── The beat ───────────────────────────────────────────────────────────────────────────────

  private advance(): void {
    if (this.ended) return;
    const now = performance.now();
    const elapsed = Math.min(
      MAX_CATCH_UP_SECONDS,
      Math.max(0, (now - this.lastAdvance) / 1000),
    );
    this.lastAdvance = now;
    if (this.role === "host") this.advanceHost(elapsed, now);
    else this.advanceClient(elapsed, now);

    const me = this.self();
    if (me && me.pieces.length > 0) this.session.setMass(totalMass(me));
    // Mid-round with no host to listen to: its link dropped, or the arena is changing hands.
    const waiting =
      this.role === "client" &&
      this.session.get().phase !== "connecting" &&
      (this.hostLostAt > 0 || !this.welcomed);
    this.session.setArena(
      this.world.players.length,
      waiting ? "Reconnecting…" : null,
    );
  }

  private advanceHost(elapsed: number, now: number): void {
    const world = this.world;
    const me = this.self() ?? this.admitSelf();
    me.target = this.target;
    // The local player's own "Play" / "Play again": a cell whenever the round is on and there is none.
    if (this.session.get().phase === "playing" && me.pieces.length === 0) {
      const { skin, rgbName } = this.look();
      this.dress(me, this.session.get().nickname, skin, rgbName);
      spawnPlayer(world, me);
    }

    for (const [id, at] of this.unlinkedAt) {
      if (now - at > LINK_GRACE_MS) this.dismiss(id);
    }

    for (let left = elapsed; left > 1e-6; left -= STEP_SECONDS) {
      for (const death of stepWorld(world, Math.min(left, STEP_SECONDS))) {
        const count = (this.deaths.get(death.playerId) ?? 0) + 1;
        this.deaths.set(death.playerId, count);
        const mass = Math.floor(death.mass);
        if (death.playerId === this.selfId)
          this.session.finish({ mass, eatenBy: death.by });
        else
          this.rt.send(
            death.playerId,
            "rel",
            encode({ type: Msg.Over, mass, deaths: count, by: death.by }),
          );
      }
    }

    this.sinceSend += elapsed;
    if (this.sinceSend < SEND_SECONDS) return;
    this.sinceSend = 0;
    const log = world.foodLog;
    if (log && log.length > 0) {
      this.rt.broadcast(
        "rel",
        encode({
          type: Msg.Food,
          changes: log.map((index) => {
            const food = world.food[index] as Food;
            return { index, x: food.x, y: food.y, color: foodColor(food) };
          }),
        }),
      );
      log.length = 0;
    }
    this.rt.broadcast(
      "fast",
      encode({
        type: Msg.State,
        tick: ++this.tick,
        players: world.players.map((player) => ({
          slot: this.slots.get(player.id) ?? 0,
          pieces: player.pieces.map((piece) => ({
            id: piece.id,
            x: piece.x,
            y: piece.y,
            mass: piece.mass,
            mergeIn: Math.max(0, piece.mergeAt - world.time),
          })),
        })),
      }),
    );
  }

  private advanceClient(elapsed: number, now: number): void {
    // Not simulated here — but the clock runs, so merge times mean the same if this device
    // becomes the host.
    this.world.time += elapsed;

    const linked = this.rt.isOpen(this.rt.hostId);
    if (linked) this.hostLostAt = 0;
    else if (this.hostLostAt === 0) this.hostLostAt = now;
    if (!linked) {
      if (
        this.session.get().phase === "connecting" &&
        now - this.joinedAt > CONNECT_TIMEOUT_MS
      )
        this.end("Could not reach the arena", false);
      else this.maybeTakeOver(now);
      return;
    }
    if (!this.welcomed) return;

    const me = this.self();
    const alive = me !== undefined && me.pieces.length > 0;
    if (alive) this.spawnAskedAt = 0;
    // "Play Online" and "Play again" alike: a round is on, there is no cell — ask the host for one.
    if (
      !alive &&
      this.session.get().phase === "playing" &&
      now - this.spawnAskedAt > SPAWN_RETRY_MS
    ) {
      this.spawnAskedAt = now;
      const { skin, rgbName } = this.look();
      this.toHost("rel", {
        type: Msg.Spawn,
        deaths: this.deathsSeen,
        skin: Math.max(0, SKINS.findIndex((entry) => entry.id === skin)),
        rgbName,
        name: this.session.get().nickname.trim(),
      });
    }

    this.sinceSend += elapsed;
    if (this.sinceSend < SEND_SECONDS) return;
    this.sinceSend = 0;
    this.toHost("fast", { type: Msg.Input, target: this.target });
  }

  // ── The session's events ───────────────────────────────────────────────────────────────────

  private onPeerOpen(peerId: string): void {
    if (this.role !== "host") return;
    this.unlinkedAt.delete(peerId);
    // The newcomer gets the whole arena; whoever was here before it gets it again after a
    // reconnect, or after this device took the arena over.
    const world = this.world;
    this.rt.send(
      peerId,
      "rel",
      encode({
        type: Msg.Welcome,
        size: world.size,
        slot: this.slotOf(peerId),
        deaths: this.deaths.get(peerId) ?? 0,
        food: world.food.map((food) => ({
          x: food.x,
          y: food.y,
          color: foodColor(food),
        })),
      }),
    );
    this.rt.send(peerId, "rel", this.roster());
    this.nameSuccessor();
  }

  private onPeerClose(peerId: string): void {
    if (this.role !== "host") return;
    // The link may come back by itself; until the grace runs out the cells stay where they are.
    const player = this.world.players.find((p) => p.id === peerId);
    if (!player) return;
    player.target = null;
    this.unlinkedAt.set(peerId, performance.now());
    this.nameSuccessor();
  }

  private onMemberLeft(userId: string): void {
    if (this.role === "host") this.dismiss(userId);
  }

  private onHostChanged(hostId: string): void {
    if (hostId === this.selfId) {
      if (this.role !== "host") this.becomeHost(true);
      return;
    }
    // Somebody else runs the arena now: wait for its Welcome on the new link.
    this.welcomed = false;
    this.lastTick = -1;
  }

  private onMessage(from: string, data: Uint8Array): void {
    const message = decode(data);
    if (!message) return;
    if (this.role === "host") this.fromPlayer(from, message);
    else if (from === this.rt.hostId) this.fromHost(message);
  }

  // ── Host: what the players say ─────────────────────────────────────────────────────────────

  private fromPlayer(id: string, message: Message): void {
    const world = this.world;
    switch (message.type) {
      case Msg.Spawn: {
        // A request that does not know about the player's latest death was sent before the player
        // learned of it — the cell it asks for would appear behind the Game Over screen.
        if (message.deaths !== (this.deaths.get(id) ?? 0)) return;
        const player = world.players.find((p) => p.id === id) ?? this.admit(id);
        // The look is the player's own word: the host has no way to see their wallet.
        this.dress(
          player,
          message.name,
          (SKINS[message.skin] ?? DEFAULT_SKIN).id,
          message.rgbName,
        );
        if (player.pieces.length === 0) spawnPlayer(world, player);
        return;
      }
      case Msg.Input: {
        const player = world.players.find((p) => p.id === id);
        if (player) player.target = message.target;
        return;
      }
      case Msg.Split: {
        const player = world.players.find((p) => p.id === id);
        if (player) splitPlayer(world, player);
        return;
      }
      default:
        return;
    }
  }

  /** Puts a player on the books: no cell yet, no name or look either (see dress). */
  private admit(id: string): Player {
    const player = addPlayer(this.world, id, "");
    this.slotOf(id);
    return player;
  }

  private admitSelf(): Player {
    const me = this.admit(this.selfId);
    const { skin, rgbName } = this.look();
    this.dress(me, this.session.get().nickname, skin, rgbName);
    return me;
  }

  /** Gives a player its name and look, and tells everybody if anything of it is new. */
  private dress(player: Player, name: string, skin: string, rgbName: boolean): void {
    const trimmed = name.trim();
    if (
      player.name === trimmed &&
      player.skin === skin &&
      player.rgbName === rgbName &&
      this.rostered.has(player.id)
    )
      return;
    player.name = trimmed;
    player.skin = skin;
    player.rgbName = rgbName;
    this.rostered.add(player.id);
    this.rt.broadcast("rel", this.roster());
  }

  /** Takes a player off the arena for good. */
  private dismiss(id: string): void {
    this.unlinkedAt.delete(id);
    this.deaths.delete(id);
    this.rostered.delete(id);
    if (!this.world.players.some((p) => p.id === id)) {
      this.slots.delete(id);
      return;
    }
    removePlayer(this.world, id);
    this.slots.delete(id);
    this.rt.broadcast("rel", this.roster());
    this.nameSuccessor();
  }

  private slotOf(id: string): number {
    const known = this.slots.get(id);
    if (known !== undefined) return known;
    const taken = new Set(this.slots.values());
    let slot = 0;
    while (taken.has(slot)) slot++;
    this.slots.set(id, slot);
    return slot;
  }

  private roster(): Uint8Array {
    return encode({
      type: Msg.Roster,
      players: this.world.players.map((player) => ({
        slot: this.slotOf(player.id),
        skin: Math.max(0, SKINS.findIndex((entry) => entry.id === player.skin)),
        rgbName: player.rgbName,
        id: player.id,
        name: player.name,
      })),
    });
  }

  /** Who takes the arena over if this host leaves: any player with a live link. */
  private nameSuccessor(): void {
    this.rt.setSuccessor(this.rt.openPeers()[0] ?? null);
  }

  /**
   * This device runs the arena from now on. `inherited` — it takes over the copy it has been
   * drawing; otherwise it opens a fresh arena.
   */
  private becomeHost(inherited: boolean): void {
    const world = this.world;
    this.role = "host";
    this.smoothing = Infinity;
    this.hostLostAt = 0;
    this.sinceSend = 0;
    world.foodLog = [];
    this.deaths.clear();
    this.unlinkedAt.clear();
    this.rostered.clear();

    if (inherited && this.welcomed) {
      // The previous host is gone, and so are its cells.
      const members = this.rt.members;
      world.players = world.players.filter(
        (player) => player.id === this.selfId || members.has(player.id),
      );
      let top = 0;
      const now = performance.now();
      for (const player of world.players) {
        // Their cursors arrive again once their links to this device open.
        player.target = null;
        if (player.id !== this.selfId) this.unlinkedAt.set(player.id, now);
        // Everybody already knows them, from the previous host's roster.
        this.rostered.add(player.id);
        for (const piece of player.pieces) top = Math.max(top, piece.id);
      }
      for (const id of [...this.slots.keys()]) {
        if (!world.players.some((player) => player.id === id)) this.slots.delete(id);
      }
      world.nextPieceId = (top % 0xffff) + 1;
    } else {
      // Nothing to inherit (the host vanished before it sent its arena): start a new one.
      this.world = createWorld();
      this.world.foodLog = [];
      this.slots.clear();
    }
    this.welcomed = true;
    if (!this.self()) this.admitSelf();
    this.session.connected();
    this.rt.broadcast("rel", this.roster());
    this.nameSuccessor();
  }

  // ── Client: what the host says ─────────────────────────────────────────────────────────────

  private fromHost(message: Message): void {
    const world = this.world;
    switch (message.type) {
      case Msg.Welcome: {
        world.size = message.size;
        world.food = message.food.map((food) => ({
          x: food.x,
          y: food.y,
          radius: FOOD_RADIUS,
          color: FOOD_COLORS[food.color] ?? FOOD_COLORS[0],
        }));
        this.slots.set(this.selfId, message.slot);
        this.deathsSeen = message.deaths;
        this.welcomed = true;
        this.lastTick = -1;
        this.spawnAskedAt = 0;
        this.session.connected();
        return;
      }
      case Msg.Roster: {
        const listed = new Set<string>();
        for (const entry of message.players) {
          listed.add(entry.id);
          this.slots.set(entry.id, entry.slot);
          const skin = (SKINS[entry.skin] ?? DEFAULT_SKIN).id;
          const player = world.players.find((p) => p.id === entry.id);
          if (player) {
            player.name = entry.name;
            player.skin = skin;
            player.rgbName = entry.rgbName;
          } else {
            addPlayer(world, entry.id, entry.name, skin, entry.rgbName);
          }
        }
        world.players = world.players.filter((player) => listed.has(player.id));
        for (const id of [...this.slots.keys()]) {
          if (!listed.has(id)) this.slots.delete(id);
        }
        return;
      }
      case Msg.Food: {
        for (const change of message.changes) {
          if (change.index >= world.food.length) continue;
          world.food[change.index] = {
            x: change.x,
            y: change.y,
            radius: FOOD_RADIUS,
            color: FOOD_COLORS[change.color] ?? FOOD_COLORS[0],
          };
        }
        return;
      }
      case Msg.State: {
        // `fast` keeps no order: a State older than the one already shown is of no use.
        if (message.tick <= this.lastTick) return;
        this.lastTick = message.tick;
        const bySlot = new Map<number, Player>();
        for (const player of world.players) {
          const slot = this.slots.get(player.id);
          if (slot !== undefined) bySlot.set(slot, player);
        }
        for (const entry of message.players) {
          const player = bySlot.get(entry.slot);
          // Not in the roster yet: the Roster travels on the other channel and is on its way.
          if (!player) continue;
          player.pieces = entry.pieces.map((wire) => {
            const piece =
              player.pieces.find((p) => p.id === wire.id) ??
              newPiece(world, wire.x, wire.y, wire.mass);
            piece.id = wire.id;
            piece.x = wire.x;
            piece.y = wire.y;
            piece.mass = wire.mass;
            piece.mergeAt = world.time + wire.mergeIn;
            return piece;
          });
        }
        return;
      }
      case Msg.Over: {
        this.deathsSeen = message.deaths;
        this.spawnAskedAt = 0;
        const me = this.self();
        if (me) me.pieces = [];
        this.session.finish({ mass: message.mass, eatenBy: message.by });
        return;
      }
      default:
        return;
    }
  }

  private toHost(channel: "rel" | "fast", message: Message): void {
    this.rt.send(this.rt.hostId, channel, encode(message));
  }

  /**
   * The host has been out of reach for a while: one of the players takes the arena over. The one
   * with the smallest id goes first, the others a little later in case that one is gone too.
   */
  private maybeTakeOver(now: number): void {
    const silent = now - this.hostLostAt;
    if (silent < TAKE_OVER_AFTER_MS) return;
    if (now - this.takeOverTriedAt < TAKE_OVER_RETRY_MS) return;
    const candidates = [...this.rt.members.keys()]
      .filter((id) => id !== this.rt.hostId)
      .sort();
    const first = candidates[0] === this.selfId;
    if (!first && silent < TAKE_OVER_AFTER_MS + TAKE_OVER_RETRY_MS * 2) return;
    this.takeOverTriedAt = now;
    void this.rt.claimHost().then((res) => {
      // "The host is still active." — it is only this device's link that is down; keep waiting.
      if (res.ok && !this.ended && this.rt.isHost && this.role !== "host")
        this.becomeHost(true);
    });
  }

  private self(): Player | undefined {
    return this.world.players.find((player) => player.id === this.selfId);
  }

  private end(reason: string, reached = true): void {
    if (this.ended) return;
    this.ended = true;
    for (const stop of this.cleanup) stop();
    void this.rt.leave();
    this.onEnded(reason, reached);
  }
}

function foodColor(food: Food): number {
  return Math.max(0, (FOOD_COLORS as readonly string[]).indexOf(food.color));
}
