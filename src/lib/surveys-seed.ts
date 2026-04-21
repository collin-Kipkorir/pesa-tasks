import { ref, get, set } from "firebase/database";
import { db } from "./firebase";

export type Question = {
  q: string;
  options: string[];
};

export type Survey = {
  id: string;
  title: string;
  description: string;
  reward: number;
  duration: string;
  questions: Question[];
  category: "free" | "vip";
  icon: "smartphone" | "zap" | "wifi" | "lightbulb";
  createdAt: number;
};

const sampleQuestions = (n: number): Question[] =>
  Array.from({ length: n }, (_, i) => ({
    q: `Question ${i + 1}: How would you rate your experience?`,
    options: ["Excellent", "Good", "Average", "Poor"],
  }));

export const SEED_SURVEYS: Survey[] = [
  {
    id: "safaricom-1",
    title: "Safaricom Services Quiz Part 1",
    description: "Survey your experience with Safaricom M-Pesa, airtime, and data bundles.",
    reward: 100,
    duration: "5 mins",
    questions: sampleQuestions(15),
    category: "free",
    icon: "smartphone",
    createdAt: Date.now(),
  },
  {
    id: "safaricom-2",
    title: "Safaricom Services Quiz Part 2",
    description: "Continue rating Safaricom data, Fuliza and Hustler Fund experience.",
    reward: 150,
    duration: "6 mins",
    questions: sampleQuestions(18),
    category: "free",
    icon: "smartphone",
    createdAt: Date.now(),
  },
  {
    id: "mobile-banking",
    title: "Mobile Banking Habits",
    description: "Tell us how you use mobile banking apps in Kenya.",
    reward: 200,
    duration: "8 mins",
    questions: sampleQuestions(20),
    category: "free",
    icon: "smartphone",
    createdAt: Date.now(),
  },
  {
    id: "kplc",
    title: "Electricity Connection Quiz",
    description: "Survey on rural electrification and KPLC new connections.",
    reward: 750,
    duration: "10 mins",
    questions: sampleQuestions(9),
    category: "vip",
    icon: "zap",
    createdAt: Date.now(),
  },
  {
    id: "internet",
    title: "Internet & Data Survey",
    description: "Feedback on fiber internet, bundles, and providers.",
    reward: 1000,
    duration: "14 mins",
    questions: sampleQuestions(10),
    category: "vip",
    icon: "wifi",
    createdAt: Date.now(),
  },
  {
    id: "women-empowerment",
    title: "Women Empowerment Quiz",
    description: "Share your views on gender equality and women in business.",
    reward: 1200,
    duration: "12 mins",
    questions: sampleQuestions(11),
    category: "vip",
    icon: "lightbulb",
    createdAt: Date.now(),
  },
];

/** Idempotently seed surveys if the node is empty. */
export async function seedSurveysIfEmpty() {
  const snap = await get(ref(db, "surveys"));
  if (snap.exists()) return;
  const obj: Record<string, Survey> = {};
  for (const s of SEED_SURVEYS) obj[s.id] = s;
  await set(ref(db, "surveys"), obj);
}
