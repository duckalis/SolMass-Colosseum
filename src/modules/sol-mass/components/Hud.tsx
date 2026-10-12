import type { CSSProperties, ReactNode } from "react";
import { v } from "@idosgames/react/ui";
import { SPLIT_MIN_MASS } from "../data/tuning";
import type { SessionState } from "../game/session";

// What stays on screen during a round: the mass, Split, the way back to the main menu and, on an
// online arena, who is on it. The layer itself lets the pointer through — only the buttons take it.
export function Hud({
  state,
  onMenu,
  onSplit,
}: {
  state: SessionState;
  onMenu: () => void;
  onSplit: () => void;
}): ReactNode {
  return (
    <div style={layer}>
      <button type="button" onClick={onMenu} style={menuButton}>
        Menu
      </button>
      {state.online ? (
        <div style={arenaChip}>
          {state.notice ?? `Online · ${state.players} ${state.players === 1 ? "player" : "players"}`}
        </div>
      ) : null}
      <div style={massChip}>Mass: {state.mass}</div>
      {/* The Space key does the same; a phone has no other way to split. */}
      <button
        type="button"
        onClick={onSplit}
        style={{
          ...splitButton,
          opacity: state.mass > SPLIT_MIN_MASS ? 1 : 0.45,
        }}
      >
        Split
      </button>
    </div>
  );
}

const layer: CSSProperties = {
  position: "absolute",
  inset: 0,
  fontFamily: v.font,
  pointerEvents: "none",
};

const chip: CSSProperties = {
  position: "absolute",
  padding: "8px 14px",
  borderRadius: 12,
  background: "rgba(6, 8, 24, 0.6)",
  border: "1px solid rgba(255, 255, 255, 0.14)",
  color: "#ffffff",
  fontFamily: "inherit",
  fontSize: 16,
  fontWeight: 800,
};

const massChip: CSSProperties = { ...chip, left: 12, bottom: 12 };

const arenaChip: CSSProperties = {
  ...chip,
  top: 12,
  left: "50%",
  transform: "translateX(-50%)",
  fontSize: 14,
  whiteSpace: "nowrap",
};

const menuButton: CSSProperties = {
  ...chip,
  // Top-right: the base's "To the lobby" button owns the top-left corner.
  top: 12,
  right: 12,
  cursor: "pointer",
  pointerEvents: "auto",
};

const splitButton: CSSProperties = {
  ...chip,
  right: 12,
  // Clear of the platform's "Made with iDos Games" badge, which a published build puts in this
  // corner — it lay over the button, and a phone has no other way to split.
  bottom: 52,
  padding: "14px 22px",
  borderRadius: 16,
  cursor: "pointer",
  pointerEvents: "auto",
  touchAction: "manipulation",
  userSelect: "none",
};
