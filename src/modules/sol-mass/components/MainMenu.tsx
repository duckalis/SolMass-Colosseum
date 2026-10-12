import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { NICKNAME_MAX } from "../data/tuning";
import type { Session } from "../game/session";
import type { MenuActions } from "./menuActions";
import { MenuButton } from "./MenuButton";
import { backdrop, caption, card } from "./menuStyles";

// The main menu: the nickname and five buttons, one under another, over the live arena. "Play"
// starts an offline round against bots, "Play Online" takes the player to an arena with other
// people, "Shop" and "Skins" open what holding $MASS unlocks, "Leaderboard" the global top.
export function MainMenu({
  session,
  nickname,
  actions,
  onShop,
  onSkins,
}: {
  session: Session;
  nickname: string;
  actions: MenuActions;
  onShop: () => void;
  onSkins: () => void;
}): ReactNode {
  const inputId = useId();
  const [focused, setFocused] = useState(false);

  // Not a <form>: on the game's idosgames.com page the game runs in a sandboxed frame that does
  // not allow forms, and a submit there never happens — "Play" did nothing.
  return (
    <div style={backdrop}>
      <div style={menuCard}>
        <h1 style={logo}>
          Sol<span style={{ color: "#14f195" }}>Mass</span>
        </h1>

        <label htmlFor={inputId} style={caption}>
          NICKNAME
        </label>
        <input
          id={inputId}
          type="text"
          placeholder="enter a name"
          maxLength={NICKNAME_MAX}
          autoComplete="off"
          spellCheck={false}
          value={nickname}
          onChange={(event) => session.setNickname(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) session.play();
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            ...input,
            borderColor: focused ? "#14f195" : "rgba(255, 255, 255, 0.18)",
          }}
        />

        <MenuButton tone="green" onClick={session.play}>
          Play
        </MenuButton>
        <MenuButton tone="blue" onClick={session.playOnline}>
          Play Online
        </MenuButton>
        <MenuButton tone="orange" onClick={onShop}>
          Shop
        </MenuButton>
        <MenuButton tone="sky" onClick={onSkins}>
          Skins
        </MenuButton>
        <MenuButton tone="white" onClick={actions.openLeaderboard}>
          Leaderboard
        </MenuButton>
      </div>
    </div>
  );
}

// Sized by the window's height: the game's frame on its idosgames.com page is about 460px tall,
// and all five buttons have to be on it without scrolling. A taller window gets the full sizes.
const menuCard: CSSProperties = {
  ...card,
  gap: "clamp(7px, 2.2vh, 12px)",
  padding: "clamp(14px, 4.4vh, 24px) 24px",
};

const logo: CSSProperties = {
  margin: "0 0 4px",
  fontSize: "clamp(28px, 7.6vh, 42px)",
  lineHeight: 1.1,
  fontWeight: 800,
  textAlign: "center",
  color: "#ffffff",
};

const input: CSSProperties = {
  height: "clamp(38px, 8.4vh, 46px)",
  boxSizing: "border-box",
  padding: "0 14px",
  borderRadius: 12,
  border: "2px solid",
  outline: "none",
  background: "rgba(6, 8, 24, 0.6)",
  color: "#ffffff",
  fontFamily: "inherit",
  // 16px keeps iOS Safari from zooming the page on focus.
  fontSize: 16,
  fontWeight: 700,
  marginBottom: 4,
};
