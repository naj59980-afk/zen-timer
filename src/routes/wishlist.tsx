import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Gift, ListTodo, Plus, Trash2 } from "lucide-react";
import { lifetimeScores, setState, useAppState, type WishItem } from "@/lib/store";
import { Btn, Card, NumInput, SectionTitle, inputClass, useHydrated } from "@/components/kit";
import { haptic } from "@/lib/alarm";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/wishlist")({
  head: () => ({
    meta: [
      { title: "Todo & Wishlist — Flow Tracker" },
      {
        name: "description",
        content:
          "Keep long-horizon todos and reward wishes in one place, with point costs so you know what your focus buys.",
      },
      { property: "og:title", content: "Todo & Wishlist — Flow Tracker" },
      {
        property: "og:description",
        content: "Long-term todos and point-priced rewards worth working for.",
      },
    ],
  }),
  component: WishlistPage,
});

function WishTotals() {
  const state = useAppState();
  const hydrated = useHydrated();
  const wishes = (state.wishlist ?? []).filter((w) => w.kind === "wish");
  const open = wishes.filter((w) => !w.done);
  const total = wishes.reduce((a, w) => a + (w.cost ?? 0), 0);
  const remaining = open.reduce((a, w) => a + (w.cost ?? 0), 0);

  return (
    <Card>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-surface-2 px-2 py-2">
          <div className="font-mono text-lg font-extrabold tabular-nums">{hydrated ? wishes.length : "—"}</div>
          <div className="text-[10px] text-muted-foreground">total wishes</div>
        </div>
        <div className="rounded-xl bg-surface-2 px-2 py-2">
          <div className="font-mono text-lg font-extrabold tabular-nums">
            {hydrated ? total.toFixed(0) : "—"}
          </div>
          <div className="text-[10px] text-muted-foreground">points for all</div>
        </div>
        <div className="rounded-xl bg-surface-2 px-2 py-2">
          <div className="font-mono text-lg font-extrabold tabular-nums text-warning">
            {hydrated ? remaining.toFixed(0) : "—"}
          </div>
          <div className="text-[10px] text-muted-foreground">still unclaimed ({open.length})</div>
        </div>
      </div>
    </Card>
  );
}

function WishlistPage() {
  const state = useAppState();
  const hydrated = useHydrated();
  const [tab, setTab] = useState<"todo" | "wish">("todo");
  const [text, setText] = useState("");
  const [cost, setCost] = useState<number | null>(500);
  const balance = lifetimeScores(state).net;

  const items = (state.wishlist ?? []).filter((w) => w.kind === tab);
  const sorted = [...items].sort((a, b) => Number(a.done) - Number(b.done) || b.createdAt - a.createdAt);

  function add() {
    const t = text.trim();
    if (!t) return;
    haptic();
    setState((s) => {
      s.wishlist = [
        ...(s.wishlist ?? []),
        {
          id: Date.now(),
          text: t,
          kind: tab,
          cost: tab === "wish" ? (cost ?? 0) : undefined,
          done: false,
          createdAt: Date.now(),
        } satisfies WishItem,
      ];
    });
    setText("");
  }

  function toggle(id: number) {
    haptic();
    setState((s) => {
      s.wishlist = (s.wishlist ?? []).map((w) => (w.id === id ? { ...w, done: !w.done } : w));
    });
  }

  function remove(id: number) {
    haptic();
    setState((s) => {
      s.wishlist = (s.wishlist ?? []).filter((w) => w.id !== id);
    });
  }

  return (
    <div className="space-y-3">
      <SectionTitle>Todo & wishlist</SectionTitle>

      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-surface-2 p-1">
        {(
          [
            ["todo", "Todo", ListTodo],
            ["wish", "Wishlist", Gift],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => {
              haptic();
              setTab(id);
            }}
            className={cn(
              "press flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold",
              tab === id
                ? "gradient-fill text-primary-foreground shadow-[var(--shadow-soft)]"
                : "text-muted-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "wish" ? <WishTotals /> : null}

      <Card glow>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={tab === "todo" ? "Something you must get done" : "A reward worth earning"}
          className={inputClass}
        />
        {tab === "wish" ? (
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <NumInput value={cost} onChange={setCost} min={0} suffix="pts" />
            <Btn onClick={add} disabled={!text.trim()}>
              <Plus className="h-4 w-4" /> Add
            </Btn>
          </div>
        ) : (
          <Btn className="mt-2 w-full" onClick={add} disabled={!text.trim()}>
            <Plus className="h-4 w-4" /> Add
          </Btn>
        )}
        {tab === "wish" ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Balance available: {hydrated ? balance.toFixed(0) : "—"} pts
          </p>
        ) : null}
      </Card>

      <Card>
        {hydrated && sorted.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {tab === "todo" ? "No todos yet." : "No wishes yet — add something to work towards."}
          </p>
        ) : null}
        <div className="space-y-1.5">
          {sorted.map((w) => {
            const affordable = (w.cost ?? 0) <= balance;
            return (
              <div
                key={w.id}
                className={cn(
                  "grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-xl bg-surface-2 px-3 py-2",
                  w.done && "opacity-55",
                )}
              >
                <button
                  onClick={() => toggle(w.id)}
                  aria-label={w.done ? "Mark as pending" : "Mark as done"}
                  className={cn(
                    "press grid h-7 w-7 place-items-center rounded-lg border",
                    w.done ? "gradient-fill border-transparent text-primary-foreground" : "border-border",
                  )}
                >
                  {w.done ? <Check className="h-4 w-4" /> : null}
                </button>
                <div className={cn("min-w-0 text-sm font-semibold", w.done && "line-through")}>
                  {w.text}
                </div>
                {w.kind === "wish" ? (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-mono text-[11px] font-bold",
                      affordable ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive",
                    )}
                  >
                    {w.cost ?? 0}
                  </span>
                ) : (
                  <span />
                )}
                <button
                  onClick={() => remove(w.id)}
                  aria-label="Delete"
                  className="press grid h-7 w-7 place-items-center rounded-lg bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
