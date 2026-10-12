import { type ReactNode } from "react";
import {
  Card,
  grantLines,
  outlined,
  Popup,
  ResourceList,
  useStagger,
} from "@idosgames/react/ui";
import { rewardForRank, type LeaderboardDefinitionView } from "../model";
import { t } from "../i18n";

export function RankRewardsPopup({
  def,
  myRank,
  onClose,
}: {
  def: LeaderboardDefinitionView;
  myRank: number | null;
  onClose: () => void;
}): ReactNode {
  const stagger = useStagger();
  return (
    <Popup title={t("rankRewards")} onClose={onClose}>
      <div style={{ display: "grid", gap: 8 }}>
        {(def.RankRewards ?? []).map((r, i) => {
          const lines = grantLines(r?.Rewards);
          const mineHere =
            myRank !== null &&
            rewardForRank({ RankRewards: [r] }, myRank).length > 0;
          return (
            <Card
              key={r?.Rank ?? i}
              highlight={mineHere}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 12px",
                ...stagger(i),
              }}
            >
              <span style={{ ...outlined, fontSize: 16 }}>#{r?.Rank}</span>
              <ResourceList lines={lines} />
            </Card>
          );
        })}
      </div>
    </Popup>
  );
}
