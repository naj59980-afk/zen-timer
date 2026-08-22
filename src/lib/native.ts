import { registerPlugin, Capacitor } from "@capacitor/core";

export interface CallLogItem {
  id: string;
  number: string;
  name?: string | null;
  /** 1 incoming · 2 outgoing · 3 missed · 5 rejected */
  type: number;
  date: number;
  duration: number;
}

export interface SmsItem {
  id: string;
  address: string;
  body: string;
  date: number;
  read: boolean;
  box: "inbox" | "sent";
}

export interface PermStatus {
  phone: boolean;
  calllog: boolean;
  sms: boolean;
  contacts: boolean;
  native: boolean;
}

interface TelephonyPlugin {
  requestAll(): Promise<PermStatus>;
  status(): Promise<PermStatus>;
  call(o: { number: string }): Promise<void>;
  sendSms(o: { number: string; text: string }): Promise<void>;
  callLog(o: { limit?: number }): Promise<{ items: CallLogItem[] }>;
  inbox(o: { limit?: number; box?: "inbox" | "sent" }): Promise<{ items: SmsItem[] }>;
}

interface NativeAlarmPlugin {
  ring(o: { seconds?: number; strong?: boolean }): Promise<void>;
  stop(): Promise<void>;
}

const Telephony = registerPlugin<TelephonyPlugin>("Telephony");
const NativeAlarm = registerPlugin<NativeAlarmPlugin>("NativeAlarm");

export function isNativeApp() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

const DENIED: PermStatus = {
  phone: false,
  calllog: false,
  sms: false,
  contacts: false,
  native: false,
};

export async function permStatus(): Promise<PermStatus> {
  if (!isNativeApp()) return DENIED;
  try {
    return await Telephony.status();
  } catch {
    return DENIED;
  }
}

export async function requestTelephonyPerms(): Promise<PermStatus> {
  if (!isNativeApp()) return DENIED;
  try {
    return await Telephony.requestAll();
  } catch {
    return DENIED;
  }
}

/** Places the call in-app when native; falls back to the tel: hand-off on the web. */
export async function placeCall(number: string): Promise<void> {
  if (isNativeApp()) {
    await Telephony.call({ number });
    return;
  }
  window.location.href = `tel:${encodeURIComponent(number)}`;
}

export async function sendSms(number: string, text: string): Promise<void> {
  if (isNativeApp()) {
    await Telephony.sendSms({ number, text });
    return;
  }
  window.location.href = `sms:${encodeURIComponent(number)}?body=${encodeURIComponent(text)}`;
}

export async function readCallLog(limit = 120): Promise<CallLogItem[]> {
  if (!isNativeApp()) return [];
  try {
    const { items } = await Telephony.callLog({ limit });
    return items ?? [];
  } catch {
    return [];
  }
}

export async function readMessages(
  box: "inbox" | "sent" = "inbox",
  limit = 120,
): Promise<SmsItem[]> {
  if (!isNativeApp()) return [];
  try {
    const { items } = await Telephony.inbox({ limit, box });
    return items ?? [];
  } catch {
    return [];
  }
}

/** Screen-off capable alarm. Returns false when the native layer isn't available. */
export function nativeRing(seconds = 6, strong = false): boolean {
  if (!isNativeApp()) return false;
  void NativeAlarm.ring({ seconds, strong }).catch(() => {});
  return true;
}

export function nativeStopRing() {
  if (!isNativeApp()) return;
  void NativeAlarm.stop().catch(() => {});
}
