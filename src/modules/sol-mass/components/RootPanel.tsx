import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from "react";
import type { Session } from "../game/session";
import type { Holdings } from "../web3/holdings";
import type { Looks } from "../web3/looks";
import { Connecting } from "./Connecting";
import { GameOver } from "./GameOver";
import { Hud } from "./Hud";
import { MainMenu } from "./MainMenu";
import type { MenuActions } from "./menuActions";
import { ShopScreen } from "./ShopScreen";
import { SkinsScreen } from "./SkinsScreen";

// The module's UI as one full-bleed overlay over the arena's canvas: the main menu with its Shop
// and Skins screens, the wait for an online arena, the HUD while a round is on, or the game-over
// screen. `onSplit` reaches the arena, which exists only once the scene has mounted.
export function makeRootPanel(
  session: Session,
  actions: MenuActions,
  holdings: Holdings,
  looks: Looks,
  onSplit: () => void,
): ComponentType {
  return function SolMassRootPanel(): ReactNode {
    const state = useSyncExternalStore(session.subscribe, session.get);
    /** Which screen of the menu is open. */
    const [page, setPage] = useState<"main" | "shop" | "skins">("main");
    const inMenu = state.phase === "menu";

    // The wallet may have changed hands of tokens since it was last looked at: every visit to the
    // Shop or the Skins checks it again.
    useEffect(() => {
      if (inMenu && page !== "main") void holdings.refresh();
    }, [inMenu, page]);

    if (state.phase === "playing")
      return <Hud state={state} onMenu={session.toMenu} onSplit={onSplit} />;
    if (state.phase === "connecting")
      return <Connecting onCancel={session.toMenu} />;
    if (state.phase === "gameover" && state.result)
      return (
        <GameOver
          session={session}
          result={state.result}
          record={state.record}
          actions={actions}
        />
      );

    const back = (): void => setPage("main");
    if (page === "skins")
      return <SkinsScreen holdings={holdings} looks={looks} onBack={back} />;
    if (page === "shop")
      return (
        <ShopScreen
          holdings={holdings}
          looks={looks}
          nickname={state.nickname}
          onBack={back}
        />
      );
    return (
      <MainMenu
        session={session}
        nickname={state.nickname}
        actions={actions}
        onShop={() => setPage("shop")}
        onSkins={() => setPage("skins")}
      />
    );
  };
}
