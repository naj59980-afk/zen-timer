import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download, FileText, Image as ImageIcon, Share2 } from "lucide-react";
import { shareReportOverWifi } from "@/lib/share";
import {
  ALL_SLOTS,
  setState,
  breakTotals,
  computeDayScore,
  computeSlots,
  dayTotals,
  formatHM,
  formatDateDMY,
  getDay,
  slotLabel12,
  slotTaskNames,
  taskProgress,
  todayKey,
  useAppState,
} from "@/lib/store";
import { Btn, Card, DateInput, SectionTitle, useHydrated } from "@/components/kit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Daily Report — Downloadable Focus Summary" },
      {
        name: "description",
        content:
          "Download a single-page report of the day: slot-by-slot study time, task completion, achievement and score.",
      },
      { property: "og:title", content: "Daily Report — Downloadable Focus Summary" },
      {
        property: "og:description",
        content: "Download a self-contained single-page summary of your focus day.",
      },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const state = useAppState();
  const hydrated = useHydrated();
  const [date, setDate] = useState(todayKey());
  const day = getDay(state, date);
  const slots = computeSlots(day, date, new Date());
  const totals = dayTotals(day);
  const breaks = breakTotals(day);
  const score = computeDayScore(state.db[date], state.settings.coeff);
  const targetMins = (day.targetHours || 0) * 60;
  const dayPct = targetMins ? Math.min(100, (totals.total / targetMins) * 100) : 0;
  const sleepSet = new Set(state.settings.sleepSlots ?? []);
  const usedSlots = slots.filter(
    (s) => !s.disabled && !sleepSet.has(s.slot) && (s.loggedMins > 0 || s.targetMins > 0),
  );
  const sleepSlots = slots.filter((s) => sleepSet.has(s.slot));
  // group contiguous sleep hours so a split schedule (e.g. 11PM–2AM + 5–6AM) reads cleanly
  const sleepRanges: string[] = [];
  for (let i = 0; i < sleepSlots.length; i++) {
    const startIdx = i;
    while (
      i + 1 < sleepSlots.length &&
      slots.indexOf(sleepSlots[i + 1]) === slots.indexOf(sleepSlots[i]) + 1
    )
      i++;
    const from = slotLabel12(sleepSlots[startIdx].slot).split(" – ")[0];
    const to = slotLabel12(sleepSlots[i].slot).split(" – ").pop();
    sleepRanges.push(`${from} – ${to}`);
  }
  const sleepLabel = sleepRanges.join(", ");
  const sleepMins = sleepSlots.length * 60;
  const offSlots = slots
    .filter((s) => s.disabled && !sleepSet.has(s.slot))
    .map((s) => ({ slot: s.slot, tag: day.slotOffTags?.[s.slot] ?? "Off" }));
  const tasks = day.tasks ?? [];
  const taskPct = tasks.length
    ? (tasks.reduce((a, t) => a + taskProgress(t), 0) / tasks.length) * 100
    : 0;
  const scoreGoal = state.settings.scoreTarget || 1;

  function reportHtml() {
    return buildStandaloneHtml({
      dateLabel: formatDateDMY(date),
      totals,
      breaks,
      score,
      targetMins,
      dayPct,
      scoreGoal,
      usedSlots,
      sleepLabel,
      sleepMins,
      offSlots,
      tasks,
      taskPct,
      day,
    });
  }

  function downloadHtml() {
    const blob = new Blob([reportHtml()], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flow-report-${date}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(reportHtml());
    w.document.close();
    setTimeout(() => {
      w.focus();
      w.print();
    }, 350);
  }

  const [sharing, setSharing] = useState(false);

  async function shareReport() {
    setSharing(true);
    try {
      await shareReportOverWifi({
        filename: `flow-report-${date}.html`,
        html: reportHtml(),
        title: `Flow report — ${formatDateDMY(date)}`,
      });
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="space-y-4">
      <SectionTitle
        right={<DateInput className="w-[150px]" value={date} onChange={setDate} />}
      >
        Report generation
      </SectionTitle>

      <Card>
        <p className="text-xs text-muted-foreground">
          One continuous page — no page breaks. Print straight to PDF, or download the
          self-contained file and print it later from any device.
        </p>
        <Btn className="mt-3 w-full" onClick={printReport}>
          <FileText className="h-4 w-4" /> Print / Save as PDF
        </Btn>
        <Btn variant="outline" className="mt-2 w-full" onClick={downloadHtml}>
          <Download className="h-4 w-4" /> Download report (HTML)
        </Btn>
        <Btn variant="outline" className="mt-2 w-full" onClick={shareReport} disabled={sharing}>
          <Share2 className="h-4 w-4" /> {sharing ? "Opening share…" : "Send over WiFi / to device"}
        </Btn>
        <p className="mt-2 text-[11px] text-muted-foreground">
          The HTML file works offline, opens on any phone or PC, and prints as a single page.
        </p>
      </Card>


      <Card>
        <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Sleep slots
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Tap the hours you sleep — they collapse into one minimal bar on the report instead of
          cluttering the slot list.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {ALL_SLOTS.map((slot) => {
            const on = (state.settings.sleepSlots ?? []).includes(slot);
            return (
              <button
                key={slot}
                onClick={() =>
                  setState((st) => {
                    const list = new Set(st.settings.sleepSlots ?? []);
                    if (list.has(slot)) list.delete(slot);
                    else list.add(slot);
                    st.settings.sleepSlots = ALL_SLOTS.filter((x) => list.has(x));
                  })
                }
                className={cn(
                  "press rounded-lg px-2 py-1 text-[11px] font-semibold",
                  on ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
                )}
              >
                {slotLabel12(slot).split(" – ")[0]}
              </button>
            );
          })}
        </div>
      </Card>

      {/* On-screen preview (single continuous page) */}
      {!hydrated ? null : (
        <Card className="p-0">
          <div className="border-b border-border px-4 py-2 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
            Preview
          </div>
          <div
            className="overflow-hidden rounded-2xl p-5"
            style={{ background: "var(--ink-paper)", color: "var(--ink-k)" }}
          >
            <ReportPreview
              dateLabel={formatDateDMY(date)}
              totals={totals}
              breaks={breaks}
              score={score}
              targetMins={targetMins}
              dayPct={dayPct}
              scoreGoal={scoreGoal}
              usedSlots={usedSlots}
              sleepLabel={sleepLabel}
              sleepMins={sleepMins}
              offSlots={offSlots}
              tasks={tasks}
              taskPct={taskPct}
              day={day}
            />
          </div>
        </Card>
      )}
    </div>
  );
}

/* ---------------- On-screen preview ---------------- */

function ReportPreview({
  dateLabel,
  totals,
  breaks,
  score,
  targetMins,
  dayPct,
  scoreGoal,
  usedSlots,
  sleepLabel,
  sleepMins,
  offSlots,
  tasks,
  taskPct,
  day,
}: {
  dateLabel: string;
  totals: ReturnType<typeof dayTotals>;
  breaks: ReturnType<typeof breakTotals>;
  score: number;
  targetMins: number;
  dayPct: number;
  scoreGoal: number;
  usedSlots: ReturnType<typeof computeSlots>;
  sleepLabel: string;
  sleepMins: number;
  offSlots: { slot: string; tag: string }[];
  tasks: ReturnType<typeof getDay>["tasks"];
  taskPct: number;
  day: ReturnType<typeof getDay>;
}) {
  return (
    <div className="space-y-3">
      {/* Masthead */}
      <div className="flex items-end justify-between gap-3 border-b-4 pb-3" style={{ borderColor: "var(--ink-k)" }}>
        <div className="min-w-0">
          <div className="text-[10px] font-black tracking-[0.35em] uppercase">Flow Tracker</div>
          <h2 className="font-display text-3xl leading-none font-black tracking-tighter">DAILY REPORT</h2>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[10px] font-black tracking-[0.2em] uppercase">Date</div>
          <div className="font-mono text-sm font-extrabold">{dateLabel}</div>
        </div>
      </div>

      <div className="flex h-2 w-full">
        <span className="flex-1" style={{ background: "var(--ink-c)" }} />
        <span className="flex-1" style={{ background: "var(--ink-m)" }} />
        <span className="flex-1" style={{ background: "var(--ink-y)" }} />
        <span className="flex-1" style={{ background: "var(--ink-k)" }} />
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-3">
        <PreviewStat label="Total studied" value={formatHM(totals.total)} ink="var(--ink-c)" />
        <PreviewStat label="Score gained" value={score.toFixed(0)} ink="var(--ink-m)" />
        <PreviewStat label="Target" value={formatHM(targetMins)} ink="var(--ink-k)" />
        <PreviewStat label="Achievement" value={`${Math.round(dayPct)}%`} ink="var(--ink-y)" />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <PreviewMini label="Flow" value={formatHM(totals.flow)} />
        <PreviewMini label="Shallow" value={formatHM(totals.shallow)} />
        <PreviewMini label="Breaks" value={formatHM(breaks.total)} />
      </div>

      {/* Score vs goal */}
      <PreviewMini
        label={`Score vs goal (${score.toFixed(0)}/${scoreGoal.toFixed(0)})`}
        value={`${Math.round(Math.min(100, (score / scoreGoal) * 100))}%`}
      />
      <div className="h-2 w-full" style={{ background: "color-mix(in oklab, var(--ink-k) 12%, transparent)" }}>
        <div
          className="h-2"
          style={{ width: `${Math.min(100, (score / scoreGoal) * 100)}%`, background: "var(--ink-m)" }}
        />
      </div>

      {/* Slots */}
      <PreviewHeading>Slot by slot</PreviewHeading>
      {usedSlots.length === 0 ? (
        <p className="text-xs">No slot activity recorded for this day.</p>
      ) : (
        <div className="space-y-1.5">
          {usedSlots.map((s) => {
            const names = slotTaskNames(s.slot, day);
            return (
              <div
                key={s.slot}
                className="grid grid-cols-[6.5rem_minmax(0,1fr)_7.5rem] items-center gap-2 border-b pb-1.5"
                style={{ borderColor: "color-mix(in oklab, var(--ink-k) 25%, transparent)" }}
              >
                <span className="whitespace-nowrap font-mono text-[11px] font-bold">{slotLabel12(s.slot)}</span>
                <span className="min-w-0">
                  <span className="block h-2 w-full" style={{ background: "color-mix(in oklab, var(--ink-k) 12%, transparent)" }}>
                    <span
                      className="block h-2"
                      style={{
                        width: `${Math.min(100, Math.max(0, Math.round(s.progress)))}%`,
                        background: s.progress >= 100 ? "var(--ink-c)" : "var(--ink-m)",
                      }}
                    />
                  </span>
                  {names.length ? (
                    <span className="mt-0.5 block truncate text-[10px] font-semibold">{names.join(" · ")}</span>
                  ) : null}
                </span>
                <span className="text-right font-mono text-[11px] font-bold">
                  {formatHM(s.loggedMins)}/{formatHM(s.targetMins)} · {Math.round(s.progress)}%
                </span>
              </div>
            );
          })}
        </div>
      )}

      {offSlots.map((o) => (
        <div
          key={o.slot}
          className="mt-1 grid grid-cols-[6.5rem_minmax(0,1fr)_7.5rem] items-center gap-2 border-b pb-1.5"
          style={{ borderColor: "color-mix(in oklab, var(--ink-k) 25%, transparent)" }}
        >
          <span className="whitespace-nowrap font-mono text-[11px] font-bold">
            {slotLabel12(o.slot)}
          </span>
          <span className="block h-2 w-full" style={{ background: "#fde68a" }} />
          <span className="truncate text-right font-mono text-[11px] font-bold uppercase">
            {o.tag}
          </span>
        </div>
      ))}

      {sleepLabel ? (
        <div
          className="mt-1 grid grid-cols-[6.5rem_minmax(0,1fr)_7.5rem] items-center gap-2 border-b pb-1.5"
          style={{ borderColor: "color-mix(in oklab, var(--ink-k) 25%, transparent)" }}
        >
          <span className="whitespace-nowrap font-mono text-[11px] font-bold">{sleepLabel}</span>
          <span
            className="block h-2 w-full"
            style={{ background: "color-mix(in oklab, var(--ink-k) 35%, transparent)" }}
          />
          <span className="text-right font-mono text-[11px] font-bold">
            SLEEP · {formatHM(sleepMins)}
          </span>
        </div>
      ) : null}

      {/* Tasks */}
      <PreviewHeading>Tasks · {Math.round(taskPct)}% complete</PreviewHeading>
      {tasks.length === 0 ? (
        <p className="text-xs">No tasks planned for this day.</p>
      ) : (
        <div className="space-y-1.5">
          {tasks.map((t) => {
            const p = Math.round(taskProgress(t) * 100);
            return (
              <div key={t.id}>
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                  <span
                    className="grid h-4 w-4 place-items-center text-[10px] font-black"
                    style={{
                      background: p >= 100 ? "var(--ink-c)" : "transparent",
                      border: "2px solid var(--ink-k)",
                    }}
                  >
                    {p >= 100 ? "✓" : ""}
                  </span>
                  <span className="min-w-0 truncate text-xs font-bold">{t.name}</span>
                  <span className="font-mono text-[11px] font-bold">{p}%</span>
                </div>
                {(t.subtasks ?? []).length ? (
                  <div className="mt-0.5 ml-6 text-[10px]">
                    {(t.subtasks ?? []).map((s) => `${s.completed ? "✓" : "○"} ${s.name}`).join("   ")}
                  </div>
                ) : null}
                {t.comment ? <div className="mt-0.5 ml-6 text-[10px] italic">"{t.comment}"</div> : null}
              </div>
            );
          })}
        </div>
      )}

      {/* Breaks */}
      {breaks.total > 0 ? (
        <>
          <PreviewHeading>Breaks</PreviewHeading>
          <div className="flex flex-wrap gap-2">
            {Object.entries(breaks.byTag).map(([tag, mins]) => (
              <span
                key={tag}
                className="px-2 py-1 text-[10px] font-black tracking-wide uppercase"
                style={{ background: "var(--ink-y)", color: "var(--ink-k)" }}
              >
                {tag} — {formatHM(mins)}
              </span>
            ))}
          </div>
        </>
      ) : null}

      <div
        className="flex items-center justify-between border-t-4 pt-2 text-[10px] font-black tracking-[0.2em] uppercase"
        style={{ borderColor: "var(--ink-k)" }}
      >
        <span>Generated by Flow Tracker</span>
        <span>
          {formatHM(totals.total)} · {score.toFixed(0)} pts
        </span>
      </div>
    </div>
  );
}

function PreviewHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="inline-block px-2 py-1 font-display text-[11px] font-black tracking-[0.25em] uppercase"
      style={{ background: "var(--ink-k)", color: "var(--ink-paper)" }}
    >
      {children}
    </h3>
  );
}

