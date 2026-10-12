// The whole game is in English, whatever language the player's browser is set to.
//
// The SDK's interface kit (@idosgames/react/ui) draws every screen that is not the game's own —
// sign-in, the lobby, the leaderboard window, notifications — in English or Russian, and picks
// between them from `navigator.language`, once, the moment a module is loaded. It has no setting
// for it. So the language is pinned at the source, before any of those modules load: this file
// must stay ahead of every SDK import in main.tsx.
//
// Editing the catalog modules instead would not reach the sign-in screen and the lobby (they are
// inside the SDK packages), and would cut the modules off from catalog updates.

const LANGUAGE = "en-US";

try {
  Object.defineProperty(navigator, "language", {
    configurable: true,
    get: () => LANGUAGE,
  });
  Object.defineProperty(navigator, "languages", {
    configurable: true,
    get: () => [LANGUAGE, "en"],
  });
} catch {
  // A browser that will not have it redefined keeps its own language; nothing else breaks.
}

export {};
