import { useEffect, useState, type ReactNode } from "react";
import { type FeatureRegistry } from "@idosgames/module-sdk";
import { useIDosGamesClient } from "@idosgames/react";
import {
  Button,
  configSection,
  errorText,
  grantedBy,
  Icon,
  outlined,
  Popup,
  ResourceList,
  useCatalog,
  useCelebrate,
  usePopupClose,
  useToast,
  v,
} from "@idosgames/react/ui";
import {
  enabledBoards,
  rewardForRank,
  type LeaderboardDefinitionView,
  type LeaderboardSection,
} from "../model";
import { t } from "../i18n";

/**
 * The reward of a finished round pops up by itself (Unity LeaderboardCycleRewardPopup): the place
 * the player took, what it earns, and "Claim". An always-on panel; it also keeps the badge.
 */
export function makeCycleRewardWatcher(features: FeatureRegistry) {
  return function CycleRewardWatcher(): ReactNode {
    const client = useIDosGamesClient();
    const [pending, setPending] = useState<{
      def: LeaderboardDefinitionView & { LeaderboardID: string };
      rank: number | null;
    } | null>(null);

    useEffect(() => {
      let cancelled = false;
      const check = async () => {
        const boards = enabledBoards(
          configSection<LeaderboardSection>(client, "Leaderboard"),
        );
        if (boards.length === 0) return;
        const res = await client.leaderboard.getProgressBatch(
          boards.map((b) => b.LeaderboardID),
        );
        if (cancelled || !res.ok) return;
        const progress = res.data.map((r) =>
          r.Success ? (r.Data ?? null) : null,
        );
        features.setBadge(
          "leaderboard",
          progress.filter(
            (p) => p?.HasUnclaimedReward || p?.HasUnclaimedMilestone,
          ).length,
        );
        const withReward = progress.find((p) => p?.HasUnclaimedReward);
        const def = withReward
          ? boards.find((b) => b.LeaderboardID === withReward.LeaderboardID)
          : undefined;
        if (withReward && def)
          setPending({ def, rank: withReward.LastKnownRank ?? null });
      };
      void check();
      const offA = client.on(
        "leaderboard:cycleRewardClaimed",
        () => void check(),
      );
      const offB = client.on(
        "leaderboard:milestoneClaimed",
        () => void check(),
      );
      return () => {
        cancelled = true;
        offA();
        offB();
      };
    }, [client]);

    if (!pending) return null;
    return (
      <CycleRewardPopup
        def={pending.def}
        rank={pending.rank}
        onClose={() => setPending(null)}
      />
    );
  };
}

function CycleRewardPopup({
  def,
  rank,
  onClose,
}: {
  def: LeaderboardDefinitionView & { LeaderboardID: string };
  rank: number | null;
  onClose: () => void;
}): ReactNode {
  const catalog = useCatalog();
  const lines = rewardForRank(def, rank);
  return (
    <Popup title={t("lastCycle")} onClose={onClose} variant="center" queued>
      <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
        <div className="idos-bounce">
          <Icon glyph="trophy" size={84} />
        </div>
        <div style={{ ...outlined, fontSize: 16 }}>
          {catalog.localize(def.DisplayName ?? def.LeaderboardID)}
        </div>
        <div style={{ ...outlined, fontSize: 14, color: v.textDim }}>
          {t("yourPlace")}
        </div>
        <div style={{ ...outlined, fontSize: 34, color: v.gold }}>
          {rank ? `#${rank}` : t("notRanked")}
        </div>
        {lines.length > 0 ? (
          <>
            <div style={{ ...outlined, fontSize: 14, color: v.textDim }}>
              {t("reward")}
            </div>
            <ResourceList lines={lines} size={26} gap={14} />
          </>
        ) : null}
      </div>
      <ClaimCycle leaderboardID={def.LeaderboardID} />
    </Popup>
  );
}

function ClaimCycle({ leaderboardID }: { leaderboardID: string }): ReactNode {
  const client = useIDosGamesClient();
  const close = usePopupClose();
  const celebrate = useCelebrate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      tone="gold"
      size="lg"
      attract
      busy={busy}
      onClick={() => {
        setBusy(true);
        void client.leaderboard.claimCycleReward(leaderboardID).then((res) => {
          setBusy(false);
          if (!res.ok) return toast(errorText(res.error), "error");
          close();
          celebrate(grantedBy(res.data));
        });
      }}
    >
      {t("claim")}
    </Button>
  );
}
