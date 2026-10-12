import type { IDosGamesClient } from "@idosgames/core";
import { RealtimeSession } from "@idosgames/core/realtime";
import { ONLINE_MAX_PLAYERS } from "../data/tuning";

// "Play Online" is one press: the player lands on an arena that already has people, or opens a new
// one for the next player to find. Rooms and their WebRTC links are the engine's (client.multiplayer
// and RealtimeSession); this only picks the room.

/** The mode the arenas' rooms are created with — how this game tells its rooms from any other. */
export const ARENA_MODE = "sol-mass";

const ROOM_NAME = "SolMass arena";
/** Room lifecycle calls tolerate less back-to-back traffic than anything else on the server. */
const BETWEEN_CALLS_MS = 700;

export type ArenaResult =
  | { ok: true; session: RealtimeSession }
  | { ok: false; error: string };

const pause = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A player is in one room at a time, and a tab that died without leaving still holds its place:
 * "You are already in room {id}. Leave it first." Leaves that room; `true` — worth retrying.
 */
async function leaveStaleRoom(
  client: IDosGamesClient,
  error: string,
): Promise<boolean> {
  const stale = /already in room (\S+?)\.? /i.exec(`${error} `)?.[1];
  if (!stale) return false;
  await client.multiplayer.leaveRoom(stale);
  await pause(BETWEEN_CALLS_MS);
  return true;
}

/**
 * Joins the fullest open arena, or opens a new one. `avoid` — rooms not to try again (their host
 * could not be reached from this device).
 */
export async function joinArena(
  client: IDosGamesClient,
  avoid: ReadonlySet<string>,
): Promise<ArenaResult> {
  const listed = await client.multiplayer.listRooms(0, 50);
  if (!listed.ok) return { ok: false, error: listed.error };

  const open = (listed.data.Rooms ?? [])
    .filter(
      (room) =>
        room.Mode === ARENA_MODE &&
        room.RoomID &&
        !avoid.has(room.RoomID) &&
        (room.MemberCount ?? 0) < (room.MaxPlayers ?? 0),
    )
    // The fullest first: players gather on one arena instead of spreading thin.
    .sort((a, b) => (b.MemberCount ?? 0) - (a.MemberCount ?? 0));

  let left = false;
  for (const room of open.slice(0, 3)) {
    const roomID = room.RoomID as string;
    let joined = await RealtimeSession.join(client, roomID);
    if (!joined.ok && !left && (await leaveStaleRoom(client, joined.error))) {
      left = true;
      joined = await RealtimeSession.join(client, roomID);
    }
    if (joined.ok) return { ok: true, session: joined.data };
    // Full or closed by now — try the next one.
    await pause(BETWEEN_CALLS_MS);
  }

  const create = (): ReturnType<typeof RealtimeSession.create> =>
    RealtimeSession.create(client, ROOM_NAME, {
      // A star: everyone links to the host, which runs the arena.
      topology: "Host",
      chatMode: "P2P",
      maxPlayers: ONLINE_MAX_PLAYERS,
      visibility: "Public",
      mode: ARENA_MODE,
    });
  let created = await create();
  if (!created.ok && !left && (await leaveStaleRoom(client, created.error)))
    created = await create();
  return created.ok
    ? { ok: true, session: created.data }
    : { ok: false, error: created.error };
}
