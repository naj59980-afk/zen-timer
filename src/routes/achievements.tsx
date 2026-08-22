import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Lock, Flame, Trophy, Sparkle, Medal } from "lucide-react";

import {
  computeDayScore,
  computeStreak,
  dayTotals,
  lifetimeScores,
  useAppState,
  type AppState,
} from "@/lib/store";
import { Card, SectionTitle, useHydrated } from "@/components/kit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/achievements")({
  head: () => ({
    meta: [
      { title: "Achievements & Badges — Flow Tracker" },
      {
        name: "description",
        content:
          "Unlock bronze to platinum badges for focus hours, streaks, scores and perfect slot days.",
      },
      { property: "og:title", content: "Achievements & Badges — Flow Tracker" },
      {
        property: "og:description",
        content: "Badge collection tracking deep work milestones, streaks and daily scores.",
      },
    ],
  }),
  component: AchievementsPage,
});

type Tier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";

type Badge = {
  id: string;
  name: string;
  desc: string;
  tier: Tier;
  streak?: boolean;
  progress: number; // 0..1
  unlocked: boolean;
};

const TIER_STYLE: Record<Tier, string> = {
  BRONZE: "text-warning border-warning/50 bg-warning/10",
  SILVER: "text-muted-foreground border-border bg-secondary",
  GOLD: "text-warning border-warning/70 bg-warning/15",
  PLATINUM: "text-primary border-primary/60 bg-primary/12",
};

const TIER_BAR: Record<Tier, string> = {
  BRONZE: "bg-warning/70",
  SILVER: "bg-muted-foreground/60",
  GOLD: "bg-warning",
  PLATINUM: "bg-primary",
};

function buildBadges(state: AppState): Badge[] {
  const days = Object.entries(state.db);
  const totalMins = days.reduce((a, [, d]) => a + dayTotals(d).total, 0);
  const flowMins = days.reduce((a, [, d]) => a + dayTotals(d).flow, 0);
  const totalHours = totalMins / 60;
  const flowHours = flowMins / 60;
  const scores = days.map(([, d]) => computeDayScore(d, state.settings.coeff));
  const bestScore = scores.length ? Math.max(...scores) : 0;
  const { net } = lifetimeScores(state);
  const streak = computeStreak(state.db).count;
  const activeDays = days.filter(([, d]) => dayTotals(d).total > 0).length;
  const tasksDone = days.reduce(
    (a, [, d]) => a + d.tasks.filter((t) => t.completed).length,
    0,
  );
  const perfectDays = days.filter(([, d]) => {
    const t = dayTotals(d).total;
    return d.targetHours > 0 && t >= d.targetHours * 60;
  }).length;

  const mk = (
    id: string,
    name: string,
    desc: string,
    tier: Tier,
    value: number,
    goal: number,
    streakBadge = false,
  ): Badge => ({
    id,
    name,
    desc,
    tier,
    streak: streakBadge,
    progress: Math.max(0, Math.min(1, goal > 0 ? value / goal : 0)),
    unlocked: value >= goal,
  });

  return [
    mk("start", "Getting Started", "Log your first focus session", "BRONZE", totalMins, 1),
    mk("week", "Week Warrior", "Hold a 7-day streak", "SILVER", streak, 7, true),
    mk("h10", "Ten Deep", "10 total focus hours", "BRONZE", totalHours, 10),
    mk("h50", "Half Century", "50 total focus hours", "SILVER", totalHours, 50),
    mk("h100", "Century Mind", "100 total focus hours", "GOLD", totalHours, 100),
    mk("h250", "Deep Work Master", "250 total focus hours", "PLATINUM", totalHours, 250),
    mk("flow25", "Flow Finder", "25 hours in flow state", "BRONZE", flowHours, 25),
    mk("flow100", "Flow Architect", "100 hours in flow state", "GOLD", flowHours, 100),
    mk("streak15", "Fortnight Focus", "Hold a 15-day streak", "GOLD", streak, 15, true),
    mk("streak30", "Iron Discipline", "Hold a 30-day streak", "PLATINUM", streak, 30, true),
    mk("streak100", "Unbreakable", "Hold a 100-day streak", "PLATINUM", streak, 100, true),
    mk("score1k", "Thousand Club", "Score 1,000 points in a day", "SILVER", bestScore, 1000),
    mk("score3k", "Peak Output", "Score 3,000 points in a day", "GOLD", bestScore, 3000),
    mk("net10k", "Point Vault", "10,000 net lifetime points", "PLATINUM", net, 10000),
    mk("days30", "Consistent", "30 active tracking days", "SILVER", activeDays, 30),
    mk("perfect5", "Target Hunter", "Hit your daily target 5 times", "BRONZE", perfectDays, 5),
    mk("perfect25", "Target Sniper", "Hit your daily target 25 times", "GOLD", perfectDays, 25),
    mk("tasks100", "Task Crusher", "Complete 100 tasks", "SILVER", tasksDone, 100),
  ];
}

