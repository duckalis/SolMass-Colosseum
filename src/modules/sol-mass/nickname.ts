import type { IDosGamesClient } from "@idosgames/core";

// The nickname of the main menu is the account's username: it is what the leaderboard shows next
// to the player's record, and what the menu is filled with on the next visit.

/** The server stores a username of 3–24 characters; a shorter nickname stays local to the round. */
const USERNAME_MIN = 3;

export function accountNickname(client: IDosGamesClient): string {
  return client.data.user.state?.PublicData?.Username?.trim() ?? "";
}

/** Returns a function that stores a nickname on the account — once per new name. */
export function createNicknameSaver(
  client: IDosGamesClient,
): (nickname: string) => void {
  // The SDK does not patch the cached username after a change, so what was saved is tracked here.
  let saved = accountNickname(client);
  return (nickname) => {
    const name = nickname.trim();
    if (name.length < USERNAME_MIN || name === saved) return;
    const previous = saved;
    saved = name;
    void client.user.changeUsername(name).then((res) => {
      if (res.ok) return;
      saved = previous;
      console.warn("[sol-mass] nickname was not saved:", res.error);
    });
  };
}
