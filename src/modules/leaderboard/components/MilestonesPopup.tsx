import { useState, type ReactNode } from "react";
import { type GetMyProgressResponse } from "@idosgames/core";
import { useIDosGamesClient, useUserState } from "@idosgames/react";
import {
  Button,
  Card,
  errorText,
  grantedBy,
  Icon,
  outlined,
  Popup,
  ProgressBar,
  ResourceList,
  useCatalog,
  useCelebrate,
  useStagger,
  useToast,
} from "@idosgames/react/ui";
import {
  cachedProgress,
  milestoneRows,
  type LeaderboardDefinitionView,
} from "../model";
import { t } from "../i18n";

export function MilestonesPopup({
  def,
  progress,
  onClaimed,
  onClose,
}: {
  def: LeaderboardDefinitionView & { LeaderboardID: string };
  progress: GetMyProgressResponse | null;
  onClaimed: () => Promise<void>;
  onClose: () => void;
}): ReactNode {
  const client = useIDosGamesClient();
  const state = useUserState();
  const catalog = useCatalog();
  const celebrate = useCelebrate();
  const toast = useToast();
  const stagger = useStagger();
  const [busy, setBusy] = useState<string | null>(null);
  const earned = Number(
    progress?.MilestoneTokensEarned ?? progress?.ScoreEarnedThisCycle ?? 0,
  );
  const rows = milestoneRows(
    def,
    earned,
    cachedProgress(state?.Leaderboard, def.LeaderboardID).claimed,
  );

  const claim = async (milestoneID: string) => {
    setBusy(milestoneID);
    const res = await client.leaderboard.claimMilestone(
      def.LeaderboardID,
      milestoneID,
    );
    setBusy(null);
    if (!res.ok) return toast(errorText(res.error), "error");
    celebrate(grantedBy(res.data));
    await onClaimed();
  };

  return (
    <Popup title={t("milestones")} onClose={onClose} width={440}>
      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((row, i) => (
          <Card
            key={row.id}
            highlight={row.state === "ready"}
            style={{
              display: "grid",
              gap: 8,
              opacity: row.state === "claimed" ? 0.6 : 1,
              ...stagger(i),
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ ...outlined, fontSize: 15 }}>
                {catalog.localize(row.name)}
              </span>
              <ResourceList lines={row.reward} />
            </div>
            <ProgressBar
              value={Math.min(earned, row.required)}
              max={row.required}
              tone={row.state === "ready" ? "gold" : "green"}
            />
            {row.state === "ready" ? (
              <Button
                tone="gold"
                size="sm"
                attract
                busy={busy === row.id}
                onClick={() => void claim(row.id)}
              >
                {t("claim")}
              </Button>
            ) : row.state === "claimed" ? (
              <div style={{ justifySelf: "center" }}>
                <Icon glyph="check" size={26} />
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </Popup>
  );
}
