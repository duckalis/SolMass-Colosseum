import type {
  IDosGamesClient,
  LeaderboardDefinitions,
} from "@idosgames/core";
import type { RecordState } from "./game/session";

/**
 * The global all-time top: every player's best final mass. The board itself is the title's data
 * (Leaderboard config: BestScore, never reset, no brackets) — not something this code creates.
 */
export const LEADERBOARD_ID = "top_mass";

function hasLeaderboard(client: IDosGamesClient): boolean {
  const board =
    client.data.config.getSection<LeaderboardDefinitions>("Leaderboard")
      ?.Definitions?.[LEADERBOARD_ID];
  return board != null && board.IsEnabled !== false;
}

/**
 * Sends a round's final mass to the leaderboard. The server keeps the best one: `best` in the answer
 * is the player's record after this round, whether or not this round beat it.
 */
export async function submitRecord(
  client: IDosGamesClient,
  mass: number,
): Promise<RecordState> {
  if (!hasLeaderboard(client)) return { status: "off" };
  const res = await client.leaderboard.submitScore(LEADERBOARD_ID, mass);
  return res.ok
    ? { status: "saved", best: res.data.NewScore }
    : { status: "failed", error: res.error };
}
