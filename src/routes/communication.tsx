import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Delete,
  MessageSquare,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  User,
} from "lucide-react";
import { setState, useAppState, type Contact } from "@/lib/store";
import { Btn, Card, SectionTitle, inputClass, useHydrated } from "@/components/kit";
import { haptic } from "@/lib/alarm";
import {
  isNativeApp,
  permStatus,
  placeCall,
  readCallLog,
  readMessages,
  requestTelephonyPerms,
  sendSms,
  type CallLogItem,
  type PermStatus,
  type SmsItem,
} from "@/lib/native";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/communication")({
  head: () => ({
    meta: [
      { title: "Calls & Messages — Flow Tracker" },
      {
        name: "description",
        content:
          "A built-in dialer, call log and SMS inbox so you can call and text without ever unpinning the focus app.",
      },
      { property: "og:title", content: "Calls & Messages — Flow Tracker" },
      {
        property: "og:description",
        content: "Dialer, call history and messages inside the kiosk app.",
      },
    ],
  }),
  component: CommunicationPage,
});

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

function timeAgo(ts: number) {
  const d = new Date(ts);
  return `${d.toLocaleDateString([], { day: "2-digit", month: "2-digit" })} · ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function CommunicationPage() {
  const state = useAppState();
  const hydrated = useHydrated();
  const [tab, setTab] = useState<"calls" | "messages">("calls");
  const [number, setNumber] = useState("");
  const [text, setText] = useState("");
  const [newName, setNewName] = useState("");
  const [perms, setPerms] = useState<PermStatus | null>(null);
  const [logs, setLogs] = useState<CallLogItem[]>([]);
  const [sms, setSms] = useState<SmsItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contacts = state.contacts ?? [];
  const native = hydrated && isNativeApp();

  const refresh = useCallback(async () => {
    if (!isNativeApp()) return;
    setBusy(true);
    const p = await permStatus();
    setPerms(p);
    if (p.calllog) setLogs(await readCallLog(120));
    if (p.sms) setSms(await readMessages("inbox", 120));
    setBusy(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function grant() {
    haptic();
    const p = await requestTelephonyPerms();
    setPerms(p);
    await refresh();
  }

  function addContact() {
    const n = number.trim();
    const name = newName.trim() || n;
    if (!n) return;
    haptic();
    setState((s) => {
      s.contacts = [...(s.contacts ?? []), { id: Date.now(), name, number: n }];
    });
    setNewName("");
  }

  function removeContact(id: number) {
    haptic();
    setState((s) => {
      s.contacts = (s.contacts ?? []).filter((c) => c.id !== id);
    });
  }

  async function call(n: string) {
    haptic(15);
    setError(null);
    try {
      await placeCall(n);
      setTimeout(() => void refresh(), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not place the call");
    }
  }

  async function message(n: string) {
    const body = text.trim();
    if (!body) return;
    haptic(15);
    setError(null);
    try {
      await sendSms(n, body);
      setText("");
      setTimeout(() => void refresh(), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the message");
    }
  }

  const missingPerms =
    native && perms && !(perms.phone && perms.calllog && perms.sms && perms.contacts);

  return (
    <div className="space-y-3">
      <SectionTitle>Communication</SectionTitle>

      {native && missingPerms ? (
        <Card glow>
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/12">
              <ShieldCheck className="h-4 w-4 text-primary" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-bold">Grant phone access</div>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                Calls, call history and SMS run inside this app so the phone can stay pinned and
                locked. Android will ask you once.
              </p>
            </div>
          </div>
          <Btn className="mt-3 w-full" onClick={grant}>
            Allow calls & messages
          </Btn>
        </Card>
      ) : null}

      {hydrated && !native ? (
        <Card>
          <p className="text-[11px] leading-snug text-muted-foreground">
            The in-app dialer, call log and inbox only work in the installed Android app. In the
            browser preview, calling and texting hand off to the phone's own apps.
          </p>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-surface-2 p-1">
        {(
          [
            ["calls", "Calls", Phone],
            ["messages", "Messages", MessageSquare],
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

      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
          {error}
        </div>
      ) : null}

      <Card glow>
        <input
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          inputMode="tel"
          placeholder="Enter a number"
          className={cn(inputClass, "text-center font-mono text-2xl font-extrabold tracking-widest")}
        />

        {tab === "calls" ? (
          <>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {KEYS.map((k) => (
                <button
                  key={k}
                  onClick={() => {
                    haptic(8);
                    setNumber((v) => v + k);
                  }}
                  className="press grid h-14 place-items-center rounded-2xl bg-surface-2 font-display text-xl font-extrabold"
                >
                  {k}
                </button>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-2">
              <button
                onClick={() => setNumber((v) => v.slice(0, -1))}
                className="press grid h-12 w-14 place-items-center rounded-2xl bg-secondary"
                aria-label="Backspace"
              >
                <Delete className="h-5 w-5" />
              </button>
              <Btn
                variant="success"
                size="lg"
                className="h-12"
                disabled={!number.trim()}
                onClick={() => void call(number)}
              >
                <Phone className="h-4 w-4" /> Call
              </Btn>
            </div>
          </>
        ) : (
          <>
            <textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your message…"
              className={cn(inputClass, "mt-3 resize-none text-foreground")}
            />
            <Btn
              className="mt-2 w-full"
              disabled={!number.trim() || !text.trim()}
              onClick={() => void message(number)}
            >
              <Send className="h-4 w-4" /> Send message
            </Btn>
          </>
        )}
      </Card>

      {native ? (
        <Card>
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
              {tab === "calls" ? "Call history" : "Inbox"}
            </div>
            <button
              onClick={() => void refresh()}
              className="press grid h-7 w-7 place-items-center rounded-lg bg-secondary"
              aria-label="Refresh"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} />
            </button>
          </div>

          {tab === "calls" ? (
            <div className="mt-2 space-y-1.5">
              {logs.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {perms?.calllog ? "No calls recorded yet." : "Call log permission not granted."}
                </p>
              ) : null}
              {logs.map((l) => {
                const Icon = l.type === 3 ? PhoneMissed : l.type === 2 ? PhoneOutgoing : PhoneIncoming;
                const tint =
                  l.type === 3 ? "text-destructive" : l.type === 2 ? "text-primary" : "text-success";
                return (
                  <div
                    key={l.id}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl bg-surface-2 px-3 py-2"
                  >
                    <Icon className={cn("h-4 w-4", tint)} />
                    <button onClick={() => setNumber(l.number)} className="min-w-0 text-left">
                      <div className="truncate text-sm font-semibold">{l.name || l.number}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {timeAgo(l.date)} · {Math.round(l.duration / 60)}m
                      </div>
                    </button>
                    <button
                      onClick={() => void call(l.number)}
                      className="press grid h-8 w-8 place-items-center rounded-lg bg-success/15"
                      aria-label={`Call ${l.name || l.number}`}
                    >
                      <Phone className="h-4 w-4 text-success" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-2 space-y-1.5">
              {sms.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {perms?.sms ? "Inbox is empty." : "SMS permission not granted."}
                </p>
              ) : null}
              {sms.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setNumber(m.address)}
                  className="press block w-full rounded-xl bg-surface-2 px-3 py-2 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{m.address}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {timeAgo(m.date)}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{m.body}</p>
                </button>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      <Card>
        <div className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
          Quick contacts
        </div>
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name for the number above"
            className={cn(inputClass, "text-sm")}
          />
          <Btn variant="ghost" onClick={addContact} disabled={!number.trim()}>
            <Plus className="h-4 w-4" />
          </Btn>
        </div>
        <div className="mt-2 space-y-1.5">
          {hydrated && contacts.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No saved contacts yet — type a number and save it here.
            </p>
          ) : null}
          {contacts.map((c: Contact) => (
            <div
              key={c.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-2 rounded-xl bg-surface-2 px-3 py-2"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/12">
                <User className="h-4 w-4 text-primary" />
              </span>
              <button onClick={() => setNumber(c.number)} className="min-w-0 text-left">
                <div className="truncate text-sm font-semibold">{c.name}</div>
                <div className="truncate font-mono text-[11px] text-muted-foreground">
                  {c.number}
                </div>
              </button>
              <button
                onClick={() => void call(c.number)}
                className="press grid h-8 w-8 place-items-center rounded-lg bg-success/15"
                aria-label={`Call ${c.name}`}
              >
                <Phone className="h-4 w-4 text-success" />
              </button>
              <button
                onClick={() => {
                  setNumber(c.number);
                  setTab("messages");
                }}
                className="press grid h-8 w-8 place-items-center rounded-lg bg-primary/12"
                aria-label={`Message ${c.name}`}
              >
                <MessageSquare className="h-4 w-4 text-primary" />
              </button>
              <button
                onClick={() => removeContact(c.id)}
                className="press grid h-8 w-8 place-items-center rounded-lg bg-destructive/10"
                aria-label={`Remove ${c.name}`}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
