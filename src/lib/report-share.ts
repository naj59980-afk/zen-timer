import {
  computeDayScore,
  dayTotals,
  formatDateDMY,
  formatHM,
  getDay,
  plannedTotalMins,
  taskProgress,
  type AppState,
} from "@/lib/store";
import { shareTextFile } from "@/lib/share";

/** Compact plain-text daily summary — small enough for any messaging app. */
export function buildQuickReportText(s: AppState, dateKey: string): string {
  const day = getDay(s, dateKey);
  const totals = dayTotals(day);
  const score = computeDayScore(day, s.settings.coeff);
  const tasks = day.tasks ?? [];
  const done = tasks.filter((t) => taskProgress(t) >= 1).length;
  const lines = [
    `Flow Tracker — ${formatDateDMY(dateKey)}`,
    `Focus: ${formatHM(totals.total)} of ${formatHM((day.targetHours || 0) * 60)} target`,
    `Flow ${formatHM(totals.flow)} · Shallow ${formatHM(totals.shallow)}`,
    `Score: ${score.toFixed(0)} pts`,
    `Tasks: ${done}/${tasks.length} complete · ${formatHM(plannedTotalMins(day))} planned`,
    "",
    ...tasks.map(
      (t) => `${taskProgress(t) >= 1 ? "[x]" : "[ ]"} ${t.name} — ${Math.round(taskProgress(t) * 100)}%`,
    ),
  ];
  return lines.join("\n");
}

/** Share the daily summary with at least one person. */
export async function shareQuickReport(s: AppState, dateKey: string) {
  const text = buildQuickReportText(s, dateKey);
  const nav =
    typeof navigator !== "undefined"
      ? (navigator as Navigator & { share?: (d: unknown) => Promise<void> })
      : null;
  if (nav?.share) {
    await nav.share({ title: `Flow report — ${formatDateDMY(dateKey)}`, text });
    return;
  }
  await shareTextFile({
    filename: `flow-report-${dateKey}.txt`,
    text,
    title: `Flow report — ${formatDateDMY(dateKey)}`,
  });
}
