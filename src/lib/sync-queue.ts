// Local-first sync queue. Operations are persisted to localStorage and replayed
// to Firebase when the network is available. UI reads optimistically merged state.

import { ref, runTransaction, set, get, push } from "firebase/database";
import { db, WELCOME_BONUS } from "./firebase";

export type PendingOp =
  | { id: string; kind: "welcome"; phone: string; amount: number; createdAt: number }
  | {
      id: string;
      kind: "survey";
      phone: string;
      surveyId: string;
      title: string;
      amount: number;
      createdAt: number;
    };

const KEY = "pesatask:syncQueue";

function readQueue(): PendingOp[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as PendingOp[];
  } catch {
    return [];
  }
}
function writeQueue(q: PendingOp[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(q));
  window.dispatchEvent(new CustomEvent("pesatask:queue-changed"));
}

export function getPending(phone: string): PendingOp[] {
  return readQueue().filter((o) => o.phone === phone);
}

export function getPendingBalance(phone: string): number {
  return getPending(phone).reduce((s, o) => s + o.amount, 0);
}

export function getPendingCompleted(phone: string): Record<string, { date: number }> {
  const out: Record<string, { date: number }> = {};
  for (const o of getPending(phone)) if (o.kind === "survey") out[o.surveyId] = { date: o.createdAt };
  return out;
}

export function hasPendingWelcome(phone: string): boolean {
  return getPending(phone).some((o) => o.kind === "welcome");
}

export function enqueue(op: PendingOp) {
  const q = readQueue();
  q.push(op);
  writeQueue(q);
  // try to flush right away
  void flushQueue();
}

function newId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function enqueueWelcome(phone: string) {
  enqueue({
    id: newId(),
    kind: "welcome",
    phone,
    amount: WELCOME_BONUS,
    createdAt: Date.now(),
  });
}

export function enqueueSurvey(phone: string, surveyId: string, title: string, amount: number) {
  enqueue({
    id: newId(),
    kind: "survey",
    phone,
    surveyId,
    title,
    amount,
    createdAt: Date.now(),
  });
}

let flushing = false;

export async function flushQueue(): Promise<void> {
  if (flushing) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  flushing = true;
  try {
    let q = readQueue();
    const remaining: PendingOp[] = [];
    for (const op of q) {
      try {
        if (op.kind === "welcome") {
          await syncWelcome(op);
        } else if (op.kind === "survey") {
          await syncSurvey(op);
        }
      } catch (e) {
        // keep in queue and retry later
        remaining.push(op);
        // eslint-disable-next-line no-console
        console.warn("[sync] failed", op, e);
      }
    }
    // Filter: items that succeeded should be removed; remaining stays.
    q = readQueue();
    const successIds = new Set(
      q.filter((o) => !remaining.find((r) => r.id === o.id)).map((o) => o.id),
    );
    writeQueue(q.filter((o) => !successIds.has(o.id)));
  } finally {
    flushing = false;
  }
}

async function syncWelcome(op: Extract<PendingOp, { kind: "welcome" }>) {
  const userRef = ref(db, `users/${op.phone}`);
  const result = await runTransaction(userRef, (cur) => {
    if (!cur) return cur;
    if (cur.welcomeClaimed) return cur;
    cur.welcomeClaimed = true;
    cur.balance = (cur.balance || 0) + op.amount;
    return cur;
  });
  if (!result.committed) throw new Error("welcome txn not committed");
  const snap = result.snapshot.val();
  if (snap?.welcomeClaimed) {
    const r = push(ref(db, `users/${op.phone}/rewards`));
    // Idempotency: only push reward if no bonus reward exists already
    const rewardsSnap = await get(ref(db, `users/${op.phone}/rewards`));
    const existing = rewardsSnap.val() as Record<string, { type?: string }> | null;
    const hasBonus = existing && Object.values(existing).some((x) => x?.type === "bonus");
    if (!hasBonus) {
      await set(r, {
        amount: op.amount,
        source: "Welcome Bonus",
        date: op.createdAt,
        type: "bonus",
      });
    }
  }
}

async function syncSurvey(op: Extract<PendingOp, { kind: "survey" }>) {
  const completedRef = ref(db, `users/${op.phone}/completed/${op.surveyId}`);
  const already = await get(completedRef);
  if (already.exists()) return; // already credited server-side
  await runTransaction(ref(db, `users/${op.phone}/balance`), (b) => (b || 0) + op.amount);
  await set(completedRef, { date: op.createdAt, amount: op.amount, title: op.title });
  const r = push(ref(db, `users/${op.phone}/rewards`));
  await set(r, {
    amount: op.amount,
    source: op.title,
    date: op.createdAt,
    type: "survey",
  });
}

export function startBackgroundSync() {
  if (typeof window === "undefined") return () => {};
  const onOnline = () => void flushQueue();
  const onChange = () => void flushQueue();
  window.addEventListener("online", onOnline);
  window.addEventListener("pesatask:queue-changed", onChange);
  // Periodic retry every 15s
  const t = window.setInterval(() => void flushQueue(), 15000);
  // Initial attempt
  void flushQueue();
  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("pesatask:queue-changed", onChange);
    window.clearInterval(t);
  };
}
