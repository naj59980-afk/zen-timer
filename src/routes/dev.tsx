import { createFileRoute } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";
import {
  DEFAULT_COEFF,
  TAGS,
  computeDayScore,
  computeSlotScore,
  computeSlots,
  dayTotals,
  slotFactorOf,
  slotLabel12,
  slotNFactor,
  taskRatioOf,

  formatHM,
  getDay,
  setState,
  todayKey,
  useAppState,
  type Coefficients,
} from "@/lib/store";
import { Btn, Card, SectionTitle, useHydrated } from "@/components/kit";
import { haptic } from "@/lib/alarm";
import { useEffect, useState } from "react";
import { GUARD_MIN_PASSWORD, guardStatus, hashPassword, requestOverlayPermission } from "@/lib/exit-guard";
import { isNativeApp } from "@/lib/native";

export const Route = createFileRoute("/dev")({
  head: () => ({
    meta: [
      { title: "Engine Settings — Flow Tracker" },
      {
        name: "description",
        content:
          "Tune scoring coefficients, slot distribution rules, tags and alert behaviour without code.",
      },
      { property: "og:title", content: "Engine Settings — Flow Tracker" },
      {
        property: "og:description",
        content: "No-code control panel for scoring weights, slot maths and alert behaviour.",
      },
    ],
  }),
  component: DevPage,
});

const FIELDS: { key: keyof Coefficients; label: string; step: number; help: string }[] = [
  {
    key: "flowRate",
    label: "Flow State points / hour",
    step: 10,
    help: "Base rate for flow-state hours (formula: T×rate×(1+n)×S).",
  },
  {
    key: "shallowRate",
    label: "Shallow Work points / hour",
    step: 10,
    help: "Base rate for shallow hours (formula: T×rate×(1+n/2)).",
  },
  {
    key: "lateFactor",
    label: "S factor when overrunning",
    step: 0.05,
    help: "Multiplier applied when a slotted task isn't finished inside its window.",
  },

  {
    key: "downtimeGraceMins",
    label: "Downtime grace (mins)",
    step: 5,
    help: "Idle minutes allowed before the downtime warning fires.",
  },
  {
    key: "minSlotTargetMins",
    label: "Minimum slot target (mins)",
    step: 5,
    help: "Floor applied when auto-distributing remaining target.",
  },
];

