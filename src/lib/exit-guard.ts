import { registerPlugin } from "@capacitor/core";
import { useEffect, useState } from "react";
import {
  computeDayScore,
  getDay,
  todayKey,
  useAppState,
  type AppState,
  type DayData,
} from "@/lib/store";
import { isNativeApp } from "@/lib/native";

export interface GuardStatus {
  native: boolean;
  overlay: boolean;
  blocked: boolean;
}

interface ExitGuardPlugin {
  status(): Promise<GuardStatus>;
  requestOverlay(): Promise<{ overlay: boolean }>;
  setGuard(o: {
    blocked: boolean;
    reason: string;
    overrideUntil: number;
    guardOn: boolean;
  }): Promise<void>;
  dismiss(): Promise<void>;
}

const ExitGuard = registerPlugin<ExitGuardPlugin>("ExitGuard");

const OFF: GuardStatus = { native: false, overlay: false, blocked: false };

export async function guardStatus(): Promise<GuardStatus> {
  if (!isNativeApp()) return OFF;
  try {
    return await ExitGuard.status();
  } catch {
    return OFF;
  }
}

/** Opens the Android "display over other apps" settings screen. */
export async function requestOverlayPermission(): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const r = await ExitGuard.requestOverlay();
    return Boolean(r?.overlay);
  } catch {
    return false;
  }
}

export async function pushGuard(blocked: boolean, reason: string) {
  if (!isNativeApp()) return;
  try {
    await ExitGuard.setGuard({ blocked, reason });
  } catch {
    /* plugin missing on older builds */
  }
}

export interface LeisureRun {
  /** timer is ticking right now */
  on: boolean;
  /** minutes accumulated in the current (not yet committed) run */
  mins: number;
}

/** Reads the leisure timer that lives on /fun. */
export function leisureRun(): LeisureRun {
  if (typeof window === "undefined") return { on: false, mins: 0 };
  try {
    const raw = window.localStorage.getItem("ft_fun_timer");
    if (!raw) return { on: false, mins: 0 };
    const p = JSON.parse(raw) as { start: number | null; accum?: number };
    const accum = Number(p?.accum ?? 0);
    if (!p?.start) return { on: false, mins: accum / 60 };
    return { on: true, mins: (accum + (Date.now() - p.start) / 1000) / 60 };
  } catch {
    return { on: false, mins: 0 };
  }
}

/** True while the leisure timer on /fun is running. */
export function leisureRunning(): boolean {
  return leisureRun().on;
}

/** A copy of the day with hand-typed entries stripped out. */
function earnedDay(day: DayData): DayData {
  return { ...day, logs: (day.logs ?? []).filter((l) => !l.manual) };
}

export interface GateInfo {
  /** flow-state minutes logged today by the timer (manual entries excluded) */
  flowMins: number;
  /** points earned today, manual entries excluded */
  points: number;
  minFlowMins: number;
  minPoints: number;
  /** flow minutes logged inside the morning window */
  morningFlowMins: number;
  morningTargetMins: number;
  morningOk: boolean;
  /** how many leisure runs already happened today (escalates the quota) */
  leisureRuns: number;
  /** quota multiplier applied to this leisure run */
  multiplier: number;
  /** minutes allowed in one leisure run */
  maxLeisureMins: number;
  /** minutes left in the current leisure run */
  leisureLeftMins: number;
  /** current run has hit the 30-minute cap */
  leisureExpired: boolean;
  /** the quota that unlocks leisure is met */
  quotaMet: boolean;
  /** leisure timer currently running */
  leisureOn: boolean;
  /** exiting the app is blocked right now */
  blocked: boolean;
  /** emergency override running; epoch ms when it expires */
  overrideActive: boolean;
  overrideUntil: number | null;
  reason: string;
}

export function computeGate(
  state: AppState,
  leisureOn: boolean,
  leisureMins = 0,
): GateInfo {
  const s = state.settings;
  const key = todayKey();
  const day = getDay(state, key);
  const earned = earnedDay(day);

  // flow minutes and points from timer-logged work only
  let flow = 0;
  let morningFlow = 0;
  const from = s.guardMorningFrom ?? 6;
  const to = s.guardMorningTo ?? 12;
  earned.logs.forEach((l) => {
    if (l.tag !== "Flow State") return;
    flow += l.durationMins;
    const h = new Date(l.start).getHours();
    if (h >= from && h < to) morningFlow += l.durationMins;
  });
  const points = computeDayScore(earned, s.coeff);

  const morningTargetMins = s.guardMorningFlowMins ?? 120;
  const morningOk = morningFlow >= morningTargetMins;

  const baseFlow = morningOk ? (s.guardMinFlowMins ?? 120) : (s.guardHardFlowMins ?? 300);
  const basePoints = morningOk ? (s.guardMinPoints ?? 500) : (s.guardHardPoints ?? 1000);

  const leisureRuns = (day.funLogs ?? []).length;
  const escalation = s.guardEscalation ?? 1.5;
  const multiplier = Math.pow(escalation, leisureRuns);
  const minFlowMins = baseFlow * multiplier;
  const minPoints = basePoints * multiplier;

  const maxLeisureMins = s.guardMaxLeisureMins ?? 30;
  const leisureExpired = leisureOn && leisureMins >= maxLeisureMins;
  const leisureLeftMins = Math.max(0, maxLeisureMins - leisureMins);

  // dynamic: re-evaluated on every state change / tick, so a points drop re-locks
  const overrideUntil = s.guardDisabledUntil ?? null;
  const overrideActive = Boolean(overrideUntil && overrideUntil > Date.now());
  const quotaMet = overrideActive || flow >= minFlowMins || points >= minPoints;
  const on = s.exitGuardOn !== false && !overrideActive;
  const leisureActive = leisureOn && !leisureExpired;
  const blocked = on && !(leisureActive && quotaMet);

  const missFlow = Math.max(0, minFlowMins - flow);
  const missPoints = Math.max(0, minPoints - points);
  const reason = overrideActive
    ? "Emergency override active — the guard is off for now."
    : !quotaMet
    ? `Leisure is locked: ${Math.round(missFlow)}m more flow or ${Math.round(missPoints)} more points today` +
      (morningOk ? "." : " (morning window missed — quota raised).") +
      (leisureRuns ? ` Run #${leisureRuns + 1} costs ${multiplier.toFixed(2)}x.` : "")
    : leisureExpired
      ? `That leisure run hit the ${maxLeisureMins}-minute cap. Stop it and earn the next unlock.`
      : "Start the leisure timer before leaving the app.";

  return {
    flowMins: flow,
    points,
    minFlowMins,
    minPoints,
    morningFlowMins: morningFlow,
    morningTargetMins,
    morningOk,
    leisureRuns,
    multiplier,
    maxLeisureMins,
    leisureLeftMins,
    leisureExpired,
    quotaMet,
    leisureOn,
    blocked,
    overrideActive,
    overrideUntil,
    reason,
  };
}

/** Keeps the native guard in sync with the current productivity gate. */
export function useExitGuard(): GateInfo {
  const state = useAppState();
  const [run, setRun] = useState<LeisureRun>({ on: false, mins: 0 });

  useEffect(() => {
    const tick = () => setRun(leisureRun());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const gate = computeGate(state, run.on, run.mins);

  useEffect(() => {
    void pushGuard(gate.blocked, gate.reason);
  }, [gate.blocked, gate.reason]);

  return gate;
}

/** SHA-256 hex of the override password. */
export async function hashPassword(pw: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const GUARD_MIN_PASSWORD = 32;
