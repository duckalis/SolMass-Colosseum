// The wire format of an online arena: what the host and the other players send each other over the
// session's two channels. Binary on purpose — the arena goes out twenty times a second to every
// player, and it has to stay small.
//
//   to the host:   Spawn (rel), Input (fast), Split (rel)
//   from the host: Welcome (rel), Roster (rel), Food (rel), State (fast), Over (rel)
//
// `rel` is ordered and reliable (anything that must not be lost), `fast` is neither (what the next
// message replaces anyway).

export const Msg = {
  Spawn: 1,
  Input: 2,
  Split: 3,
  Welcome: 10,
  Roster: 11,
  Food: 12,
  State: 13,
  Over: 14,
} as const;

/** A pellet as it travels: whole coordinates and an index into FOOD_COLORS. */
export interface FoodWire {
  x: number;
  y: number;
  color: number;
}

export interface FoodChangeWire extends FoodWire {
  /** Which pellet of the arena's list this one replaces. */
  index: number;
}

export interface RosterEntryWire {
  /** The player's number in State messages. */
  slot: number;
  /** Index into SKINS. */
  skin: number;
  /** The name shimmers through the rainbow. */
  rgbName: boolean;
  id: string;
  name: string;
}

export interface PieceWire {
  id: number;
  x: number;
  y: number;
  mass: number;
  /** Whole seconds until the piece may merge back (0 — it may). */
  mergeIn: number;
}

export interface PlayerStateWire {
  slot: number;
  pieces: PieceWire[];
}

export type Message =
  /**
   * "Put me on the arena", and how I look on it: `deaths` — how many times this player knows it was
   * swallowed, `skin` — an index into SKINS.
   */
  | {
      type: typeof Msg.Spawn;
      deaths: number;
      skin: number;
      rgbName: boolean;
      name: string;
    }
  /** Where the player's cursor is, in world coordinates; `null` — nowhere. */
  | { type: typeof Msg.Input; target: { x: number; y: number } | null }
  | { type: typeof Msg.Split }
  /** The whole arena for a newcomer: its size, its food, and who the newcomer is on it. */
  | {
      type: typeof Msg.Welcome;
      size: number;
      slot: number;
      deaths: number;
      food: FoodWire[];
    }
  | { type: typeof Msg.Roster; players: RosterEntryWire[] }
  | { type: typeof Msg.Food; changes: FoodChangeWire[] }
  /** Every cell on the arena. `tick` only grows: an older State that arrives late is dropped. */
  | { type: typeof Msg.State; tick: number; players: PlayerStateWire[] }
  /** "You were swallowed": the final mass, by whom, and this player's death count. */
  | { type: typeof Msg.Over; mass: number; deaths: number; by: string };

const text = new TextEncoder();
const untext = new TextDecoder();

class Writer {
  private bytes: Uint8Array;
  private view: DataView;
  private at = 0;

  constructor(size: number) {
    this.bytes = new Uint8Array(size);
    this.view = new DataView(this.bytes.buffer);
  }

  private room(extra: number): void {
    if (this.at + extra <= this.bytes.length) return;
    const grown = new Uint8Array(Math.max(this.bytes.length * 2, this.at + extra));
    grown.set(this.bytes);
    this.bytes = grown;
    this.view = new DataView(grown.buffer);
  }

  u8(value: number): this {
    this.room(1);
    this.view.setUint8(this.at, value);
    this.at += 1;
    return this;
  }

  u16(value: number): this {
    this.room(2);
    this.view.setUint16(this.at, value, true);
    this.at += 2;
    return this;
  }

  u32(value: number): this {
    this.room(4);
    this.view.setUint32(this.at, value, true);
    this.at += 4;
    return this;
  }

  f32(value: number): this {
    this.room(4);
    this.view.setFloat32(this.at, value, true);
    this.at += 4;
    return this;
  }

  /** A string of up to 255 bytes of UTF-8. */
  str(value: string): this {
    let encoded = text.encode(value);
    if (encoded.length > 255) encoded = encoded.subarray(0, 255);
    this.u8(encoded.length);
    this.room(encoded.length);
    this.bytes.set(encoded, this.at);
    this.at += encoded.length;
    return this;
  }

  done(): Uint8Array {
    return this.bytes.subarray(0, this.at);
  }
}

class Reader {
  private readonly view: DataView;
  private at = 0;

