import { defineModule, type Module } from "@idosgames/module-sdk";
import { createMenuActions } from "./components/menuActions";
import { makeRootPanel } from "./components/RootPanel";
import { allowedLook, type Look } from "./data/cosmetics";
import { createArenaAgentApi } from "./game/agentApi";
import { createArenaScene } from "./game/scene";
import { createSession } from "./game/session";
import { submitRecord } from "./leaderboard";
import { createOnlineController } from "./net/online";
import { accountNickname, createNicknameSaver } from "./nickname";
import { createHoldings } from "./web3/holdings";
import { createLooks } from "./web3/looks";

// SolMass — the game itself: an agar.io-style arena on a 2D canvas with its own screens (main menu,
// shop, skins, game over) drawn over it. `setup` wires the scene and the overlay UI to one shared
// session and registers the mode. No client creation, no login — the host owns both.
export const solMassModule: Module = defineModule({
  id: "sol-mass",
  meta: {
    name: "SolMass",
    type: "game",
    genre: "arcade",
    // A plain 2D canvas: no engine for the host to share.
    engine: "dom",
  },
  setup(ctx) {
    const session = createSession(accountNickname(ctx.client));
    // What the player holds, what they picked, and what of the picks their holding allows.
    const holdings = createHoldings(ctx.client);
    const looks = createLooks(ctx.client);
    const look = (): Look => allowedLook(looks.get(), holdings.get().tier);
    void holdings.refresh();

    const online = createOnlineController(
      ctx.client,
      session,
      ctx.notifications,
      look,
    );
    const { scene, getArena } = createArenaScene(session, online.current, look);
    const saveNickname = createNicknameSaver(ctx.client);

    // What a round means to the account: starting one stores the nickname as the player's name,
    // being swallowed sends the final mass to the global leaderboard. The name goes first, so the
    // record is listed under it.
    ctx.effect(() => {
      let phase = session.get().phase;
      const unsubscribe = session.subscribe(() => {
        const state = session.get();
        if (state.phase === phase) return;
        const before = phase;
        phase = state.phase;
        // "connecting" → "playing" is the same round the nickname was already stored for.
        if (phase === "connecting" || (phase === "playing" && before !== "connecting"))
          saveNickname(state.nickname);
        const result = state.result;
        if (phase === "gameover" && result) {
          session.setRecord(result, { status: "saving" });
          void submitRecord(ctx.client, result.mass).then((record) =>
            session.setRecord(result, record),
          );
        }
      });
      return () => {
        unsubscribe();
        // Logging out leaves the arena too.
        online.dispose();
      };
    });

    ctx.registerScene(scene);
    ctx.registerPanel({
      id: "root",
      slot: "overlay",
      component: makeRootPanel(
        session,
        createMenuActions(ctx.features, ctx.notifications),
        holdings,
        looks,
        () => getArena()?.split(),
      ),
    });
    ctx.registerRoute({ id: "sol-mass", label: "SolMass", icon: "🟢" });
    ctx.exposeToAgent(createArenaAgentApi(getArena, session, holdings, look));
  },
});
