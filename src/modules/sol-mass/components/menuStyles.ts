import type { CSSProperties } from "react";
import { v } from "@idosgames/react/ui";

// The frame the game's own screens share: a dimmed arena and a card in the middle of it.

export const backdrop: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  padding: 16,
  boxSizing: "border-box",
  overflowY: "auto",
  background:
    "radial-gradient(circle at 50% 40%, rgba(15, 19, 56, 0.35), rgba(6, 8, 24, 0.85))",
  fontFamily: v.font,
  pointerEvents: "auto",
};

export const card: CSSProperties = {
  // `margin: auto` centres the card and, unlike align-items, lets a short screen scroll to its top.
  margin: "auto",
  width: "100%",
  maxWidth: 340,
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: 24,
  borderRadius: 20,
  // Nearly opaque: a bot passing behind the card must not read through its text.
  background: "rgba(16, 20, 58, 0.97)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  boxShadow: "0 18px 50px rgba(0, 0, 0, 0.45)",
};

/** Small capitals over a field or a figure ("NICKNAME", "FINAL MASS"). */
export const caption: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.14em",
  color: "rgba(255, 255, 255, 0.7)",
};