  constructor(private readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  u8(): number {
    const value = this.view.getUint8(this.at);
    this.at += 1;
    return value;
  }

  u16(): number {
    const value = this.view.getUint16(this.at, true);
    this.at += 2;
    return value;
  }

  u32(): number {
    const value = this.view.getUint32(this.at, true);
    this.at += 4;
    return value;
  }

  f32(): number {
    const value = this.view.getFloat32(this.at, true);
    this.at += 4;
    return value;
  }

  str(): string {
    const length = this.u8();
    const value = untext.decode(this.bytes.subarray(this.at, this.at + length));
    this.at += length;
    return value;
  }
}

const coordinate = (value: number): number =>
  Math.max(0, Math.min(0xffff, Math.round(value)));

export function encode(message: Message): Uint8Array {
  switch (message.type) {
    case Msg.Spawn:
      return new Writer(40)
        .u8(Msg.Spawn)
        .u16(message.deaths)
        .u8(message.skin)
        .u8(message.rgbName ? 1 : 0)
        .str(message.name)
        .done();
    case Msg.Input: {
      const { target } = message;
      return new Writer(10)
        .u8(Msg.Input)
        .u8(target ? 1 : 0)
        .f32(target?.x ?? 0)
        .f32(target?.y ?? 0)
        .done();
    }
    case Msg.Split:
      return new Writer(1).u8(Msg.Split).done();
    case Msg.Welcome: {
      const out = new Writer(8 + message.food.length * 5)
        .u8(Msg.Welcome)
        .u16(message.size)
        .u8(message.slot)
        .u16(message.deaths)
        .u16(message.food.length);
      for (const food of message.food)
        out.u16(coordinate(food.x)).u16(coordinate(food.y)).u8(food.color);
      return out.done();
    }
    case Msg.Roster: {
      const out = new Writer(2 + message.players.length * 48)
        .u8(Msg.Roster)
        .u8(message.players.length);
      for (const player of message.players)
        out
          .u8(player.slot)
          .u8(player.skin)
          .u8(player.rgbName ? 1 : 0)
          .str(player.id)
          .str(player.name);
      return out.done();
    }
    case Msg.Food: {
      const out = new Writer(3 + message.changes.length * 7)
        .u8(Msg.Food)
        .u16(message.changes.length);
      for (const change of message.changes)
        out
          .u16(change.index)
          .u16(coordinate(change.x))
          .u16(coordinate(change.y))
          .u8(change.color);
      return out.done();
    }
    case Msg.State: {
      const out = new Writer(6 + message.players.length * 32)
        .u8(Msg.State)
        .u32(message.tick)
        .u8(message.players.length);
      for (const player of message.players) {
        out.u8(player.slot).u8(player.pieces.length);
        for (const piece of player.pieces)
          out
            .u16(piece.id)
            .f32(piece.x)
            .f32(piece.y)
            .u32(Math.max(0, Math.round(piece.mass)))
            .u8(Math.max(0, Math.min(255, Math.ceil(piece.mergeIn))));
      }
      return out.done();
    }
    case Msg.Over:
      return new Writer(40)
        .u8(Msg.Over)
        .u32(Math.max(0, Math.round(message.mass)))
        .u16(message.deaths)
        .str(message.by)
        .done();
  }
}

/** `null` — not a message of this protocol (truncated, or from a newer build): ignore it. */
export function decode(bytes: Uint8Array): Message | null {
  try {
    const input = new Reader(bytes);
    const type = input.u8();
    switch (type) {
      case Msg.Spawn:
        return {
          type,
          deaths: input.u16(),
          skin: input.u8(),
          rgbName: input.u8() === 1,
          name: input.str(),
        };
      case Msg.Input: {
        const has = input.u8() === 1;
        const x = input.f32();
        const y = input.f32();
        return { type, target: has ? { x, y } : null };
      }
      case Msg.Split:
        return { type };
      case Msg.Welcome: {
        const size = input.u16();
        const slot = input.u8();
        const deaths = input.u16();
        const food: FoodWire[] = [];
        for (let left = input.u16(); left > 0; left--)
          food.push({ x: input.u16(), y: input.u16(), color: input.u8() });
        return { type, size, slot, deaths, food };
      }
      case Msg.Roster: {
        const players: RosterEntryWire[] = [];
        for (let left = input.u8(); left > 0; left--)
          players.push({
            slot: input.u8(),
            skin: input.u8(),
            rgbName: input.u8() === 1,
            id: input.str(),
            name: input.str(),
          });
        return { type, players };
      }
      case Msg.Food: {
        const changes: FoodChangeWire[] = [];
        for (let left = input.u16(); left > 0; left--)
          changes.push({
            index: input.u16(),
            x: input.u16(),
            y: input.u16(),
            color: input.u8(),
          });
        return { type, changes };
      }
      case Msg.State: {
        const tick = input.u32();
        const players: PlayerStateWire[] = [];
        for (let left = input.u8(); left > 0; left--) {
          const slot = input.u8();
          const pieces: PieceWire[] = [];
          for (let count = input.u8(); count > 0; count--)
            pieces.push({
              id: input.u16(),
              x: input.f32(),
              y: input.f32(),
              mass: input.u32(),
              mergeIn: input.u8(),
            });
          players.push({ slot, pieces });
        }
        return { type, tick, players };
      }
      case Msg.Over:
        return { type, mass: input.u32(), deaths: input.u16(), by: input.str() };
      default:
        return null;
    }
  } catch {
    // A DataView read past the end throws: the message was cut short.
    return null;
  }
}
