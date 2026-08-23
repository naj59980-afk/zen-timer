import { useSyncExternalStore } from "react";

/* ---------------- Types ---------------- */

export type Tag = "Flow State" | "Shallow Work";
export const TAGS: Tag[] = ["Flow State", "Shallow Work"];

export type BreakTag = "Essential" | "Rest" | "Sleep" | "Entertainment";
export const BREAK_TAGS: BreakTag[] = ["Essential", "Rest", "Sleep", "Entertainment"];

export interface LogEntry {
  id: number;
  durationMins: number;
  tag: Tag;
  desc: string;
  timeRange: string;
  slotHour: string;
  start: number;
  end: number;
  /** true when the entry was typed in by hand (never counts toward the exit gate) */
  manual?: boolean;
}

export interface BreakEntry {
  id: number;
  tag: BreakTag;
  start: number;
  end: number;
  mins: number;
  slotHour: string;
}

export interface Step {
  id: number;
  name: string;
  completed: boolean;
}

export interface SubTask {
  id: number;
  name: string;
  completed: boolean;
  /** granular modules (reading / writing / memorisation …) */
  steps?: Step[];
  /** manually assigned minutes for this subtask */
  plannedMins?: number | null;
}

export interface Task {
  id: number;
  name: string;
  completed: boolean;
  comment?: string;
  subtasks?: SubTask[];
  /** optional deadline window expressed as hour numbers (0-23) */
  fromHour?: number | null;
  toHour?: number | null;
  /** planned minutes for the whole task, split evenly across subtasks */
  plannedMins?: number | null;
  /** timestamp when the task first reached 100% */
  completedAt?: number | null;
}


export interface SlotTodo {
  id: number;
  text: string;
}

/** Entertainment / leisure timer entry — deducts points at the flow rate. */
export interface FunEntry {
  id: number;
  start: number;
  end: number;
  mins: number;
  points: number;
  label: string;
}

export interface DayData {
  targetHours: number;
  tasks: Task[];
  logs: LogEntry[];
  breaks: BreakEntry[];
  funLogs: FunEntry[];
  slotTargets: Record<string, number>;
  slotAssignments: Record<string, string>;
  /** multiple task ids attached to one slot */
  slotTaskIds: Record<string, number[]>;
  /** the task the user is actively performing in a slot */
  slotActiveTask: Record<string, number>;
  slotNotes: Record<string, string>;
  slotTodos: Record<string, SlotTodo[]>;
  disabledSlots: string[];
  /** why a slot is switched off (e.g. "event", "class") — shown on the report */
  slotOffTags?: Record<string, string>;
  /** slots where the user acknowledged the lag alarm (silences it) */
  ackLagSlots: string[];
  scoreAdjust?: number;
  /** manual per-slot score adjustments keyed by slot label */
  slotScoreAdjust?: Record<string, number>;
  /** timestamp when the day's report was shared with someone */
  reportSharedAt?: number | null;
  /** slot keys the user checked in on at the hourly alarm */
  checkIns?: string[];
  /** free leisure minutes earned through hourly check-ins */
  funCreditMins?: number;
}



export interface Spend {
  id: number;
  date: string;
  reason: string;
  amount: number;
}

export interface Coefficients {
  /** points per hour of Flow State time */
  flowRate: number;
  /** points per hour of Shallow Work time */
  shallowRate: number;
  /** S factor applied when a slotted task overruns its window */
  lateFactor: number;
  minSlotTargetMins: number;
  downtimeGraceMins: number;
  dayStartHour: number;
  dayEndHour: number;
  /** flat bonus awarded for planning tasks for the day */
  planBonus: number;
  /** leisure minutes granted for checking in at the hourly alarm */
  checkInBonusMins: number;
}

export interface Contact {
  id: number;
  name: string;
  number: string;
}

export interface Settings {
  theme: string;
  dark: boolean;
  pomoWork: number;
  pomoBreak: number;
  soundOn: boolean;
  coeff: Coefficients;
  /** daily score goal — drives the progress bar on the timer page */
  scoreTarget: number;
  /** streak goal in days; reward = 200 * days when fully accomplished */
  streakTargetDays: number;
  /** streak lengths already rewarded (avoids double payouts) */
  streakClaims: { id: number; days: number; date: string; points: number }[];
  /** slot keys treated as sleep — collapsed into one bar on the report */
  sleepSlots: string[];
  /** a day scores 0 unless the next day gets planned within 12h of day end */
  planningRuleOn: boolean;
  /** after midnight the app locks until the day's report is shared */
  shareGateOn: boolean;
  /** what a day must reach to keep the streak alive */
  streakBaselineMode: "hours" | "points";
  /** baseline value in hours or points, depending on the mode */
  streakBaselineValue: number;
  /** native exit guard: block leaving the app unless the quota is met */
  exitGuardOn: boolean;
  /** flow minutes required before leisure (and exiting) is unlocked */
  guardMinFlowMins: number;
  /** daily points required before leisure (and exiting) is unlocked */
  guardMinPoints: number;
  /** ask which task the focus timer belongs to when it starts */
  taskPickerOn: boolean;
  /** reusable step names offered as a batch when building subtasks */
  commonSteps: string[];
  /** morning window that must hold enough flow, else the quota escalates */
  guardMorningFrom: number;
  guardMorningTo: number;
  guardMorningFlowMins: number;
  /** escalated quota when the morning window falls short */
  guardHardFlowMins: number;
  guardHardPoints: number;
  /** one leisure run may not exceed this many minutes */
  guardMaxLeisureMins: number;
  /** each further leisure run of the day multiplies the quota by this */
  guardEscalation: number;
  /** emergency override password (>32 chars), stored hashed */
  guardPasswordHash: string | null;
}

