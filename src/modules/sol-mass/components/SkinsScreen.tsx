import type { CSSProperties, ReactNode } from "react";
import { allowedLook, SKINS, type Skin, type Tier } from "../data/cosmetics";
import type { Holdings } from "../web3/holdings";
import type { Looks } from "../web3/looks";
import {
  LockedVeil,
  optionStyle,
  ScreenFrame,
  Section,
  useStore,
} from "./holdUi";

// The Skins screen: how the player's cell is painted. Solid colours are free; six gradients open
// to a wallet holding 500 $MASS and the rainbow to one holding 1000. A locked skin cannot be
// picked — it is dimmed and says what it takes.

const GROUPS: ReadonlyArray<{ title: string; tier: Tier }> = [
  { title: "Solid colours", tier: 0 },
  { title: "Gradients", tier: 1 },
  { title: "Exclusive", tier: 2 },
];

export function SkinsScreen({
  holdings,
  looks,
  onBack,
}: {
  holdings: Holdings;
  looks: Looks;
  onBack: () => void;
}): ReactNode {
  const { tier } = useStore(holdings);
  // What is worn is what the tier allows of the pick, not the pick itself.
  const worn = allowedLook(useStore(looks), tier).skin;

  return (
    <ScreenFrame title="Skins" holdings={holdings} onBack={onBack}>
      {GROUPS.map((group) => (
        <Section key={group.tier} title={group.title} tier={group.tier}>
          <div style={grid}>
            {SKINS.filter((skin) => skin.tier === group.tier).map((skin) => {
              const locked = skin.tier > tier;
              return (
                <button
                  key={skin.id}
                  type="button"
                  disabled={locked}
                  aria-pressed={worn === skin.id}
                  onClick={() => looks.set({ skin: skin.id })}
                  style={optionStyle(worn === skin.id, locked)}
                >
                  <span style={{ ...preview, background: skinCss(skin) }} />
                  {skin.name}
                  {locked ? <LockedVeil tier={skin.tier} /> : null}
                </button>
              );
            })}
          </div>
        </Section>
      ))}
    </ScreenFrame>
  );
}

/** The skin as a CSS background — a still of what the arena paints on the canvas. */
function skinCss(skin: Skin): string {
  const colors = skin.colors;
  if (skin.kind === "solid") return colors[0] ?? "#ffffff";
  if (skin.kind === "rainbow")
    return `conic-gradient(${[...colors, colors[0]].join(", ")})`;
  return `radial-gradient(circle at 31% 31%, ${colors.join(", ")})`;
}

const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))",
  gap: 10,
};

const preview: CSSProperties = {
  width: 60,
  height: 60,
  borderRadius: "50%",
  boxShadow: "inset 0 0 0 4px rgba(0, 0, 0, 0.22)",
};
