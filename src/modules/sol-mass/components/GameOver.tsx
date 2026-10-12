import type { CSSProperties, ReactNode } from "react";
import type { RecordState, RoundResult, Session } from "../game/session";
import type { MenuActions } from "./menuActions";
import { MenuButton } from "./MenuButton";
import { backdrop, caption, card } from "./menuStyles";

// Shown when the player's cell is swallowed: who did it, the final mass, and what became of it in
// the global leaderboard.
export function GameOver({
  session,
  result,
  record,
  actions,
}: {
  session: Session;
  result: RoundResult;
  record: RecordState | null;
  actions: MenuActions;
}): ReactNode {
  return (
    <div style={backdrop}>
      <div style={{ ...card, textAlign: "center" }}>
        <h1 style={title}>Game Over</h1>
        <div style={eatenBy}>Eaten by {result.eatenBy}</div>

        <div style={caption}>FINAL MASS</div>
        <div style={finalMass}>{result.mass}</div>
        <div style={recordLine}>{recordText(record, result.mass)}</div>

        <MenuButton tone="green" onClick={session.play}>
          Play again
        </MenuButton>
        <MenuButton tone="white" onClick={actions.openLeaderboard}>
          Leaderboard
        </MenuButton>
        <MenuButton tone="blue" onClick={session.toMenu}>
          Main menu
        </MenuButton>
      </div>
    </div>
  );
}

function recordText(record: RecordState | null, mass: number): ReactNode {
  if (!record) return " ";
  switch (record.status) {
    case "saving":
      return "Saving your record…";
    case "saved":
      return mass >= record.best ? (
        <span style={{ color: "#ffd24a" }}>New record!</span>
      ) : (
        `Your record: ${record.best}`
      );
    case "failed":
      return (
        <span style={{ color: "#ff8f9f" }}>
          Record not saved: {record.error}
        </span>
      );
    case "off":
      return " ";
  }
}

const title: CSSProperties = {
  margin: 0,
  fontSize: 38,
  lineHeight: 1.1,
  fontWeight: 800,
  color: "#ff5c7a",
};

const eatenBy: CSSProperties = {
  marginBottom: 8,
  fontSize: 15,
  fontWeight: 700,
  color: "rgba(255, 255, 255, 0.75)",
};

const finalMass: CSSProperties = {
  fontSize: 64,
  lineHeight: 1,
  fontWeight: 800,
  color: "#ffffff",
};

const recordLine: CSSProperties = {
  // A fixed line: the card does not jump when "Saving…" turns into the answer.
  minHeight: 20,
  marginBottom: 8,
  fontSize: 15,
  fontWeight: 700,
  color: "rgba(255, 255, 255, 0.75)",
};
