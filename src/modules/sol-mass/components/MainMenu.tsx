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

  return (
    <div style={backdrop}>
      <form
        style={card}
        onSubmit={(event) => {
          event.preventDefault();
          session.play();
        }}
      >
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
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            ...input,
            borderColor: focused ? "#14f195" : "rgba(255, 255, 255, 0.18)",
          }}
        />

        <MenuButton tone="green" type="submit">
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
      </form>
    </div>
  );
}

const logo: CSSProperties = {
  margin: "0 0 4px",
  fontSize: 42,
  lineHeight: 1.1,
  fontWeight: 800,
  textAlign: "center",
  color: "#ffffff",
};

const input: CSSProperties = {
  height: 46,
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
