import type { IDosGamesClient } from "@idosgames/core";
import { DEFAULT_LOOK, type Look } from "../data/cosmetics";

// The player's choices of the Skins and Shop screens, kept in the player's profile (the Private
// bucket of UserCustomData), so they follow the account to another device. What is stored is what
// the player PICKED; what they may use at their current tier is `allowedLook` — a pick whose tokens
// were sold waits in the profile and comes back with the tokens.

/** The profile key. No "." or "$": the server refuses them in key names. */
const KEY = "sol_mass_look";
/** Clicks through a row of swatches are one save, not five. */
const SAVE_AFTER_MS = 500;

export interface Looks {
  get(): Look;
  subscribe(listener: () => void): () => void;
  set(patch: Partial<Look>): void;
}

function parse(value: string | null | undefined): Look | null {
  if (!value) return null;
  try {
    const saved = JSON.parse(value) as Partial<Look>;
    return {
      skin: typeof saved.skin === "string" ? saved.skin : DEFAULT_LOOK.skin,
      arena: typeof saved.arena === "string" ? saved.arena : DEFAULT_LOOK.arena,
      rgbName: saved.rgbName === true,
    };
  } catch {
    return null;
  }
}

export function createLooks(client: IDosGamesClient): Looks {
  const saved = (): string | null | undefined =>
    client.data.user.state?.CustomData?.Private?.[KEY]?.Value;

  let look: Look = parse(saved()) ?? DEFAULT_LOOK;
  let changed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const notify = (): void => {
    for (const listener of [...listeners]) listener();
  };

  // Sign-in does not always bring the custom data along; ask once, unless the player has already
  // picked something in the meantime.
  if (saved() === undefined) {
    void client.userCustomData.getMyUserCustomData().then(() => {
      const loaded = parse(saved());
      if (!loaded || changed) return;
      look = loaded;
      notify();
    });
  }

  return {
    get: () => look,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set(patch) {
      look = { ...look, ...patch };
      changed = true;
      notify();
      clearTimeout(timer);
      timer = setTimeout(() => {
        void client.userCustomData
          .setPrivateData(KEY, JSON.stringify(look))
          .then((res) => {
            if (!res.ok) console.warn("[sol-mass] look was not saved:", res.error);
          });
      }, SAVE_AFTER_MS);
    },
  };
}
