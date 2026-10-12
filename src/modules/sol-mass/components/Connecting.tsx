import type { CSSProperties, ReactNode } from "react";
import { MenuButton } from "./MenuButton";
import { backdrop, card } from "./menuStyles";

// Between "Play Online" and the arena: a room is being found (or opened) and the link to its host
// set up — a few seconds as a rule. The player can change their mind.
export function Connecting({ onCancel }: { onCancel: () => void }): ReactNode {
  return (
    <div style={backdrop}>
      <div style={{ ...card, textAlign: "center" }}>
        <h1 style={title}>Looking for an arena…</h1>
        <div style={hint}>Connecting you to other players</div>
        <MenuButton tone="white" onClick={onCancel}>
          Cancel
        </MenuButton>
      </div>
    </div>
  );
}

const title: CSSProperties = {
  margin: 0,
  fontSize: 26,
  lineHeight: 1.2,
  fontWeight: 800,
  color: "#ffffff",
};

const hint: CSSProperties = {
  marginBottom: 8,
  fontSize: 15,
  fontWeight: 700,
  color: "rgba(255, 255, 255, 0.75)",
};
