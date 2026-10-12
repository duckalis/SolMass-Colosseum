import { defineAppConfig } from "@idosgames/app-shell";
import { IS_DEV } from "./env";

// What happens after sign-in and how the lobby is ordered. The look, animations and sounds are in
// ./ui.config.ts. Which systems (shop, heroes, leaderboards…) and games the app has is
// ./modules.ts: remove a module there and its tab is gone. A tab whose system has nothing configured
// on the title yet (no store offers, no heroes…) stays hidden from players by itself.
//
// Everything is optional; uncomment and edit.
export default defineAppConfig({
  // "game" — sign-in → straight into a game that lives inside the lobby (idle-rpg); an app whose
  // games take the whole screen (voxelcraft, board-game) starts in the lobby. "lobby" — always
  // sign-in → lobby → "Play". The mode id of a game ("voxelcraft") starts in that one.
  // SolMass opens on its own main menu (nickname + Play…), so the app starts straight in its mode.
  start: "sol-mass",
  lobby: {
    // order: ["play", "store", "character"], // these tabs first, in this order
    // primary: ["season"],                    // also a main tab rather than under "More"
  },
  auth: {
    // The "Play as guest" button on the sign-in screen is OFF by default. Here it is shown only by
    // the local dev server (`npm run dev`), to get into the game without an account; a built game
    // has no guest sign-in until this is set to `true`.
    guest: IS_DEV,
  },
});
