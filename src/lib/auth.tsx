import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { ref, get, set, onValue, update } from "firebase/database";
import bcrypt from "bcryptjs";
import { db, ADMIN_PHONE } from "./firebase";
import { normalizePhone, isValidKePhone } from "./phone";

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserRecord | null>(null);
  const [loading, setLoading] = useState(true);

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
        setUser(val);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
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
    setUser(record);
  }

  async function login(phoneInput: string, password: string) {
    const phone = normalizePhone(phoneInput);
    const snap = await get(ref(db, `users/${phone}`));
    if (!snap.exists()) throw new Error("No account with this phone. Please sign up first.");
    const rec = snap.val() as UserRecord;
    const ok = await bcrypt.compare(password, rec.passwordHash);
    if (!ok) throw new Error("Incorrect password.");
    // promote admin if matching phone (idempotent)
    if (phone === ADMIN_PHONE && rec.role !== "admin") {
      await update(ref(db, `users/${phone}`), { role: "admin" });
      rec.role = "admin";
    }
    localStorage.setItem(STORAGE_KEY, phone);
    setUser(rec);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }

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
