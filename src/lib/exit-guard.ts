import { registerPlugin } from "@capacitor/core";
import { useEffect, useState } from "react";
import {
  computeDayScore,
  dayTotals,
  getDay,
  todayKey,
  useAppState,
  type AppState,
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
  setGuard(o: { blocked: boolean; reason: string }): Promise<void>;
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

/** True while the leisure timer on /fun is running. */
export function leisureRunning(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem("ft_fun_timer");
    if (!raw) return false;
    const p = JSON.parse(raw) as { start: number | null };
    return Boolean(p?.start);
  } catch {
    return false;
  }
}

export interface GateInfo {
  /** flow-state minutes logged today */
  flowMins: number;
  /** points earned today */
  points: number;
  minFlowMins: number;
  minPoints: number;
  /** the quota that unlocks leisure is met */
  quotaMet: boolean;
  /** leisure timer currently running */
  leisureOn: boolean;
  /** exiting the app is blocked right now */
  blocked: boolean;
  reason: string;
}

export function computeGate(state: AppState, leisureOn: boolean): GateInfo {
  const key = todayKey();
  const day = getDay(state, key);
  const { flow } = dayTotals(day);
  const points = computeDayScore(day, state.settings.coeff);
  const minFlowMins = state.settings.guardMinFlowMins ?? 120;
  const minPoints = state.settings.guardMinPoints ?? 500;
  const quotaMet = flow >= minFlowMins || points >= minPoints;
  const on = state.settings.exitGuardOn !== false;
  const blocked = on && !(leisureOn && quotaMet);

  const missFlow = Math.max(0, minFlowMins - flow);
  const missPoints = Math.max(0, minPoints - points);
  const reason = !quotaMet
    ? `Leisure is locked: ${Math.round(missFlow)}m of flow or ${Math.round(missPoints)} more points needed today.`
    : "Start the leisure timer before leaving the app.";

  return { flowMins: flow, points, minFlowMins, minPoints, quotaMet, leisureOn, blocked, reason };
}

/** Keeps the native guard in sync with the current productivity gate. */
export function useExitGuard(): GateInfo {
  const state = useAppState();
  const [leisureOn, setLeisureOn] = useState(false);

  useEffect(() => {
    const tick = () => setLeisureOn(leisureRunning());
    tick();
    const id = window.setInterval(tick, 2000);
    return () => window.clearInterval(id);
  }, []);

  const gate = computeGate(state, leisureOn);

  useEffect(() => {
    void pushGuard(gate.blocked, gate.reason);
  }, [gate.blocked, gate.reason]);

  return gate;
}
