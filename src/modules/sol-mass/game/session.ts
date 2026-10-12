import { NICKNAME_MAX } from "../data/tuning";

// What the screens and the arena share: which screen is on, the nickname, the mass shown in the
// HUD, how the last round ended, whether the round is online. Created once in setup(), before the
// scene exists — the menu renders first and the arena picks the state up when it mounts, so
// neither side waits for the other.

export type Phase = "menu" | "connecting" | "playing" | "gameover";

/** How a round ended. */
export interface RoundResult {
  /** The player's mass when the last cell was swallowed. */
  mass: number;
  /** Name of the bot or player that swallowed it. */
  eatenBy: string;
}

/** Where the round's result stands with the global leaderboard. */
export type RecordState =
  | { status: "saving" }
  /** `best` — the player's record after this round, as the server keeps it. */
  | { status: "saved"; best: number }
  | { status: "failed"; error: string }
  /** The title has no leaderboard to send it to. */
  | { status: "off" };

export interface SessionState {
  phase: Phase;
  nickname: string;
  /** Whole mass of the player's cells, 0 outside a round. */
  mass: number;
  /** Set on the game-over screen. */
  result: RoundResult | null;
  record: RecordState | null;
  /** The round is on a shared arena with other players — from "connecting" until the menu. */
  online: boolean;
  /** Players on that arena, this one included. */
  players: number;
  /** What the connection is doing, when the player should know ("Reconnecting…"). */
  notice: string | null;
}

export interface Session {
  get(): SessionState;
  subscribe(listener: () => void): () => void;
  setNickname(nickname: string): void;
  /**
   * Starts a round. From the main menu — offline, against bots; from the game-over screen — again
   * where the last one was (the same online arena, if it was online).
   */
  play(): void;
  /** Main menu → looking for an online arena ("connecting"). */
  playOnline(): void;
  /** Called by the network side once the player is on the arena: "connecting" → "playing". */
  connected(): void;
  /** Back to the main menu; the current cell is gone, an online arena is left. */
  toMenu(): void;
  /** Called by the arena as the cell grows. */
  setMass(mass: number): void;
  /** Called by the arena when the player's last cell is swallowed. */
  finish(result: RoundResult): void;
  /** Leaderboard status of `result`; ignored if another round has started since. */
  setRecord(result: RoundResult, record: RecordState): void;
  /** Called by the network side: who is on the arena, and what the connection is doing. */
  setArena(players: number, notice: string | null): void;
}

export function createSession(nickname = ""): Session {
  let state: SessionState = {
    phase: "menu",
    nickname: nickname.slice(0, NICKNAME_MAX),
    mass: 0,
    result: null,
    record: null,
    online: false,
    players: 0,
    notice: null,
  };
  const listeners = new Set<() => void>();

  // A new object per change: useSyncExternalStore compares snapshots by identity.
  const update = (patch: Partial<SessionState>): void => {
    state = { ...state, ...patch };
    for (const listener of [...listeners]) listener();
  };

  return {
    get: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setNickname(next) {
      const trimmed = next.slice(0, NICKNAME_MAX);
      if (trimmed !== state.nickname) update({ nickname: trimmed });
    },
    play() {
      if (state.phase === "menu")
        update({ phase: "playing", mass: 0, result: null, record: null, online: false });
      else if (state.phase === "gameover")
        update({ phase: "playing", mass: 0, result: null, record: null });
    },
    playOnline() {
      if (state.phase === "menu")
        update({ phase: "connecting", online: true, players: 0, notice: null });
    },
    connected() {
      if (state.phase === "connecting")
        update({ phase: "playing", mass: 0, result: null, record: null });
    },
    toMenu() {
      if (state.phase !== "menu")
        update({
          phase: "menu",
          mass: 0,
          result: null,
          record: null,
          online: false,
          players: 0,
          notice: null,
        });
    },
    setMass(mass) {
      const whole = Math.floor(mass);
      if (state.phase === "playing" && whole !== state.mass)
        update({ mass: whole });
    },
    finish(result) {
      if (state.phase === "playing")
        update({ phase: "gameover", mass: 0, result, record: null });
    },
    setRecord(result, record) {
      if (state.result === result) update({ record });
    },
    setArena(players, notice) {
      if (!state.online) return;
      if (players !== state.players || notice !== state.notice)
        update({ players, notice });
    },
  };
}
