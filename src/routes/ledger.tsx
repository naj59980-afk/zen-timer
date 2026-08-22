import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Coins, Gamepad2, Flame, Trophy } from "lucide-react";
import {
  computeDayScore,
  effectiveDayScore,
  formatDateDMY,
  funPenalty,
  lifetimeScores,
  useAppState,
} from "@/lib/store";
import { Card, SectionTitle, Stat, useHydrated } from "@/components/kit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ledger")({
  head: () => ({
    meta: [
      { title: "Point Ledger — Flow Tracker" },
      {
        name: "description",
        content:
          "Every point earned and spent in one organised ledger: daily focus scores, streak rewards, leisure deductions and redemptions.",
      },
      { property: "og:title", content: "Point Ledger — Flow Tracker" },
      {
        property: "og:description",
        content: "A clean earn-and-spend history of your focus points.",
      },
    ],
  }),
  component: LedgerPage,
});

type Row = {
  id: string;
  date: string;
  label: string;
  detail: string;
  amount: number;
  kind: "focus" | "streak" | "leisure" | "spend";
};

const KIND_META = {
  focus: { icon: Trophy, tint: "text-success", chip: "bg-success/12" },
  streak: { icon: Flame, tint: "text-primary", chip: "bg-primary/12" },
  leisure: { icon: Gamepad2, tint: "text-destructive", chip: "bg-destructive/10" },
  spend: { icon: Coins, tint: "text-destructive", chip: "bg-destructive/10" },
} as const;

function LedgerPage() {
  const state = useAppState();
  const hydrated = useHydrated();
  const [filter, setFilter] = useState<"all" | "earn" | "spend">("all");
  const totals = lifetimeScores(state);

  const rows = useMemo<Row[]>(() => {
    const now = Date.now();
    const out: Row[] = [];
    for (const key of Object.keys(state.db)) {
      const gross = computeDayScore(state.db[key], state.settings.coeff);
      const eff = effectiveDayScore(state, key, now);
      if (Math.abs(eff) > 0.5) {
        out.push({
          id: `focus-${key}`,
          date: key,
          label: "Focus score",
          detail: eff < gross - 0.5 ? "reduced — planning rule" : "earned from logged focus",
          amount: eff,
          kind: "focus",
        });
      }
      const fun = funPenalty(state.db[key]);
      if (fun > 0.5) {
        out.push({
          id: `fun-${key}`,
          date: key,
          label: "Leisure",
          detail: `${(state.db[key].funLogs ?? []).length} session(s)`,
          amount: -fun,
          kind: "leisure",
        });
      }
    }
    for (const c of state.settings.streakClaims ?? []) {
      out.push({
        id: `streak-${c.id}`,
        date: c.date,
        label: `${c.days}-day streak reward`,
        detail: "streak goal accomplished",
        amount: c.points,
        kind: "streak",
      });
    }
    for (const s of state.spends) {
      out.push({
        id: `spend-${s.id}`,
        date: s.date,
        label: s.reason || "Redemption",
        detail: "points redeemed",
        amount: -s.amount,
        kind: "spend",
      });
    }
    return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [state]);

  const shown = rows.filter((r) =>
    filter === "all" ? true : filter === "earn" ? r.amount > 0 : r.amount < 0,
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of shown) {
      const list = map.get(r.date) ?? [];
      list.push(r);
      map.set(r.date, list);
    }
    return [...map.entries()];
  }, [shown]);

  return (
    <div className="space-y-4">
      <SectionTitle>Point ledger</SectionTitle>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Earned" value={hydrated ? totals.gross.toFixed(0) : "—"} sub="all time" />
        <Stat label="Spent" value={hydrated ? `−${totals.spent.toFixed(0)}` : "—"} sub="redeemed" />
        <Stat label="Balance" value={hydrated ? totals.net.toFixed(0) : "—"} sub="available" />
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-surface-2 p-1">
        {(
          [
            ["all", "Everything"],
            ["earn", "Earned"],
            ["spend", "Spent"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={cn(
              "press rounded-xl py-2 text-xs font-bold",
              filter === id
                ? "gradient-fill text-primary-foreground shadow-[var(--shadow-soft)]"
                : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {hydrated && grouped.length === 0 ? (
        <Card>
          <p className="text-xs text-muted-foreground">
            Nothing here yet — log focus time or redeem points and it shows up in this ledger.
          </p>
        </Card>
      ) : null}

      {grouped.map(([date, items]) => {
        const net = items.reduce((a, b) => a + b.amount, 0);
        return (
          <Card key={date}>
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                {formatDateDMY(date)}
              </div>
              <span
                className={cn(
                  "font-mono text-xs font-extrabold tabular-nums",
                  net >= 0 ? "text-success" : "text-destructive",
                )}
              >
                {net >= 0 ? "+" : "−"}
                {Math.abs(net).toFixed(0)}
              </span>
            </div>
            <div className="mt-2 space-y-1.5">
              {items.map((r) => {
                const meta = KIND_META[r.kind];
                const Icon = meta.icon;
                return (
                  <div
                    key={r.id}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl bg-surface-2 px-3 py-2"
                  >
                    <span className={cn("grid h-8 w-8 place-items-center rounded-full", meta.chip)}>
                      <Icon className={cn("h-4 w-4", meta.tint)} />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{r.label}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{r.detail}</div>
                    </div>
                    <span
                      className={cn(
                        "flex items-center gap-0.5 font-mono text-sm font-extrabold tabular-nums",
                        r.amount >= 0 ? "text-success" : "text-destructive",
                      )}
                    >
                      {r.amount >= 0 ? (
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDownRight className="h-3.5 w-3.5" />
                      )}
                      {Math.abs(r.amount).toFixed(0)}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