export interface TimerState {
  running: boolean;
  paused: boolean;
  mode: "stopwatch" | "pomodoro";
  startTime: number | null;
  accumulatedSeconds: number;
  sessionStart: number | null;
  tag: Tag;
  pomoPhase: "work" | "break";
  pomoRemainingSecs: number;
  pomoElapsedWorkSecs: number;
  /** when the timer last stopped / the user last left — used to log idle as a break */
  idleSince: number | null;
}


/** Todo / wishlist item — long-horizon wants, separate from daily tasks. */
export interface WishItem {
  id: number;
  text: string;
  note?: string;
  kind: "todo" | "wish";
  cost?: number;
  done: boolean;
  createdAt: number;
}

export interface AppState {
  db: Record<string, DayData>;
  spends: Spend[];
  settings: Settings;
  timer: TimerState;
  lastSession: { start: number; end: number; mins: number } | null;
  lastSeen: number;
  contacts: Contact[];
  wishlist: WishItem[];
}

/* ---------------- Defaults ---------------- */

export const DEFAULT_COEFF: Coefficients = {
  flowRate: 200,
  shallowRate: 100,
  lateFactor: 0.8,

  minSlotTargetMins: 0,
  downtimeGraceMins: 45,
  dayStartHour: 0,
  dayEndHour: 24,
  planBonus: 50,
  checkInBonusMins: 5,
};

const defaultTimer: TimerState = {
  running: false,
  paused: false,
  mode: "stopwatch",
  startTime: null,
  accumulatedSeconds: 0,
  sessionStart: null,
  tag: "Flow State",
  pomoPhase: "work",
  pomoRemainingSecs: 25 * 60,
  pomoElapsedWorkSecs: 0,
  idleSince: null,

};

const defaultState: AppState = {
  db: {},
  spends: [],
  settings: {
    theme: "indigo",
    dark: true,
    pomoWork: 25,
    pomoBreak: 5,
    soundOn: true,
    coeff: { ...DEFAULT_COEFF },
    scoreTarget: 1200,
    streakTargetDays: 15,
    streakClaims: [],
    sleepSlots: [],
    planningRuleOn: true,
    shareGateOn: true,
    streakBaselineMode: "hours",
    streakBaselineValue: 2,
    exitGuardOn: true,
    guardMinFlowMins: 120,
    guardMinPoints: 500,
    taskPickerOn: true,
    commonSteps: ["Read", "Write", "Memorise", "Practice", "Revise"],
    guardMorningFrom: 6,
    guardMorningTo: 12,
    guardMorningFlowMins: 120,
    guardHardFlowMins: 300,
    guardHardPoints: 1000,
    guardMaxLeisureMins: 30,
    guardEscalation: 1.5,
    guardPasswordHash: null,
  },
  timer: { ...defaultTimer },
  lastSession: null,
  lastSeen: 0,
  contacts: [],
  wishlist: [],
};

export const STORAGE_KEY = "flow_tracker_v2";

/* ---------------- Time helpers ---------------- */

