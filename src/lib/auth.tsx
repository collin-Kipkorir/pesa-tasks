import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { ref, get, set, onValue, update } from "firebase/database";
import bcrypt from "bcryptjs";
import { db, ADMIN_PHONE } from "./firebase";
import { normalizePhone, isValidKePhone } from "./phone";
import {
  startBackgroundSync,
  getPendingBalance,
  getPendingCompleted,
  hasPendingWelcome,
} from "./sync-queue";

export type UserRecord = {
  phone: string;
  name: string;
  email?: string;
  passwordHash: string;
  balance: number;
  activated: boolean;
  vip: boolean;
  welcomeClaimed: boolean;
  createdAt: number;
  role?: "admin" | "user";
  // dynamic Firebase children — populated as user uses the app
  rewards?: Record<string, { amount: number; source: string; date: number; type: string }>;
  withdrawals?: Record<string, { amount: number; date: number; status: string }>;
  completed?: Record<string, { date: number; amount: number; title: string }>;
};

type AuthCtx = {
  user: UserRecord | null;
  loading: boolean;
  signup: (data: { name: string; email?: string; phone: string; password: string }) => Promise<void>;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
};

const Ctx = createContext<AuthCtx | null>(null);
const STORAGE_KEY = "pesatask:session";

// Subscribe to local sync-queue changes (online/offline, queue mutations)
function subscribeQueue(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener("pesatask:queue-changed", handler);
  window.addEventListener("online", handler);
  window.addEventListener("offline", handler);
  return () => {
    window.removeEventListener("pesatask:queue-changed", handler);
    window.removeEventListener("online", handler);
    window.removeEventListener("offline", handler);
  };
}
function getQueueSnap() {
  // any value that changes when queue mutates is fine; use length+timestamp marker
  if (typeof window === "undefined") return "0";
  return localStorage.getItem("pesatask:syncQueue") || "0";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [rawUser, setRawUser] = useState<UserRecord | null>(null);
  const [loading, setLoading] = useState(true);

  // Trigger re-render whenever the local sync queue changes
  useSyncExternalStore(subscribeQueue, getQueueSnap, () => "0");

  // restore session + subscribe to live user record
  useEffect(() => {
    const phone = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!phone) {
      setLoading(false);
      return;
    }
    const r = ref(db, `users/${phone}`);
    const unsub = onValue(
      r,
      (snap) => {
        const val = snap.val() as UserRecord | null;
        setRawUser(val);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, []);

  // Start background sync once mounted
  useEffect(() => {
    return startBackgroundSync();
  }, []);

  async function signup(data: { name: string; email?: string; phone: string; password: string }) {
    const phone = normalizePhone(data.phone);
    if (!isValidKePhone(phone)) throw new Error("Enter a valid Kenyan phone number (07xx or 01xx).");
    if (data.password.length < 4) throw new Error("Password must be at least 4 characters.");
    const existing = await get(ref(db, `users/${phone}`));
    if (existing.exists()) throw new Error("An account with this phone already exists. Please log in.");
    const passwordHash = await bcrypt.hash(data.password, 8);
    const record: UserRecord = {
      phone,
      name: data.name.trim(),
      email: data.email?.trim() || "",
      passwordHash,
      balance: 0,
      activated: false,
      vip: false,
      welcomeClaimed: false,
      createdAt: Date.now(),
      role: phone === ADMIN_PHONE ? "admin" : "user",
    };
    await set(ref(db, `users/${phone}`), record);
    localStorage.setItem(STORAGE_KEY, phone);
    setRawUser(record);
  }

  async function login(phoneInput: string, password: string) {
    const phone = normalizePhone(phoneInput);
    const snap = await get(ref(db, `users/${phone}`));
    if (!snap.exists()) throw new Error("No account with this phone. Please sign up first.");
    const rec = snap.val() as UserRecord;
    const ok = await bcrypt.compare(password, rec.passwordHash);
    if (!ok) throw new Error("Incorrect password.");
    if (phone === ADMIN_PHONE && rec.role !== "admin") {
      await update(ref(db, `users/${phone}`), { role: "admin" });
      rec.role = "admin";
    }
    localStorage.setItem(STORAGE_KEY, phone);
    setRawUser(rec);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setRawUser(null);
  }

  // Optimistic merge: overlay pending queue items on top of server snapshot
  const user: UserRecord | null = rawUser
    ? (() => {
        const phone = rawUser.phone;
        const pendingBal = getPendingBalance(phone);
        const pendingDone = getPendingCompleted(phone);
        const pendingWelcome = hasPendingWelcome(phone);
        return {
          ...rawUser,
          balance: (rawUser.balance || 0) + pendingBal,
          welcomeClaimed: rawUser.welcomeClaimed || pendingWelcome,
          completed: { ...(rawUser.completed || {}), ...Object.fromEntries(
            Object.entries(pendingDone).map(([id, v]) => [id, { date: v.date, amount: 0, title: "" }]),
          ) },
        };
      })()
    : null;

  return (
    <Ctx.Provider value={{ user, loading, signup, login, logout, isAdmin: user?.role === "admin" }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