function PreviewStat({ label, value, ink }: { label: string; value: string; ink: string }) {
  return (
    <div className="border-2 p-3" style={{ borderColor: "var(--ink-k)" }}>
      <div className="text-[9px] font-black tracking-[0.2em] uppercase">{label}</div>
      <div className="font-display text-2xl font-black tracking-tighter" style={{ color: ink }}>
        {value}
      </div>
    </div>
  );
}

function PreviewMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-1.5" style={{ background: "color-mix(in oklab, var(--ink-k) 8%, transparent)" }}>
      <div className="text-[9px] font-black tracking-[0.18em] uppercase">{label}</div>
      <div className="font-mono text-xs font-extrabold">{value}</div>
    </div>
  );
}

/* ---------------- Standalone HTML export (single page, no breaks) ---------------- */

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildStandaloneHtml(args: {
  dateLabel: string;
  totals: ReturnType<typeof dayTotals>;
  breaks: ReturnType<typeof breakTotals>;
  score: number;
  targetMins: number;
  dayPct: number;
  scoreGoal: number;
  usedSlots: ReturnType<typeof computeSlots>;
  sleepLabel: string;
  sleepMins: number;
  offSlots: { slot: string; tag: string }[];
  tasks: ReturnType<typeof getDay>["tasks"];
  taskPct: number;
  day: ReturnType<typeof getDay>;
}): string {
  const { dateLabel, totals, breaks, score, targetMins, dayPct, scoreGoal, usedSlots, sleepLabel, sleepMins, offSlots, tasks, taskPct, day } = args;
  const scorePct = Math.min(100, (score / scoreGoal) * 100);

  const slotRows = usedSlots.length
    ? usedSlots
        .map((s) => {
          const names = slotTaskNames(s.slot, day);
          const namesHtml = names.length
            ? `<div style="margin-top:2px;font-size:10px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(names.join(" · "))}</div>`
            : "";
          return `<div class="slot-row">
            <span class="slot-time">${esc(slotLabel12(s.slot))}</span>
            <span style="min-width:0"><span class="slot-track"><span class="slot-fill" style="width:${Math.min(100, Math.max(0, Math.round(s.progress)))}%;background:${s.progress >= 100 ? "#4f46e5" : "#db2777"}"></span></span>${namesHtml}</span>
            <span class="slot-total">${formatHM(s.loggedMins)}/${formatHM(s.targetMins)} · ${Math.round(s.progress)}%</span>
          </div>`;
        })
        .join("")
    : "<p style=\"font-size:12px\">No slot activity recorded for this day.</p>";

  const sleepRow = sleepLabel
    ? `<div class="slot-row sleep-row">
        <span class="slot-time">${esc(sleepLabel)}</span>
        <span class="slot-track" style="background:#c7cbd8"></span>
        <span class="slot-total">SLEEP · ${formatHM(sleepMins)}</span>
      </div>`
    : "";

  const offRows = offSlots
    .map(
      (o) => `<div class="slot-row">
        <span class="slot-time">${esc(slotLabel12(o.slot))}</span>
        <span class="slot-track" style="background:#fde68a"></span>
        <span class="slot-total" style="text-transform:uppercase">${esc(o.tag)}</span>
      </div>`,
    )
    .join("");

  const taskRows = tasks.length
    ? tasks
        .map((t) => {
          const p = Math.round(taskProgress(t) * 100);
          const subs = (t.subtasks ?? [])
            .map((s) => `${s.completed ? "✓" : "○"} ${esc(s.name)}`)
            .join("&nbsp;&nbsp;&nbsp;");
          const comment = t.comment ? `<div style="margin-top:2px;margin-left:24px;font-size:10px;font-style:italic">"${esc(t.comment)}"</div>` : "";
          const subsHtml = subs ? `<div style="margin-top:2px;margin-left:24px;font-size:10px">${subs}</div>` : "";
          return `<div>
            <div style="display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center">
              <span style="display:inline-grid;place-items:center;width:16px;height:16px;font-size:10px;font-weight:900;background:${p >= 100 ? "#4f46e5" : "transparent"};border:2px solid #c7cbd8;border-radius:5px">${p >= 100 ? "✓" : ""}</span>
              <span style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.name)}</span>
              <span style="font-family:monospace;font-size:11px;font-weight:700">${p}%</span>
            </div>
            ${subsHtml}${comment}
          </div>`;
        })
        .join("")
    : "<p style=\"font-size:12px\">No tasks planned for this day.</p>";

  const breakTags = breaks.total > 0
    ? Object.entries(breaks.byTag)
        .map(
          ([tag, mins]) =>
            `<span style="padding:4px 8px;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.05em;background:#f59e0b;color:#14161c">${esc(tag)} — ${formatHM(mins)}</span>`,
        )
        .join("")
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Flow Tracker — Daily Report ${esc(dateLabel)}</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { background: #ffffff; color: #14161c; font-family: "DM Sans", -apple-system, system-ui, "Segoe UI", sans-serif; }
  body { padding: 22px; max-width: 840px; margin: 0 auto; }
  .sheet { page-break-inside: auto; }
  h1, h2, h3 { font-family: "Space Grotesk", system-ui, sans-serif; letter-spacing: -0.02em; }
  .mono { font-family: "JetBrains Mono", ui-monospace, monospace; }
  .masthead { display: flex; align-items: center; justify-content: space-between; gap: 14px;
    padding: 18px 20px; border-radius: 18px; color: #fff;
    background: linear-gradient(120deg, #4f46e5 0%, #7c3aed 48%, #db2777 100%); }
  .brand { font-size: 9px; font-weight: 800; letter-spacing: 0.34em; text-transform: uppercase; opacity: .85; }
  .title { font-size: 28px; line-height: 1.05; font-weight: 800; letter-spacing: -0.035em; }
  .stripe { display: none; }
  .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
  .stat { border: 1px solid #e6e8ef; border-radius: 14px; padding: 12px 14px; background: #fbfbfe; }
  .stat-label { font-size: 9px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: #6b7280; }
  .stat-value { font-family: "Space Grotesk", system-ui, sans-serif; font-size: 24px; font-weight: 800; letter-spacing: -0.03em; margin-top: 2px; }
  .mini-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 10px; text-align: center; }
  .mini { padding: 8px; border-radius: 12px; background: #f4f5fa; }
  .mini-label { font-size: 9px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #6b7280; }
  .mini-value { font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 800; }
  .score-bar-wrap { margin-top: 10px; padding: 10px 12px; border-radius: 14px; background: #f4f5fa; }
  .score-bar { height: 8px; border-radius: 99px; background: #e2e4ee; margin-top: 6px; overflow: hidden; }
  .score-fill { height: 8px; border-radius: 99px; background: linear-gradient(90deg, #4f46e5, #db2777); }
  .heading { display: block; margin-top: 20px; margin-bottom: 8px; font-size: 10px; font-weight: 800;
    letter-spacing: 0.22em; text-transform: uppercase; color: #4f46e5; }
  .slot-row { display: grid; grid-template-columns: 108px minmax(0, 1fr) 130px; gap: 10px; align-items: center;
    min-height: 30px; padding: 7px 0; border-bottom: 1px solid #e6e8ef; break-inside: avoid; }
  .slot-time, .slot-total { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11px; font-weight: 700; white-space: nowrap; }
  .slot-total { text-align: right; }
  .slot-track { display: block; width: 100%; height: 8px; overflow: hidden; border-radius: 99px; background: #e2e4ee; }
  .slot-fill { display: block; height: 100%; border-radius: inherit; }
  .row { border-radius: 12px; }
  .footer { display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #e6e8ef;
    padding-top: 10px; margin-top: 22px; font-size: 9px; font-weight: 800; letter-spacing: 0.18em;
    text-transform: uppercase; color: #6b7280; }
  .breaks { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
</style>
</head>
<body>
<div class="sheet">
  <div class="masthead">
    <div>
      <div class="brand">Flow Tracker</div>
      <h2 class="title">DAILY REPORT</h2>
    </div>
    <div style="text-align:right">
      <div style="font-size:10px;font-weight:900;letter-spacing:0.2em;text-transform:uppercase">Date</div>
      <div class="mono" style="font-size:14px;font-weight:800">${esc(dateLabel)}</div>
    </div>
  </div>
  <div class="stripe">
    <span style="background:#4f46e5"></span>
    <span style="background:#db2777"></span>
    <span style="background:#f59e0b"></span>
    <span style="background:#1a1a1a"></span>
  </div>

  <div class="stats">
    <div class="stat"><div class="stat-label">Total studied</div><div class="stat-value" style="color:#4f46e5">${formatHM(totals.total)}</div></div>
    <div class="stat"><div class="stat-label">Score gained</div><div class="stat-value" style="color:#db2777">${score.toFixed(0)}</div></div>
    <div class="stat"><div class="stat-label">Target</div><div class="stat-value" style="color:#14161c">${formatHM(targetMins)}</div></div>
    <div class="stat"><div class="stat-label">Achievement</div><div class="stat-value" style="color:#f59e0b">${Math.round(dayPct)}%</div></div>
  </div>

  <div class="mini-stats">
    <div class="mini"><div class="mini-label">Flow</div><div class="mini-value">${formatHM(totals.flow)}</div></div>
    <div class="mini"><div class="mini-label">Shallow</div><div class="mini-value">${formatHM(totals.shallow)}</div></div>
    <div class="mini"><div class="mini-label">Breaks</div><div class="mini-value">${formatHM(breaks.total)}</div></div>
  </div>

  <div class="score-bar-wrap">
    <div class="mini-label">Score vs goal (${score.toFixed(0)}/${scoreGoal.toFixed(0)} pts)</div>
    <div class="score-bar"><div class="score-fill" style="width:${Math.round(scorePct)}%"></div></div>
  </div>

  <h3 class="heading">Slot by slot</h3>
  ${slotRows}${offRows}${sleepRow}

  <h3 class="heading">Tasks · ${Math.round(taskPct)}% complete</h3>
  ${taskRows}

  ${breaks.total > 0 ? `<h3 class="heading">Breaks</h3><div class="breaks">${breakTags}</div>` : ""}

  <div class="footer">
    <span>Generated by Flow Tracker</span>
    <span>${formatHM(totals.total)} · ${score.toFixed(0)} pts</span>
  </div>
</div>
</body>
</html>`;
}
