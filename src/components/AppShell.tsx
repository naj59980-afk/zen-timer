import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Timer,
  ListChecks,
  CalendarClock,
  Trophy,
  History,
  Gauge,
  Database,
  FileText,
  LineChart,
  Gamepad2,
  Medal,
  Phone,
  Coins,
  Gift,
  Share2,

  SlidersHorizontal,
  Moon,
  Sun,
  Palette,
  X,
} from "lucide-react";
import {
  computeDayScore,
  dateKeyOf,
  formatDateDMY,
  getDay,
  hydrate,
  markReportShared,
  prevDateKey,
  setState,
  shareGateActive,
  useAppState,
} from "@/lib/store";
import { shareQuickReport } from "@/lib/report-share";
import { haptic } from "@/lib/alarm";
import { useExitGuard } from "@/lib/exit-guard";
import { cn } from "@/lib/utils";

const PRIMARY_NAV = [
  { to: "/", label: "Timer", icon: Timer },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/timeline", label: "Timeline", icon: CalendarClock },
  { to: "/score", label: "Score", icon: Trophy },
] as const;

const MORE_NAV = [
  { to: "/achievements", label: "Badges", icon: Medal },
  { to: "/analysis", label: "Analysis", icon: LineChart },
  { to: "/history", label: "History", icon: History },
  { to: "/report", label: "Report", icon: FileText },
  { to: "/fun", label: "Leisure", icon: Gamepad2 },
  { to: "/ledger", label: "Points", icon: Coins },
  { to: "/wishlist", label: "Wishlist", icon: Gift },
  { to: "/communication", label: "Calls", icon: Phone },
  { to: "/arena", label: "Downtime", icon: Gauge },
  { to: "/data", label: "Backup", icon: Database },
  { to: "/dev", label: "Engine", icon: SlidersHorizontal },
] as const;