export function dateKeyOf(d: Date | number): string {
  const dt = typeof d === "number" ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function todayKey() {
  return dateKeyOf(new Date());
}

export function slotKeyOfHour(h: number) {
  return `${String(h).padStart(2, "0")}:00 - ${String(h + 1).padStart(2, "0")}:00`;
}

/** 12-hour slot label, e.g. 6 -> "6AM", 13 -> "1PM". */
export function hourLabel(h: number): string {
  const ampm = h < 12 ? "AM" : "PM";
  const v = h % 12 === 0 ? 12 : h % 12;
  return `${String(v).padStart(2, "0")}${ampm}`;
}

/** Friendly slot range, e.g. "6AM – 7AM". */
export function slotLabel12(slot: string): string {
  const h = slotHourNumber(slot);
  return `${hourLabel(h)} – ${hourLabel(h + 1)}`;
}

/** Date formatted as dd/mm/yyyy from a dateKey (yyyy-mm-dd) or Date. */
export function formatDateDMY(d: Date | number | string): string {
  const dt =
    typeof d === "string"
      ? new Date(`${d}T12:00:00`)
      : typeof d === "number"
        ? new Date(d)
        : d;
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${dt.getFullYear()}`;
}

export const ALL_SLOTS = Array.from({ length: 24 }, (_, h) => slotKeyOfHour(h));

export function slotHourNumber(slot: string) {
  return parseInt(slot.slice(0, 2), 10);
}

export function formatHM(totalMins: number) {
  if (!totalMins || totalMins <= 0) return "0m";
  const h = Math.floor(totalMins / 60);
  const m = Math.round(totalMins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatClock(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDuration(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ---------------- Store ---------------- */

let state: AppState = defaultState;
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota */
  }
}

function emit() {
  listeners.forEach((l) => l());
}

export function getState() {
  return state;
}

export function setState(mutate: (draft: AppState) => void) {
  const next: AppState = JSON.parse(JSON.stringify(state));
  mutate(next);
  state = next;
  persist();
  emit();
}

export function replaceState(next: AppState) {
  state = normalize(next);
  persist();
  emit();
}

function normalize(raw: Partial<AppState>): AppState {
  const s: AppState = {
    ...defaultState,
    ...raw,
    settings: {
      ...defaultState.settings,
      ...(raw.settings ?? {}),
      coeff: { ...DEFAULT_COEFF, ...(raw.settings?.coeff ?? {}) },
      scoreTarget: raw.settings?.scoreTarget ?? 1200,
      streakTargetDays: raw.settings?.streakTargetDays ?? 15,
      streakClaims: raw.settings?.streakClaims ?? [],
      sleepSlots: raw.settings?.sleepSlots ?? [],
      planningRuleOn: raw.settings?.planningRuleOn ?? true,
      shareGateOn: raw.settings?.shareGateOn ?? true,
      streakBaselineMode: raw.settings?.streakBaselineMode ?? "hours",
      streakBaselineValue: raw.settings?.streakBaselineValue ?? 2,
      exitGuardOn: raw.settings?.exitGuardOn ?? true,
      guardMinFlowMins: raw.settings?.guardMinFlowMins ?? 120,
      guardMinPoints: raw.settings?.guardMinPoints ?? 500,
      taskPickerOn: raw.settings?.taskPickerOn ?? true,
      commonSteps: raw.settings?.commonSteps ?? ["Read", "Write", "Memorise", "Practice", "Revise"],
      guardMorningFrom: raw.settings?.guardMorningFrom ?? 6,
      guardMorningTo: raw.settings?.guardMorningTo ?? 12,
      guardMorningFlowMins: raw.settings?.guardMorningFlowMins ?? 120,
      guardHardFlowMins: raw.settings?.guardHardFlowMins ?? 300,
      guardHardPoints: raw.settings?.guardHardPoints ?? 1000,
      guardMaxLeisureMins: raw.settings?.guardMaxLeisureMins ?? 30,
      guardEscalation: raw.settings?.guardEscalation ?? 1.5,
      guardPasswordHash: raw.settings?.guardPasswordHash ?? null,
    },
    timer: { ...defaultTimer, ...(raw.timer ?? {}) },
    db: raw.db ?? {},
    spends: raw.spends ?? [],
    contacts: raw.contacts ?? [],
    wishlist: (raw.wishlist ?? []).map((w) => ({ ...w })),
  };
  for (const key of Object.keys(s.db)) {
    const d = s.db[key];
    s.db[key] = {
      targetHours: d.targetHours ?? 6,
      tasks: (d.tasks ?? []).map((t) => ({
        ...t,
        subtasks: (t.subtasks ?? []).map((x) => ({ ...x, steps: (x.steps ?? []).map((s) => ({ ...s })) })),
      })),

      logs: (d.logs ?? []).map((l) => ({ ...l })),
      breaks: (d.breaks ?? []).map((b) => ({ ...b })),
      funLogs: (d.funLogs ?? []).map((f) => ({ ...f })),
      slotTargets: d.slotTargets ?? {},
      slotAssignments: d.slotAssignments ?? {},
      slotTaskIds: d.slotTaskIds ?? {},
      slotActiveTask: d.slotActiveTask ?? {},
      slotNotes: d.slotNotes ?? {},
      slotTodos: d.slotTodos ?? {},
      disabledSlots: d.disabledSlots ?? [],
      slotOffTags: d.slotOffTags ?? {},
      ackLagSlots: d.ackLagSlots ?? [],
      scoreAdjust: d.scoreAdjust ?? 0,
      slotScoreAdjust: d.slotScoreAdjust ?? {},
      reportSharedAt: d.reportSharedAt ?? null,
      checkIns: d.checkIns ?? [],
      funCreditMins: d.funCreditMins ?? 0,
    };
  }

  return s;
}

let hydrated = false;
export function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      state = normalize(JSON.parse(raw));
    } else {
      // migrate from legacy single-file app if present
      const legacy = window.localStorage.getItem("flow_tracker_db");
      if (legacy) {
        state = normalize({ ...defaultState, db: JSON.parse(legacy) });
      }
    }
  } catch {
    state = defaultState;
  }
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, () => defaultState);
}

/* ---------------- Day access ---------------- */

export function blankDay(): DayData {
  return {
    targetHours: 6,
    tasks: [],
    logs: [],
    breaks: [],
    funLogs: [],
    slotTargets: {},
    slotAssignments: {},
    slotTaskIds: {},
    slotActiveTask: {},
    slotNotes: {},
    slotTodos: {},
    disabledSlots: [],
    slotOffTags: {},
    ackLagSlots: [],
    scoreAdjust: 0,
    slotScoreAdjust: {},
    reportSharedAt: null,
    checkIns: [],
    funCreditMins: 0,
  };

}

export function getDay(s: AppState, key: string): DayData {
  return s.db[key] ?? blankDay();
}

export function editDay(key: string, mutate: (d: DayData) => void) {
  setState((s) => {
    if (!s.db[key]) s.db[key] = blankDay();
    mutate(s.db[key]);
  });
}

/* ---------------- Session splitting ---------------- */

export interface Segment {
  dateKey: string;
  slotHour: string;
  start: number;
  end: number;
  mins: number;
}

/** Split a real session into per-hour-slot segments (e.g. 2:55–3:10 -> 5m + 10m). */
export function splitSession(start: number, end: number): Segment[] {
  const segs: Segment[] = [];
  let cursor = start;
  let guard = 0;
  while (cursor < end && guard++ < 500) {
    const d = new Date(cursor);
    const boundary = new Date(d);
    boundary.setMinutes(0, 0, 0);
    boundary.setHours(d.getHours() + 1);
    const segEnd = Math.min(end, boundary.getTime());
    const mins = (segEnd - cursor) / 60000;
    if (mins > 0.004) {
      segs.push({
        dateKey: dateKeyOf(cursor),
        slotHour: slotKeyOfHour(new Date(cursor).getHours()),
        start: cursor,
        end: segEnd,
        mins: Math.round(mins * 100) / 100,
      });
    }
    cursor = segEnd;
  }
  return segs;
}

export function addSession(
  start: number,
  end: number,
  tag: Tag,
  desc: string,
  manual = false,
) {
  const segs = splitSession(start, end);
  if (!segs.length) return;
  setState((s) => {
    segs.forEach((seg, i) => {
      if (!s.db[seg.dateKey]) s.db[seg.dateKey] = blankDay();
      s.db[seg.dateKey].logs.push({
        id: Date.now() + i,
        durationMins: seg.mins,
        tag,
        desc: desc || "Focus session",
        timeRange: `${formatClock(seg.start)} — ${formatClock(seg.end)}`,
        slotHour: seg.slotHour,
        start: seg.start,
        end: seg.end,
        manual,
      });
    });
    s.lastSession = { start, end, mins: (end - start) / 60000 };
  });
}

/** Log an idle / away period as a break, split per hour slot. */
export function addBreak(start: number, end: number, tag: BreakTag) {
  const segs = splitSession(start, end);
  if (!segs.length) return;
  setState((s) => {
    segs.forEach((seg, i) => {
      if (!s.db[seg.dateKey]) s.db[seg.dateKey] = blankDay();
      s.db[seg.dateKey].breaks.push({
        id: Date.now() + i,
        tag,
        start: seg.start,
        end: seg.end,
        mins: seg.mins,
        slotHour: seg.slotHour,
      });
    });
  });
}

/** Fractional progress of a subtask: steps drive it when present. */
export function subtaskProgress(s: SubTask): number {
  const steps = s.steps ?? [];
  if (steps.length) return steps.filter((x) => x.completed).length / steps.length;
  return s.completed ? 1 : 0;
}

/** Fractional progress of a task: subtasks (and their steps) drive it when present. */
export function taskProgress(t: Task): number {
  const subs = t.subtasks ?? [];
  if (subs.length) return subs.reduce((a, s) => a + subtaskProgress(s), 0) / subs.length;
  return t.completed ? 1 : 0;
}

/** Keeps completed / completedAt in sync with subtask + step progress. */
export function syncTaskCompletion(t: Task) {
  (t.subtasks ?? []).forEach((s) => {
    if ((s.steps ?? []).length) s.completed = subtaskProgress(s) >= 1;
  });
  const p = taskProgress(t);
  if ((t.subtasks ?? []).length) t.completed = p >= 1;
  if (t.completed) {
    if (!t.completedAt) t.completedAt = Date.now();
  } else {
    t.completedAt = null;
  }
}

/**
 * Domino-shift the contents (tasks / note / to-dos) of one slot into the next
 * enabled slot, cascading whatever that slot held onwards until an empty slot
 * absorbs the chain.
 */
export function dominoShiftSlot(d: DayData, fromSlot: string) {
  const disabled = new Set(d.disabledSlots);
  const chain = ALL_SLOTS.filter(
    (s) => slotHourNumber(s) > slotHourNumber(fromSlot) && !disabled.has(s),
  );

  let carryTasks = d.slotTaskIds[fromSlot] ?? [];
  let carryNote = d.slotNotes[fromSlot] ?? "";
  let carryTodos = d.slotTodos[fromSlot] ?? [];
  delete d.slotTaskIds[fromSlot];
  delete d.slotNotes[fromSlot];
  delete d.slotTodos[fromSlot];

  for (const slot of chain) {
    if (!carryTasks.length && !carryNote && !carryTodos.length) return;
    const nextTasks = d.slotTaskIds[slot] ?? [];
    const nextNote = d.slotNotes[slot] ?? "";
    const nextTodos = d.slotTodos[slot] ?? [];
    d.slotTaskIds[slot] = carryTasks;
    if (carryNote) d.slotNotes[slot] = carryNote;
    else delete d.slotNotes[slot];
    d.slotTodos[slot] = carryTodos;
    carryTasks = nextTasks;
    carryNote = nextNote;
    carryTodos = nextTodos;
  }
}




/* ---------------- Slot target distribution ---------------- */

export interface SlotInfo {
  slot: string;
  hour: number;
  disabled: boolean;
  targetMins: number;
  loggedMins: number;
  remainingMins: number;
  progress: number;
  explicit: boolean;
  assignment: string;
  logs: LogEntry[];
}

/**
 * Recalculates slot targets. Explicit targets are honoured. The remaining daily
 * target is distributed only across enabled, non-explicit slots that are still
 * ahead (>= current hour when viewing today). Past slots keep an even baseline.
 */
export function computeSlots(day: DayData, dateKey: string, now: Date): SlotInfo[] {
  const isToday = dateKey === dateKeyOf(now);
  const currentHour = isToday ? now.getHours() : 24;
  /** usable minutes still left inside the current hour */
  const minsLeftInCurrentHour = isToday
    ? Math.max(0, 60 - (now.getMinutes() + now.getSeconds() / 60))
    : 0;
  const dailyTargetMins = (day.targetHours || 0) * 60;
  const disabled = new Set(day.disabledSlots);

  const loggedBySlot: Record<string, LogEntry[]> = {};
  day.logs.forEach((l) => {
    (loggedBySlot[l.slotHour] ??= []).push(l);
  });
  const minsOf = (slot: string) =>
    (loggedBySlot[slot] ?? []).reduce((a, b) => a + b.durationMins, 0);

  const totalLogged = day.logs.reduce((a, b) => a + b.durationMins, 0);
  const enabled = ALL_SLOTS.filter((s) => !disabled.has(s));

  /** real remaining capacity of a slot (the current one is partly gone already) */
  const capacityOf = (slot: string) => {
    const h = slotHourNumber(slot);
    if (disabled.has(slot)) return 0;
    if (h < currentHour) return 0;
    return 60;
  };

  const futureAuto: string[] = [];
  let explicitFutureMins = 0;
  enabled.forEach((slot) => {
    const h = slotHourNumber(slot);
    if (h < currentHour) return;
    if (day.slotTargets[slot] !== undefined) explicitFutureMins += day.slotTargets[slot] * 60;
    else futureAuto.push(slot);
  });

  const remainingTarget = Math.max(0, dailyTargetMins - totalLogged - explicitFutureMins);
  // distribute proportional to the *real* remaining minutes of each slot
  const capTotal = futureAuto.reduce((a, s) => a + capacityOf(s), 0);
  const shareOf = (slot: string) =>
    capTotal > 0 ? (remainingTarget * capacityOf(slot)) / capTotal : 0;
  const baseline = enabled.length ? dailyTargetMins / enabled.length : 0;

  return ALL_SLOTS.map((slot) => {
    const hour = slotHourNumber(slot);
    const isDisabled = disabled.has(slot);
    const explicit = day.slotTargets[slot] !== undefined;
    const loggedMins = minsOf(slot);
    let targetMins = 0;
    if (isDisabled) targetMins = 0;
    else if (explicit) targetMins = day.slotTargets[slot] * 60;
    else if (hour === currentHour) targetMins = loggedMins + shareOf(slot);
    else if (hour > currentHour) targetMins = shareOf(slot);
    else targetMins = baseline;

    return {
      slot,
      hour,
      disabled: isDisabled,
      targetMins: Math.round(targetMins * 10) / 10,
      loggedMins,
      remainingMins: Math.max(0, targetMins - loggedMins),
      progress: targetMins > 0 ? Math.min(100, (loggedMins / targetMins) * 100) : 0,
      explicit,
      assignment: day.slotAssignments[slot] ?? "",
      logs: (loggedBySlot[slot] ?? []).sort((a, b) => a.start - b.start),
    };
  });
}

/**
 * Real pace requirement: remaining target divided by the minutes actually left
 * today (current slot counted only for the minutes still remaining in it).
 * Returns both the per-slot pace and the total usable minutes left.
 */
export function paceInfo(day: DayData, dateKey: string, now: Date) {
  const isToday = dateKey === dateKeyOf(now);
  const currentHour = isToday ? now.getHours() : 24;
  const minsLeftInCurrentHour = isToday
    ? Math.max(0, 60 - (now.getMinutes() + now.getSeconds() / 60))
    : 0;
  const disabled = new Set(day.disabledSlots);
  const logged = day.logs.reduce((a, b) => a + b.durationMins, 0);
  const remainingTarget = Math.max(0, (day.targetHours || 0) * 60 - logged);

  let usableMins = 0;
  let slotsLeft = 0;
  let fullSlotsLeft = 0;
  ALL_SLOTS.forEach((slot) => {
    const h = slotHourNumber(slot);
    if (disabled.has(slot) || h < currentHour) return;
    usableMins += h === currentHour ? minsLeftInCurrentHour : 60;
    slotsLeft += 1;
    if (h > currentHour) fullSlotsLeft += 1;
  });

  const currentUsable = disabled.has(slotKeyOfHour(currentHour)) ? 0 : minsLeftInCurrentHour;
  /**
   * Pace for each *whole* slot still ahead: whatever cannot be squeezed into
   * the remainder of the current slot has to be spread over the full slots.
   */
  const afterCurrent = Math.max(0, remainingTarget - currentUsable);
  const perSlot =
    fullSlotsLeft > 0 ? afterCurrent / fullSlotsLeft : Math.min(remainingTarget, currentUsable);

  return {
    remainingTarget,
    usableMins,
    slotsLeft,
    fullSlotsLeft,
    /** minutes of the current slot still usable */
    currentUsable,
    /** average minutes of study needed per remaining hour of clock time */
    perHour: usableMins > 0 ? (remainingTarget / usableMins) * 60 : 0,
    /** minutes needed in each remaining *full* slot */
    perSlot,
    /** the current slot has to be used end-to-end with no breaks */
    mustFillCurrent: remainingTarget >= currentUsable && currentUsable > 0,
    feasible: remainingTarget <= usableMins,
  };
}

/* ---------------- Per-slot n factor ---------------- */

/**
 * Per-slot n-factor with exception rules:
 *  - slots 6–7, 7–8, 8–9 share n = 2
 *  - first 5 slots since 6AM share n = 1
 *  - otherwise n = day task ratio (default scoring)
 */
export function slotNFactor(slot: string, day: DayData): number {
  const h = slotHourNumber(slot);
  const morningSlots = [6, 7, 8];
  if (morningSlots.includes(h)) return 2;
  const firstFive = [6, 7, 8, 9, 10];
  if (firstFive.includes(h)) return 1;
  return taskRatioOf(day);
}

/** Score for a single slot (using its own n-factor). */
export function computeSlotScore(
  slot: string,
  logs: LogEntry[],
  day: DayData,
  coeff: Coefficients,
): number {
  let flow = 0;
  let shallow = 0;
  logs.forEach((l) => {
    if (l.tag === "Flow State") flow += l.durationMins;
    else shallow += l.durationMins;
  });
  const n = slotNFactor(slot, day);
  const S = slotFactorOf(day, coeff);
  const base =
    (flow / 60) * coeff.flowRate * (1 + n) * S +
    (shallow / 60) * coeff.shallowRate * (1 + n / 2);
  return base + (day.slotScoreAdjust?.[slot] ?? 0);
}

/* ---------------- Scoring ---------------- */

export function dayTotals(day: DayData) {
  let total = 0;
  let flow = 0;
  let shallow = 0;
  day.logs.forEach((l) => {
    total += l.durationMins;
    if (l.tag === "Flow State") flow += l.durationMins;
    else shallow += l.durationMins;
  });
  return { total, flow, shallow };
}

/** n = achieved tasks / target tasks (partial subtask + step progress counts). */
export function taskRatioOf(day: DayData): number {
  const tasks = day.tasks ?? [];
  if (!tasks.length) return 0;
  return tasks.reduce((a, t) => a + taskProgress(t), 0) / tasks.length;
}

/** S factor: 1 when every slotted task finished inside its window, else lateFactor. */
export function slotFactorOf(day: DayData, coeff: Coefficients): number {
  const slotted = (day.tasks ?? []).filter(
    (t) => t.fromHour !== null && t.fromHour !== undefined,
  );
  if (!slotted.length) return 1;
  const late = slotted.some((t) => {
    const endHour = (t.toHour ?? t.fromHour!) + 1;
    if (taskProgress(t) < 1) return true;
    if (!t.completedAt) return false;
    const d = new Date(t.completedAt);
    return d.getHours() + d.getMinutes() / 60 > endHour;
  });
  return late ? coeff.lateFactor : 1;
}

/**
 * Total daily points
 *  = flowHours * flowRate * (1 + n) * S  +  shallowHours * shallowRate * (1 + n/2)
 */
export function computeDayScore(day: DayData | undefined, coeff: Coefficients): number {
  if (!day) return 0;
  const { flow, shallow } = dayTotals(day);
  const n = taskRatioOf(day);
  const S = slotFactorOf(day, coeff);
  const base =
    (flow / 60) * coeff.flowRate * (1 + n) * S +
    (shallow / 60) * coeff.shallowRate * (1 + n / 2);
  const planBonus = (day.tasks ?? []).length > 0 ? (coeff.planBonus ?? 0) : 0;
  return base + planBonus + (day.scoreAdjust ?? 0) - funPenalty(day);
}

/** Points deducted by entertainment time (charged at the flow rate). */
export function funPenalty(day: DayData | undefined): number {
  return (day?.funLogs ?? []).reduce((a, f) => a + f.points, 0);
}

/** Points that will be deducted for `mins` of entertainment. */
export function funCost(mins: number, coeff: Coefficients): number {
  return (mins / 60) * coeff.flowRate;
}

/* ---------------- Planning rule ---------------- */

/**
 * A day's points are wiped when the next day was never planned:
 * 12h after the day ended (i.e. from noon the following day) the next day must
 * have at least one task AND at least one completed task, otherwise the earlier
 * day scores 0.
 */
export function planningVoided(
  s: AppState,
  dateKey: string,
  now: number = Date.now(),
): boolean {
  if (!s.settings.planningRuleOn) return false;
  const nextKey = nextDateKey(dateKey);
  const deadline = new Date(`${nextKey}T12:00:00`).getTime();
  if (now < deadline) return false;
  const next = s.db[nextKey];
  const tasks = next?.tasks ?? [];
  if (!tasks.length) return true;
  return !tasks.some((t) => taskProgress(t) >= 1);
}

/** Day score after the planning rule is applied. */
export function effectiveDayScore(
  s: AppState,
  dateKey: string,
  now: number = Date.now(),
): number {
  if (planningVoided(s, dateKey, now)) return 0;
  return computeDayScore(s.db[dateKey], s.settings.coeff);
}

export function lifetimeScores(s: AppState) {
  let gross = 0;
  let month = 0;
  const prefix = todayKey().slice(0, 7);
  const now = Date.now();
  for (const key of Object.keys(s.db)) {
    const sc = effectiveDayScore(s, key, now);
    gross += sc;
    if (key.startsWith(prefix)) month += sc;
  }
  const spent = s.spends.reduce((a, b) => a + b.amount, 0);
  const bonus = (s.settings.streakClaims ?? []).reduce((a, b) => a + b.points, 0);
  return { gross: gross + bonus, month, spent, bonus, net: gross + bonus - spent };
}

/* ---------------- Cross-page slot task names ---------------- */

/** Unified task names attached to a slot, used on timer / tasks / timeline pages. */
export function slotTaskNames(slot: string, day: DayData): string[] {
  const ids = day.slotTaskIds?.[slot] ?? [];
  const names = ids
    .map((id) => day.tasks.find((t) => t.id === id))
    .filter((t): t is Task => Boolean(t))
    .map((t) => t.name);
  if (day.slotAssignments?.[slot]) names.unshift(day.slotAssignments[slot]);
  return names;
}

/** Break minutes for a day, grouped by break tag. */
export function breakTotals(day: DayData) {
  const byTag: Record<string, number> = {};
  let total = 0;
  (day.breaks ?? []).forEach((b) => {
    total += b.mins;
    byTag[b.tag] = (byTag[b.tag] ?? 0) + b.mins;
  });
  return { total, byTag };
}


/* ---------------- Streaks ---------------- */

export function prevDateKey(key: string, back = 1): string {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() - back);
  return dateKeyOf(d);
}

export function nextDateKey(key: string, forward = 1): string {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + forward);
  return dateKeyOf(d);
}

export function totalMinsOf(db: Record<string, DayData>, key: string): number {
  return (db[key]?.logs ?? []).reduce((a, l) => a + l.durationMins, 0);
}

export interface StreakBaseline {
  mode: "hours" | "points";
  value: number;
  coeff: Coefficients;
}

/** What a day achieved in the unit the streak baseline is measured in. */
export function streakMetricOf(
  db: Record<string, DayData>,
  key: string,
  baseline: StreakBaseline,
): number {
  if (baseline.mode === "points") return computeDayScore(db[key], baseline.coeff);
  return totalMinsOf(db, key) / 60;
}

/**
 * Streak = consecutive days ending today (or yesterday when today is still
 * empty) that met the baseline. Without a baseline the legacy "never log less
 * than the day before" rule applies.
 */
export function computeStreak(
  db: Record<string, DayData>,
  todayK = todayKey(),
  baseline?: StreakBaseline,
) {
  const meets = (key: string) =>
    baseline
      ? streakMetricOf(db, key, baseline) >= baseline.value
      : totalMinsOf(db, key) > 0;

  let cursor = meets(todayK) ? todayK : prevDateKey(todayK);
  let count = 0;
  let guard = 0;
  while (guard++ < 400) {
    if (!meets(cursor)) break;
    if (!baseline) {
      const prevMins = totalMinsOf(db, prevDateKey(cursor));
      count += 1;
      if (prevMins <= 0) break;
      if (totalMinsOf(db, cursor) < prevMins) break;
    } else {
      count += 1;
    }
    cursor = prevDateKey(cursor);
  }
  return {
    count,
    todayMins: totalMinsOf(db, todayK),
    yesterdayMins: totalMinsOf(db, prevDateKey(todayK)),
  };
}

/** Streak state for the app, using the user's configured baseline. */
export function streakStatus(s: AppState, now: Date = new Date()) {
  const baseline: StreakBaseline = {
    mode: s.settings.streakBaselineMode ?? "hours",
    value: s.settings.streakBaselineValue ?? 2,
    coeff: s.settings.coeff,
  };
  const key = dateKeyOf(now);
  const streak = computeStreak(s.db, key, baseline);
  const achieved = streakMetricOf(s.db, key, baseline);
  const remaining = Math.max(0, baseline.value - achieved);
  const hoursLeftToday =
    24 - (now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600);
  const n = taskRatioOf(getDay(s, key));
  /** points earned per hour of flow-state work right now */
  const pointsPerHour = Math.max(1, (s.settings.coeff.flowRate || 200) * (1 + n));
  const minsNeeded =
    baseline.mode === "hours" ? remaining * 60 : (remaining / pointsPerHour) * 60;
  return {
    ...streak,
    baseline,
    achieved,
    /** how much more is needed today (hours or points) */
    remaining,
    safe: remaining <= 0,
    /** clock hours left before midnight ends the day */
    hoursLeftToday,
    /** current points-per-flow-hour rate (flowRate * (1 + n)) */
    pointsPerHour,
    /** minutes of flow work still required today, in both modes */
    minsNeeded,
    /** hours of flow work still required today */
    hoursNeeded: minsNeeded / 60,
  };
}

/** Copy every unfinished task of one day into another day. */
export function carryTasksForward(fromKey: string, toKey: string): number {
  let moved = 0;
  setState((s) => {
    const from = s.db[fromKey];
    if (!from) return;
    if (!s.db[toKey]) s.db[toKey] = blankDay();
    const target = s.db[toKey];
    const existing = new Set(target.tasks.map((t) => t.name));
    from.tasks
      .filter((t) => taskProgress(t) < 1 && !existing.has(t.name))
      .forEach((t, i) => {
        moved += 1;
        target.tasks.push({
          ...JSON.parse(JSON.stringify(t)),
          id: Date.now() + i,
          completedAt: null,
        });
      });
  });
  return moved;
}

/* ---------------- Backup parsing / merging ---------------- */

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Accepts any Flow Tracker backup shape and returns a normalized AppState:
 *  - current format: { db, spends, settings, … }
 *  - older exports missing spends / settings / timer
 *  - legacy single-file exports: a bare map of "yyyy-mm-dd" -> day data
 *  - a wrapper like { state: {...} } or { data: {...} }
 */
export function parseBackup(text: string): AppState | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  let obj = raw as Record<string, unknown>;
  if (!obj.db && obj.state && typeof obj.state === "object") obj = obj.state as Record<string, unknown>;
  if (!obj.db && obj.data && typeof obj.data === "object") obj = obj.data as Record<string, unknown>;

  if (!obj.db) {
    // bare day map?
    const keys = Object.keys(obj).filter((k) => DATE_KEY_RE.test(k));
    if (!keys.length) return null;
    const db: Record<string, DayData> = {};
    keys.forEach((k) => (db[k] = obj[k] as DayData));
    return normalize({ db } as Partial<AppState>);
  }
  if (typeof obj.db !== "object" || obj.db === null) return null;
  return normalize(obj as Partial<AppState>);
}

/** Merge an incoming backup into the current state without losing anything. */
export function mergeBackup(incoming: AppState) {
  const current = getState();
  const db = { ...current.db };
  for (const key of Object.keys(incoming.db)) {
    const a = db[key];
    const b = incoming.db[key];
    if (!a) {
      db[key] = b;
      continue;
    }
    const ids = new Set(a.logs.map((l) => l.id));
    const breakIds = new Set((a.breaks ?? []).map((l) => l.id));
    db[key] = {
      ...b,
      ...a,
      logs: [...a.logs, ...b.logs.filter((l) => !ids.has(l.id))],
      breaks: [...(a.breaks ?? []), ...(b.breaks ?? []).filter((l) => !breakIds.has(l.id))],
      tasks: a.tasks.length ? a.tasks : b.tasks,
      slotTargets: { ...b.slotTargets, ...a.slotTargets },
      slotAssignments: { ...b.slotAssignments, ...a.slotAssignments },
      slotTaskIds: { ...b.slotTaskIds, ...a.slotTaskIds },
      slotNotes: { ...b.slotNotes, ...a.slotNotes },
      slotTodos: { ...b.slotTodos, ...a.slotTodos },
      disabledSlots: Array.from(new Set([...a.disabledSlots, ...b.disabledSlots])),
    };
  }
  const spendIds = new Set(current.spends.map((s) => s.id));
  replaceState({
    ...current,
    db,
    spends: [...current.spends, ...(incoming.spends ?? []).filter((s) => !spendIds.has(s.id))],
  });
}

/** Summary counts for a parsed backup, used in the import confirmation UI. */
export function backupStats(s: AppState) {
  const days = Object.keys(s.db).length;
  const logs = Object.values(s.db).reduce((a, d) => a + (d.logs?.length ?? 0), 0);
  return { days, logs };
}

/* ---------------- Planned time, check-ins, report sharing ---------------- */

/** Minutes assigned to a task: explicit plan, else the sum of its subtasks. */
export function taskAssignedMins(t: Task): number {
  const subs = (t.subtasks ?? []).reduce((a, s) => a + (s.plannedMins ?? 0), 0);
  if (t.plannedMins) return Math.max(t.plannedMins, subs);
  return subs;
}

/** Total minutes assigned across every task of a day. */
export function plannedTotalMins(day: DayData): number {
  return (day.tasks ?? []).reduce((a, t) => a + taskAssignedMins(t), 0);
}

/** Hourly check-in: grants free leisure minutes once per slot. */
export function checkInSlot(dateKey: string, slot: string, bonusMins: number): boolean {
  let granted = false;
  editDay(dateKey, (d) => {
    const done = d.checkIns ?? [];
    if (done.includes(slot)) return;
    d.checkIns = [...done, slot];
    d.funCreditMins = (d.funCreditMins ?? 0) + bonusMins;
    granted = true;
  });
  return granted;
}

/** Consume free leisure credit, returning the minutes that must still be paid. */
export function consumeFunCredit(dateKey: string, mins: number): number {
  let chargeable = mins;
  editDay(dateKey, (d) => {
    const credit = d.funCreditMins ?? 0;
    const used = Math.min(credit, mins);
    d.funCreditMins = credit - used;
    chargeable = mins - used;
  });
  return chargeable;
}

/** Record that the day's report was shared with someone. */
export function markReportShared(dateKey: string) {
  editDay(dateKey, (d) => {
    d.reportSharedAt = Date.now();
  });
}

/** True when the after-midnight lock should block the app. */
export function shareGateActive(s: AppState, now: Date = new Date()): boolean {
  if (now.getHours() >= 5) return false; // only the 00:00 – 05:00 window
  const yesterday = prevDateKey(dateKeyOf(now));
  const day = s.db[yesterday];
  if (!day) return false;
  const hadActivity = (day.logs ?? []).length > 0 || (day.tasks ?? []).length > 0;
  if (!hadActivity) return false;
  return !day.reportSharedAt;
}

/* ---------------- Time accounting per task ---------------- */

/** Minutes actually logged against a task (through the slots it is attached to). */
export function taskSpentMins(day: DayData, taskId: number): number {
  const bySlot: Record<string, number> = {};
  (day.logs ?? []).forEach((l) => {
    bySlot[l.slotHour] = (bySlot[l.slotHour] ?? 0) + l.durationMins;
  });
  let mins = 0;
  ALL_SLOTS.forEach((slot) => {
    const ids = day.slotTaskIds?.[slot] ?? [];
    if (!ids.includes(taskId)) return;
    const logged = bySlot[slot] ?? 0;
    if (!logged) return;
    const active = day.slotActiveTask?.[slot];
    // an explicitly active task owns the slot, otherwise the slot is shared
    mins += active === taskId ? logged : active ? 0 : logged / ids.length;
  });
  return Math.round(mins * 10) / 10;
}

/** allocated − spent for a task (never below zero). */
export function taskTimeLeftMins(day: DayData, t: Task): number {
  return Math.max(0, taskAssignedMins(t) - taskSpentMins(day, t.id));
}

/** Minutes assigned to a subtask (explicit, else its share of the task plan). */
export function subtaskAssignedMins(t: Task, s: SubTask): number {
  if (s.plannedMins) return s.plannedMins;
  const subs = t.subtasks ?? [];
  if (t.plannedMins && subs.length) return Math.round(t.plannedMins / subs.length);
  return 0;
}

/**
 * Required time for the day
 *  = total assigned time − time assigned to already completed tasks.
 */
export function requiredTimeMins(day: DayData): number {
  const tasks = day.tasks ?? [];
  const assigned = plannedTotalMins(day);
  const done = tasks
    .filter((t) => taskProgress(t) >= 1)
    .reduce((a, t) => a + taskAssignedMins(t), 0);
  return Math.max(0, assigned - done);
}

/** Copy the given tasks of one day onto another day (progress reset). */
export function copyTasksTo(fromKey: string, ids: number[], toKey: string): number {
  let copied = 0;
  setState((s) => {
    const from = s.db[fromKey];
    if (!from) return;
    if (!s.db[toKey]) s.db[toKey] = blankDay();
    const target = s.db[toKey];
    from.tasks
      .filter((t) => ids.includes(t.id))
      .forEach((t, i) => {
        const clone: Task = JSON.parse(JSON.stringify(t));
        clone.id = Date.now() + i;
        clone.completed = false;
        clone.completedAt = null;
        clone.subtasks = (clone.subtasks ?? []).map((sub, j) => ({
          ...sub,
          id: Date.now() + i * 1000 + j + 1,
          completed: false,
          steps: (sub.steps ?? []).map((st, k) => ({
            ...st,
            id: Date.now() + i * 10000 + j * 100 + k + 2,
            completed: false,
          })),
        }));
        target.tasks.push(clone);
        copied += 1;
      });
  });
  return copied;
}
