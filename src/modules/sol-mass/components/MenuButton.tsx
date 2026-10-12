import { useState, type CSSProperties, type ReactNode } from "react";

// The big button of the game's own screens (the main menu, game over).

export type Tone = "green" | "blue" | "orange" | "sky" | "white";

/** face — the button, edge — its darker bottom side, text — the label. */
const TONES: Record<Tone, { face: string; edge: string; text: string }> = {
  green: { face: "#2fd16b", edge: "#1c9447", text: "#ffffff" },
  blue: { face: "#3478f6", edge: "#1f52bd", text: "#ffffff" },
  orange: { face: "#ff9f1a", edge: "#c66f00", text: "#ffffff" },
  sky: { face: "#4cc9f5", edge: "#1f95c2", text: "#ffffff" },
  white: { face: "#ffffff", edge: "#b9c0d9", text: "#1b2145" },
};

export function MenuButton({
  tone,
  onClick,
  children,
}: {
  tone: Tone;
  onClick: () => void;
  children: ReactNode;
}): ReactNode {
  // Inline styles have no :hover / :active, so the button tracks them itself.
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);
  const { face, edge, text } = TONES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => {
        setHover(false);
        setPressed(false);
      }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      style={{
        ...button,
        color: text,
        background: face,
        boxShadow: `0 ${pressed ? 1 : 5}px 0 ${edge}`,
        transform: pressed ? "translateY(4px)" : "none",
        filter: hover && !pressed ? "brightness(1.08)" : "none",
      }}
    >
      {children}
    </button>
  );
}

const button: CSSProperties = {
  // Shorter on a short window (see MainMenu's card): five of them have to fit the game's frame.
  height: "clamp(40px, 9vh, 50px)",
  border: "none",
  borderRadius: 14,
  fontFamily: "inherit",
  fontSize: 18,
  fontWeight: 800,
  cursor: "pointer",
  userSelect: "none",
  touchAction: "manipulation",
  transition: "transform 60ms, box-shadow 60ms, filter 120ms",
};