const THEMES = [
  { id: "indigo", label: "Nebula" },
  { id: "emerald", label: "Emerald" },
  { id: "ember", label: "Ember" },
  { id: "rose", label: "Rose" },
  { id: "mono", label: "Mono" },
  { id: "cyber", label: "Cyber Pulse" },
  { id: "aurora", label: "Aurora Ice" },
  { id: "sunset", label: "Sunset Drive" },
  { id: "ocean", label: "Deep Ocean" },
  { id: "dynamic", label: "Dynamic (progress)" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const state = useAppState();
  const [moreOpen, setMoreOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // keeps the native "display over other apps" exit guard in sync
  useExitGuard();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setMounted(true);
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const nowDate = new Date(now);
  const clock = nowDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  const dateLabel = formatDateDMY(nowDate);


  useEffect(() => {
    hydrate();
  }, []);

  // dynamic theme: hue driven by today's score vs the daily goal
  const todayKeyNow = dateKeyOf(nowDate);
  const dynRatio = Math.max(
    0,
    Math.min(
      1,
      computeDayScore(state.db[todayKeyNow], state.settings.coeff) /
        (state.settings.scoreTarget || 1),
    ),
  );

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", state.settings.theme);
    root.classList.toggle("dark", state.settings.dark);
  }, [state.settings.theme, state.settings.dark]);

  useEffect(() => {
    if (state.settings.theme !== "dynamic") return;
    // 20° (behind / red) → 150° (on target / green)
    document.documentElement.style.setProperty("--dyn-hue", String(20 + dynRatio * 130));
  }, [dynRatio, state.settings.theme]);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const inMore = MORE_NAV.some((n) => n.to === pathname);
  const gateOn = mounted && shareGateActive(state, nowDate);


  return (
    <div className="aurora-bg mx-auto flex min-h-[100dvh] w-full max-w-[560px] flex-col">
      <header className="safe-top sticky top-0 z-30 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-background/70 px-4 pb-1.5 backdrop-blur-xl">
        <div className="min-w-0">
          <div className="font-mono text-[15px] leading-none font-extrabold tabular-nums">
            {mounted ? clock : "--:--:--"}
          </div>
          <p className="truncate text-[11px] text-muted-foreground">{mounted ? dateLabel : "—"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeMenu />
          <button
            aria-label="Toggle dark mode"
            onClick={() => {
              haptic();
              setState((s) => {
                s.settings.dark = !s.settings.dark;
              });
            }}
            className="press grid h-8 w-8 place-items-center rounded-xl bg-secondary text-secondary-foreground hover:bg-accent"
          >
            {state.settings.dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>

      <main className="flex-1 px-3 pt-3 pb-28">
        {mounted ? (
          children
        ) : (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface-2" />
            ))}
          </div>
        )}
      </main>

      {gateOn ? <ShareGate state={state} nowDate={nowDate} /> : null}


      {moreOpen ? (
        <button
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-[2px]"
          onClick={() => setMoreOpen(false)}
        />
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[560px] border-t border-border bg-background/90 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
        {moreOpen ? (
          <div className="rise mb-2 grid grid-cols-4 gap-1.5 rounded-2xl bg-surface-2 p-2">
            {MORE_NAV.map((item) => (
              <NavItem key={item.to} {...item} active={pathname === item.to} />
            ))}
          </div>
        ) : null}
        <div className="grid grid-cols-5 gap-1">
          {PRIMARY_NAV.map((item) => (
            <NavItem key={item.to} {...item} active={pathname === item.to} />
          ))}
          <button
            onClick={() => {
              haptic();
              setMoreOpen((v) => !v);
            }}
            className={cn(
              "press flex flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-semibold",
              inMore || moreOpen ? "text-primary" : "text-muted-foreground",
            )}
          >
            {moreOpen ? (
              <X className="h-[18px] w-[18px]" />
            ) : (
              <Database className="h-[18px] w-[18px]" />
            )}
            More
          </button>
        </div>
      </nav>
    </div>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: typeof Timer;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      onClick={() => {
        haptic();
        if (to === "/timeline" && typeof window !== "undefined") {
          window.sessionStorage.setItem("ft_scroll_current_slot", "1");
        }
      }}
      className={cn(
        "press flex flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-semibold transition-colors",
        active ? "bg-accent text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-[18px] w-[18px]" />
      {label}
    </Link>
  );
}

function ThemeMenu() {
  const state = useAppState();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        aria-label="Change theme"
        onClick={() => setOpen((v) => !v)}
        className="press grid h-8 w-8 place-items-center rounded-xl bg-secondary text-secondary-foreground hover:bg-accent"
      >
        <Palette className="h-4 w-4" />
      </button>
      {open ? (
        <>
          <button className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div className="rise absolute right-0 z-20 mt-2 w-40 overflow-hidden rounded-2xl border border-border bg-popover p-1.5 shadow-[var(--shadow-soft)]">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  haptic();
                  setState((s) => {
                    s.settings.theme = t.id;
                  });
                  setOpen(false);
                }}
                className={cn(
                  "press flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium hover:bg-secondary",
                  state.settings.theme === t.id && "bg-accent text-accent-foreground",
                )}
              >
                {t.label}
                {state.settings.theme === t.id ? (
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                ) : null}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function ShareGate({ state, nowDate }: { state: ReturnType<typeof useAppState>; nowDate: Date }) {
  const [busy, setBusy] = useState(false);
  const key = prevDateKey(dateKeyOf(nowDate));
  const day = getDay(state, key);

  async function share() {
    setBusy(true);
    try {
      await shareQuickReport(state, key);
      markReportShared(key);
      haptic(20);
    } catch {
      /* user dismissed the share sheet */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-background/95 px-6 backdrop-blur-xl">
      <div className="rise surface-card glow-ring w-full max-w-sm p-5 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/12">
          <Share2 className="h-5 w-5 text-primary" />
        </div>
        <h2 className="mt-3 font-display text-xl font-extrabold">Close out {formatDateDMY(key)}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          It's past midnight. Share yesterday's report with at least one person to keep using
          the app — accountability first.
        </p>
        <div className="mt-3 rounded-2xl bg-surface-2 p-3 text-left text-xs text-muted-foreground">
          {(day.tasks ?? []).length} tasks · score{" "}
          {computeDayScore(day, state.settings.coeff).toFixed(0)} pts
        </div>
        <button
          disabled={busy}
          onClick={share}
          className="press gradient-fill mt-4 w-full rounded-2xl py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Sharing…" : "Share report & unlock"}
        </button>
        <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
          Sharing once is required — there is no way around it.
        </p>
      </div>
    </div>
  );
}