function DevPage() {
  const state = useAppState();
  const hydrated = useHydrated();
  const coeff = state.settings.coeff;
  const key = todayKey();
  const day = getDay(state, key);
  const totals = dayTotals(day);
  const now = new Date();
  const slots = computeSlots(day, key, now);
  const activeSlots = slots.filter((s) => !s.disabled);
  const future = activeSlots.filter((s) => s.hour >= now.getHours());

  return (
    <div className="space-y-4">
      <SectionTitle>Engine settings</SectionTitle>

      <Card>
        <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Scoring & distribution variables
        </div>
        <div className="mt-2 space-y-3">
          {FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="text-xs font-semibold">{f.label}</span>
              <input
                type="number"
                step={f.step}
                value={coeff[f.key]}
                onChange={(e) =>
                  setState((s) => {
                    s.settings.coeff[f.key] = Number(e.target.value) || 0;
                  })
                }
                className="mt-1 w-full rounded-xl border border-input bg-surface-2 px-3 py-2 text-sm"
              />
              <span className="mt-0.5 block text-[11px] text-muted-foreground">{f.help}</span>
            </label>
          ))}
        </div>
        <Btn
          variant="outline"
          className="mt-3 w-full"
          onClick={() => {
            haptic();
            setState((s) => {
              s.settings.coeff = { ...DEFAULT_COEFF };
            });
          }}
        >
          <RotateCcw className="h-4 w-4" /> Reset to defaults
        </Btn>
      </Card>

      <GuardCard />

      <Card>
        <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Alerts
        </div>
        <label className="mt-2 flex items-center justify-between gap-3 text-sm font-semibold">
          Phase-change sound & vibration
          <button
            onClick={() =>
              setState((s) => {
                s.settings.soundOn = !s.settings.soundOn;
              })
            }
            className={`press h-6 w-11 rounded-full transition-colors ${
              state.settings.soundOn ? "bg-success" : "bg-secondary"
            }`}
          >
            <span
              className={`block h-5 w-5 rounded-full bg-background transition-transform ${
                state.settings.soundOn ? "translate-x-[22px]" : "translate-x-0.5"
              }`}
            />
          </button>
        </label>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Slot popups and panic alerts are permanently disabled — only pomodoro phase changes
          alert you.
        </p>
      </Card>

      <Card>
        <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Tags
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {TAGS.map((t) => (
            <span key={t} className="rounded-full bg-accent px-3 py-1 text-xs font-semibold">
              {t}
            </span>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Fixed set — everything logs as flow state or shallow work.
        </p>
      </Card>

      <Card>
        <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Live calculation trace (today)
        </div>
        <dl className="mt-2 space-y-1 font-mono text-[11px]">
          <Row k="daily target" v={formatHM((day.targetHours || 0) * 60)} />
          <Row k="logged total" v={hydrated ? formatHM(totals.total) : "—"} />
          <Row k="flow / shallow" v={`${formatHM(totals.flow)} / ${formatHM(totals.shallow)}`} />
          <Row k="active slots" v={`${activeSlots.length} of 24`} />
          <Row k="remaining slots" v={String(future.length)} />
          <Row
            k="auto target per slot"
            v={formatHM(future.length ? future.reduce((a, s) => a + s.targetMins, 0) / future.length : 0)}
          />
          <Row k="task ratio n" v={taskRatioOf(day).toFixed(3)} />
          <Row k="slot factor S" v={slotFactorOf(day, coeff).toFixed(2)} />
          <Row k="day points" v={Math.round(computeDayScore(day, coeff)).toLocaleString()} />
          <Row k="score goal" v={state.settings.scoreTarget.toFixed(0)} />

        </dl>
      </Card>

      <Card>
        <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Per-slot n-factor & score (today)
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Exception rules: 6–9AM slots use n=2, first 5 slots from 6AM use n=1, others use the day task ratio.
        </p>
        <div className="mt-2 max-h-64 overflow-y-auto space-y-1 font-mono text-[11px]">
          {activeSlots.map((s) => (
            <Row
              key={s.slot}
              k={slotLabel12(s.slot)}
              v={`n=${slotNFactor(s.slot, day)} · ${Math.round(
                computeSlotScore(s.slot, s.logs, day, coeff),
              )} pts`}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`press h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-success" : "bg-secondary"}`}
    >
      <span
        className={`block h-5 w-5 rounded-full bg-background transition-transform ${
          on ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function GuardCard() {
  const state = useAppState();
  const st = state.settings;
  const [overlay, setOverlay] = useState(false);
  const [stepDraft, setStepDraft] = useState("");

  useEffect(() => {
    if (!isNativeApp()) return;
    void guardStatus().then((s) => setOverlay(s.overlay));
  }, []);

  return (
    <Card>
      <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        Exit guard & workflow
      </div>

      <label className="mt-2 flex items-center justify-between gap-3 text-sm font-semibold">
        Block leaving the app without leisure timer
        <Toggle
          on={st.exitGuardOn !== false}
          onClick={() => {
            if (st.exitGuardOn !== false) return; // switching off needs the password below
            setState((s) => { s.settings.exitGuardOn = true; });
          }}
        />
      </label>
      <p className="mt-1 text-[11px] text-muted-foreground">
        When on, an overlay appears over other apps whenever you try to exit without a running
        leisure timer. Leisure itself only unlocks once the quota below is met. The guard can only
        be switched off through the timed, password-protected override below.
      </p>

      <OverrideBlock />


      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs font-semibold">Min flow minutes</span>
          <input
            type="number"
            step={15}
            value={st.guardMinFlowMins ?? 120}
            onChange={(e) =>
              setState((s) => { s.settings.guardMinFlowMins = Number(e.target.value) || 0; })
            }
            className="mt-1 w-full rounded-xl border border-input bg-surface-2 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold">Min daily points</span>
          <input
            type="number"
            step={50}
            value={st.guardMinPoints ?? 500}
            onChange={(e) =>
              setState((s) => { s.settings.guardMinPoints = Number(e.target.value) || 0; })
            }
            className="mt-1 w-full rounded-xl border border-input bg-surface-2 px-3 py-2 text-sm"
          />
        </label>
      </div>

      {isNativeApp() ? (
        <Btn
          variant={overlay ? "outline" : "primary"}
          className="mt-3 w-full"
          onClick={async () => {
            await requestOverlayPermission();
            setOverlay((await guardStatus()).overlay);
          }}
        >
          {overlay ? "Overlay permission granted" : "Grant \"display over other apps\""}
        </Btn>
      ) : (
        <p className="mt-2 text-[11px] text-muted-foreground">
          The overlay only works in the installed Android app.
        </p>
      )}

      <label className="mt-4 flex items-center justify-between gap-3 text-sm font-semibold">
        Ask for a task when the focus timer starts
        <Toggle
          on={st.taskPickerOn !== false}
          onClick={() => setState((s) => { s.settings.taskPickerOn = !(s.settings.taskPickerOn !== false); })}
        />
      </label>

      <div className="mt-4">
        <div className="text-xs font-semibold">Common subtask steps (batch add)</div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(st.commonSteps ?? []).map((cs) => (
            <span key={cs} className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
              {cs}
              <button
                onClick={() =>
                  setState((s) => {
                    s.settings.commonSteps = (s.settings.commonSteps ?? []).filter((x) => x !== cs);
                  })
                }
                className="text-muted-foreground"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <input
            value={stepDraft}
            onChange={(e) => setStepDraft(e.target.value)}
            placeholder="Add a step name"
            className="rounded-xl border border-input bg-surface-2 px-3 py-2 text-sm"
          />
          <Btn
            onClick={() => {
              const v = stepDraft.trim();
              if (!v) return;
              setState((s) => {
                const list = s.settings.commonSteps ?? [];
                if (!list.includes(v)) s.settings.commonSteps = [...list, v];
              });
              setStepDraft("");
            }}
          >
            Add
          </Btn>
        </div>
      </div>
    </Card>
  );
}

const QUOTE =
  "Want to lose in life? Then quit now. Every unguarded minute is a piece of the future you were supposed to own.";

const DURATIONS = [5, 15, 30, 60, 120];

function OverrideBlock() {
  const state = useAppState();
  const st = state.settings;
  const [pw, setPw] = useState("");
  const [mins, setMins] = useState(15);
  const [err, setErr] = useState("");
  const [left, setLeft] = useState(0);

  const until = st.guardDisabledUntil ?? null;

  useEffect(() => {
    const tick = () => setLeft(until ? Math.max(0, until - Date.now()) : 0);
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [until]);

  const active = left > 0;

  async function setPassword() {
    if (pw.length <= GUARD_MIN_PASSWORD) {
      setErr(`The password must be longer than ${GUARD_MIN_PASSWORD} characters.`);
      return;
    }
    const h = await hashPassword(pw);
    setState((s) => { s.settings.guardPasswordHash = h; });
    setPw("");
    setErr("");
  }

  async function disableFor() {
    const h = await hashPassword(pw);
    if (h !== st.guardPasswordHash) {
      setErr("Wrong password.");
      haptic([30, 60, 30]);
      return;
    }
    haptic();
    setState((s) => {
      s.settings.guardDisabledUntil = Date.now() + mins * 60000;
    });
    setPw("");
    setErr("");
  }

  function rearm() {
    haptic();
    setState((s) => {
      s.settings.guardDisabledUntil = null;
      s.settings.exitGuardOn = true;
    });
  }

  return (
    <div className="mt-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-3">
      <div className="text-[11px] font-semibold tracking-wide text-destructive uppercase">
        Emergency override
      </div>
      <p className="mt-1 text-[11px] italic text-muted-foreground">&ldquo;{QUOTE}&rdquo;</p>

      {active ? (
        <>
          <div className="mt-2 font-mono text-lg font-extrabold tabular-nums text-destructive">
            {Math.floor(left / 60000)}m {Math.floor((left % 60000) / 1000)}s left
          </div>
          <p className="text-[11px] text-muted-foreground">
            The guard re-arms itself automatically when this runs out.
          </p>
          <Btn variant="primary" className="mt-2 w-full" onClick={rearm}>
            Re-arm the guard now
          </Btn>
        </>
      ) : !st.guardPasswordHash ? (
        <>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Set a one-time override password longer than {GUARD_MIN_PASSWORD} characters. Make it
            long enough that you cannot type it on impulse.
          </p>
          <input
            type="password"
            value={pw}
            onChange={(e) => { setPw(e.target.value); setErr(""); }}
            placeholder="Override password"
            className="mt-2 w-full rounded-xl border border-input bg-surface-2 px-3 py-2 text-sm"
          />
          <div className="mt-1 text-[11px] text-muted-foreground">
            {pw.length}/{GUARD_MIN_PASSWORD + 1} characters
          </div>
          <Btn variant="outline" className="mt-2 w-full" onClick={() => void setPassword()}>
            Save password
          </Btn>
        </>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DURATIONS.map((m) => (
              <button
                key={m}
                onClick={() => setMins(m)}
                className={`press rounded-full px-3 py-1 text-xs font-semibold ${
                  mins === m ? "gradient-fill text-primary-foreground" : "bg-secondary"
                }`}
              >
                {m}m
              </button>
            ))}
            <input
              type="number"
              min={1}
              value={mins}
              onChange={(e) => setMins(Math.max(1, Number(e.target.value) || 1))}
              className="w-20 rounded-full border border-input bg-surface-2 px-3 py-1 text-xs"
            />
          </div>
          <input
            type="password"
            value={pw}
            onChange={(e) => { setPw(e.target.value); setErr(""); }}
            placeholder="Type the override password"
            className="mt-2 w-full rounded-xl border border-input bg-surface-2 px-3 py-2 text-sm"
          />
          <Btn variant="danger" className="mt-2 w-full" onClick={() => void disableFor()}>
            Disable guard for {mins} min
          </Btn>
        </>
      )}
      {err ? <p className="mt-1 text-[11px] font-semibold text-destructive">{err}</p> : null}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/60 pb-1">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-semibold">{v}</dd>
    </div>
  );
}