function AchievementsPage() {
  const state = useAppState();
  const hydrated = useHydrated();
  const [filter, setFilter] = useState<"all" | "unlocked" | "locked">("all");

  const badges = useMemo(() => buildBadges(state), [state]);
  const unlocked = badges.filter((b) => b.unlocked);
  const locked = badges.filter((b) => !b.unlocked);
  const pct = Math.round((unlocked.length / badges.length) * 100);
  const goldPlus = unlocked.filter((b) => b.tier === "GOLD" || b.tier === "PLATINUM").length;
  const platinum = unlocked.filter((b) => b.tier === "PLATINUM").length;
  const counts: Record<Tier, number> = {
    BRONZE: unlocked.filter((b) => b.tier === "BRONZE").length,
    SILVER: unlocked.filter((b) => b.tier === "SILVER").length,
    GOLD: unlocked.filter((b) => b.tier === "GOLD").length,
    PLATINUM: unlocked.filter((b) => b.tier === "PLATINUM").length,
  };

  const shown = filter === "all" ? badges : filter === "unlocked" ? unlocked : locked;

  return (
    <div className="space-y-3">
      <SectionTitle>Achievements</SectionTitle>

      <div className="grid grid-cols-3 gap-2">
        <MiniStat
          label="Unlocked"
          value={hydrated ? `${unlocked.length}/${badges.length}` : "—"}
          sub={`${pct}% complete`}
          tone="primary"
        />
        <MiniStat label="Gold+" value={goldPlus} sub="premium badges" tone="success" />
        <MiniStat label="Platinum" value={platinum} sub="ultimate tier" />
      </div>

      <Card>
        <div className="flex gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/12">
            <Flame className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold">Streak badges are held, not just earned</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Streak achievements unlock when you reach the milestone and stay unlocked as long as
              you hold the streak. Breaking the streak locks them again — on top of the bonus points
              from your streak target.
            </p>
          </div>
        </div>
      </Card>

      <Card glow>
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold tracking-[0.16em] text-muted-foreground uppercase">
              Collection progress
            </div>
            <div className="sheen-text font-display text-4xl leading-none font-extrabold">
              {pct}%
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold text-muted-foreground">Badges earned</div>
            <div className="font-display text-2xl leading-none font-extrabold text-success">
              {unlocked.length}
            </div>
          </div>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div className="gradient-fill h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {(Object.keys(counts) as Tier[]).map((t) => (
            <div
              key={t}
              className={cn("rounded-2xl border p-2 text-center", TIER_STYLE[t])}
            >
              <div className="text-[9px] font-bold tracking-wide uppercase">{t}</div>
              <div className="font-display text-lg font-extrabold">{counts[t]}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex gap-2">
        {(
          [
            ["all", "All"],
            ["unlocked", `Unlocked (${unlocked.length})`],
            ["locked", `Locked (${locked.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={cn(
              "press rounded-full px-3.5 py-1.5 text-xs font-bold",
              filter === id
                ? "gradient-fill text-primary-foreground"
                : "bg-secondary text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {shown.map((b) => (
          <div
            key={b.id}
            className={cn(
              "surface-card relative overflow-hidden p-3",
              b.unlocked && "glow-ring",
            )}
          >
            <span
              className={cn("absolute inset-y-0 left-0 w-1", TIER_BAR[b.tier])}
              aria-hidden
            />
            <div className="flex items-start justify-between gap-2">
              <div
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-full",
                  b.unlocked ? "gradient-fill text-primary-foreground" : "bg-secondary",
                )}
              >
                {b.unlocked ? (
                  b.tier === "PLATINUM" ? (
                    <Trophy className="h-4 w-4" />
                  ) : b.streak ? (
                    <Flame className="h-4 w-4" />
                  ) : (
                    <Medal className="h-4 w-4" />
                  )
                ) : (
                  <Lock className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-wide",
                  TIER_STYLE[b.tier],
                )}
              >
                {b.tier}
              </span>
            </div>
            <div className="mt-2 truncate font-display text-sm font-extrabold">{b.name}</div>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{b.desc}</p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={cn("h-full rounded-full", b.unlocked ? "bg-success" : TIER_BAR[b.tier])}
                style={{ width: `${Math.round(b.progress * 100)}%` }}
              />
            </div>
            <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
              {b.unlocked ? (
                <>
                  <Sparkle className="h-3 w-3 text-success" /> Unlocked
                </>
              ) : (
                `${Math.round(b.progress * 100)}%`
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  sub: string;
  tone?: "primary" | "success";
}) {
  return (
    <div className="surface-card p-3">
      <div className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
      <div
        className={cn(
          "font-display text-xl leading-tight font-extrabold",
          tone === "primary" && "sheen-text",
          tone === "success" && "text-success",
        )}
      >
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}
