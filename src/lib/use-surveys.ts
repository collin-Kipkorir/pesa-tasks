import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { db } from "./firebase";
import type { Survey } from "./surveys-seed";
import { seedSurveysIfEmpty } from "./surveys-seed";

export function useSurveys() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    seedSurveysIfEmpty().catch(() => {});
    const unsub = onValue(ref(db, "surveys"), (snap) => {
      const val = snap.val() as Record<string, Survey> | null;
      if (!mounted) return;
      const list = val ? Object.values(val).sort((a, b) => a.createdAt - b.createdAt) : [];
      setSurveys(list);
      setLoading(false);
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  return { surveys, loading };
}

export function useSurvey(id: string) {
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = onValue(ref(db, `surveys/${id}`), (snap) => {
      setSurvey((snap.val() as Survey | null) ?? null);
      setLoading(false);
    });
    return () => unsub();
  }, [id]);
  return { survey, loading };
}
