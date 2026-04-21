import { ref, runTransaction, push, set, get, update } from "firebase/database";
import { db, WELCOME_BONUS } from "./firebase";

export type Reward = {
  amount: number;
  source: string;
  date: number;
  type: "bonus" | "survey" | "withdrawal" | "activation" | "vip";
};

export async function claimWelcomeBonus(phone: string): Promise<boolean> {
  const userRef = ref(db, `users/${phone}`);
  const result = await runTransaction(userRef, (cur) => {
    if (!cur) return cur;
    if (cur.welcomeClaimed) return cur;
    cur.welcomeClaimed = true;
    cur.balance = (cur.balance || 0) + WELCOME_BONUS;
    return cur;
  });
  if (!result.committed) return false;
  const snap = result.snapshot.val();
  if (snap?.welcomeClaimed) {
    await pushReward(phone, {
      amount: WELCOME_BONUS,
      source: "Welcome Bonus",
      date: Date.now(),
      type: "bonus",
    });
    return true;
  }
  return false;
}

export async function creditSurveyReward(phone: string, surveyId: string, title: string, amount: number) {
  const completedRef = ref(db, `users/${phone}/completed/${surveyId}`);
  const already = await get(completedRef);
  if (already.exists()) throw new Error("You already completed this survey.");
  await runTransaction(ref(db, `users/${phone}/balance`), (b) => (b || 0) + amount);
  await set(completedRef, { date: Date.now(), amount, title });
  await pushReward(phone, { amount, source: title, date: Date.now(), type: "survey" });
}

export async function pushReward(phone: string, reward: Reward) {
  const r = push(ref(db, `users/${phone}/rewards`));
  await set(r, reward);
}

export async function recordWithdrawal(phone: string, amount: number) {
  await runTransaction(ref(db, `users/${phone}/balance`), (b) => Math.max(0, (b || 0) - amount));
  const r = push(ref(db, `users/${phone}/withdrawals`));
  await set(r, { amount, date: Date.now(), status: "Pending" });
}

export async function markActivated(phone: string) {
  await update(ref(db, `users/${phone}`), { activated: true });
  await pushReward(phone, { amount: 0, source: "Account Activation", date: Date.now(), type: "activation" });
}

export async function markVip(phone: string) {
  await update(ref(db, `users/${phone}`), { vip: true });
  await pushReward(phone, { amount: 0, source: "VIP Unlock", date: Date.now(), type: "vip" });
}
