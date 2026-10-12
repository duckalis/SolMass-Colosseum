import type { CSSProperties, ReactNode } from "react";
import {
  allowedLook,
  ARENA_THEMES,
  RGB_NAME_TIER,
  type Tier,
} from "../data/cosmetics";
import type { Holdings } from "../web3/holdings";
import type { Looks } from "../web3/looks";
import {
  LockedVeil,
  optionStyle,
  ScreenFrame,
  Section,
  useStore,
} from "./holdUi";

// The Shop screen: what holding $MASS gives beyond skins. Nothing is bought here — a wallet holding
// 500 may recolour the arena, one holding 1000 may wear an RGB nickname; a locked option is dimmed
// and says what it takes.

const ARENA_TIER: Tier = 1;

export function ShopScreen({
  holdings,
  looks,
  nickname,
  onBack,
}: {
  holdings: Holdings;
  looks: Looks;
  nickname: string;
  onBack: () => void;
}): ReactNode {
  const { tier } = useStore(holdings);
  const used = allowedLook(useStore(looks), tier);
  const rgbLocked = tier < RGB_NAME_TIER;

  return (
    <ScreenFrame title="Shop" holdings={holdings} onBack={onBack}>
      <Section title="Arena background" tier={ARENA_TIER}>
        <div style={grid}>
          {ARENA_THEMES.map((theme) => {
            const locked = theme.tier > tier;
            return (
              <button
                key={theme.id}
                type="button"
                disabled={locked}
                aria-pressed={used.arena === theme.id}
                onClick={() => looks.set({ arena: theme.id })}
                style={optionStyle(used.arena === theme.id, locked)}
              >
                <span
                  style={{
                    ...swatch,
                    backgroundColor: theme.floor,
                    // The grid of the arena, so that a colour reads as a floor and not as a button.
                    backgroundImage: `linear-gradient(${theme.grid} 1px, transparent 1px), linear-gradient(90deg, ${theme.grid} 1px, transparent 1px)`,
                    backgroundSize: "12px 12px",
                    borderColor: theme.border,
                  }}
                />
                {theme.name}
                {locked ? <LockedVeil tier={theme.tier} /> : null}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="RGB nickname" tier={RGB_NAME_TIER}>
        <button
          type="button"
          disabled={rgbLocked}
          aria-pressed={used.rgbName}
          onClick={() => looks.set({ rgbName: !used.rgbName })}
          style={{
            ...optionStyle(used.rgbName, rgbLocked),
            gridTemplateColumns: "1fr auto",
            alignItems: "center",
            justifyItems: "start",
            padding: "12px 14px",
            textAlign: "left",
          }}
        >
          <span style={{ display: "grid", gap: 4 }}>
            <style>{SHIMMER}</style>
            <span style={rgbPreview}>{nickname.trim() || "Your name"}</span>
            <span style={hint}>
              Your name over the cell shimmers through the rainbow — every player on an online
              arena sees it.
            </span>
          </span>
          <span style={{ ...toggle, background: used.rgbName ? "#14f195" : "rgba(255, 255, 255, 0.18)" }}>
            {used.rgbName ? "On" : "Off"}
          </span>
          {rgbLocked ? <LockedVeil tier={RGB_NAME_TIER} /> : null}
        </button>
      </Section>
    </ScreenFrame>
  );
}

/** Inline styles cannot animate: the one keyframe of the preview lives in a style tag. */
const SHIMMER =
  "@keyframes sol-mass-rgb { from { background-position: 0% 50%; } to { background-position: 200% 50%; } }";

const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))",
  gap: 10,
};

const swatch: CSSProperties = {
  width: "100%",
  height: 54,
  boxSizing: "border-box",
  borderRadius: 10,
  border: "3px solid",
};

const rgbPreview: CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  backgroundImage:
    "linear-gradient(90deg, #ff3b3b, #ff9f1a, #ffe53b, #3bff6f, #3bd1ff, #6f5bff, #ff3bd4, #ff3b3b)",
  backgroundSize: "200% 100%",
  backgroundClip: "text",
  WebkitBackgroundClip: "text",
  color: "transparent",
  animation: "sol-mass-rgb 3s linear infinite",
};

const hint: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1.35,
  color: "rgba(255, 255, 255, 0.7)",
};

const toggle: CSSProperties = {
  minWidth: 46,
  padding: "6px 10px",
  borderRadius: 999,
  color: "#0b0e2a",
  fontSize: 13,
  fontWeight: 800,
  textAlign: "center",
};
