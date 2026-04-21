import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ref, onValue, set, remove, push } from "firebase/database";
import { ArrowLeft, Trash2, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RequireAuth } from "@/components/RequireAuth";
import { db } from "@/lib/firebase";
import type { Survey, Question } from "@/lib/surveys-seed";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Pesatask" }] }),
  component: () => (
    <RequireAuth requireAdmin>
      <AdminPage />
    </RequireAuth>
  ),
});

function emptySurvey(): Survey {
  return {
    id: "",
    title: "",
    description: "",
    reward: 100,
    duration: "5 mins",
    questions: [{ q: "", options: ["", "", "", ""] }],
    category: "free",
    icon: "smartphone",
    createdAt: Date.now(),
  };
}

function AdminPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [editing, setEditing] = useState<Survey | null>(null);

  useEffect(() => {
    const unsub = onValue(ref(db, "surveys"), (snap) => {
      const v = (snap.val() as Record<string, Survey> | null) || {};
      setSurveys(Object.values(v).sort((a, b) => a.createdAt - b.createdAt));
    });
    return () => unsub();
  }, []);

  const save = async (s: Survey) => {
    const id = s.id || `survey-${Date.now()}`;
    const final: Survey = { ...s, id, createdAt: s.createdAt || Date.now() };
    await set(ref(db, `surveys/${id}`), final);
    toast.success("Survey saved.");
    setEditing(null);
  };

  const del = async (id: string) => {
    if (!confirm("Delete this survey?")) return;
    await remove(ref(db, `surveys/${id}`));
    toast.success("Deleted.");
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-12">
      <header className="sticky top-0 z-20 border-b bg-card">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Link to="/profile" className="rounded-md p-1.5 hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="flex-1 text-base font-bold">Admin · Surveys</h1>
          <Button variant="hero" size="sm" onClick={() => setEditing(emptySurvey())}>
            <Plus className="mr-1 h-4 w-4" /> New Survey
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-3 px-4 py-5">
        {surveys.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    s.category === "vip"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {s.category}
                </span>
                <h3 className="font-semibold">{s.title}</h3>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {s.questions.length} questions · KES {s.reward} · {s.duration}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditing(s)}>
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => del(s.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        {surveys.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">No surveys yet.</p>
        )}
      </main>

      {editing && (
        <SurveyEditor
          survey={editing}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

function SurveyEditor({
  survey,
  onCancel,
  onSave,
}: {
  survey: Survey;
  onCancel: () => void;
  onSave: (s: Survey) => void;
}) {
  const [s, setS] = useState<Survey>(survey);

  const updateQ = (i: number, q: Question) => {
    const next = [...s.questions];
    next[i] = q;
    setS({ ...s, questions: next });
  };

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-2xl rounded-2xl bg-card p-6 shadow-xl">
        <h2 className="text-lg font-bold">{survey.id ? "Edit Survey" : "New Survey"}</h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Title">
            <Input value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} />
          </Field>
          <Field label="Reward (KES)">
            <Input
              type="number"
              value={s.reward}
              onChange={(e) => setS({ ...s, reward: Number(e.target.value) })}
            />
          </Field>
          <Field label="Duration">
            <Input value={s.duration} onChange={(e) => setS({ ...s, duration: e.target.value })} />
          </Field>
          <Field label="Category">
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={s.category}
              onChange={(e) => setS({ ...s, category: e.target.value as "free" | "vip" })}
            >
              <option value="free">Free</option>
              <option value="vip">VIP</option>
            </select>
          </Field>
          <Field label="Icon">
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={s.icon}
              onChange={(e) => setS({ ...s, icon: e.target.value as Survey["icon"] })}
            >
              <option value="smartphone">Smartphone</option>
              <option value="zap">Zap (energy)</option>
              <option value="wifi">Wifi</option>
              <option value="lightbulb">Lightbulb</option>
            </select>
          </Field>
          <Field label="ID (slug, leave empty for auto)">
            <Input
              value={s.id}
              disabled={!!survey.id}
              onChange={(e) => setS({ ...s, id: e.target.value.replace(/[^a-z0-9-]/gi, "-").toLowerCase() })}
              placeholder="auto-generated"
            />
          </Field>
        </div>

        <Field label="Description" className="mt-3">
          <Textarea
            value={s.description}
            onChange={(e) => setS({ ...s, description: e.target.value })}
            rows={2}
          />
        </Field>

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Questions ({s.questions.length})</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setS({ ...s, questions: [...s.questions, { q: "", options: ["", "", "", ""] }] })
              }
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add
            </Button>
          </div>
          <div className="mt-3 space-y-3">
            {s.questions.map((q, i) => (
              <div key={i} className="rounded-lg border p-3">
                <div className="flex items-start gap-2">
                  <span className="mt-2 text-xs font-bold text-muted-foreground">Q{i + 1}</span>
                  <Input
                    value={q.q}
                    onChange={(e) => updateQ(i, { ...q, q: e.target.value })}
                    placeholder="Question text"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const next = s.questions.filter((_, j) => j !== i);
                      setS({ ...s, questions: next.length ? next : [{ q: "", options: ["", "", "", ""] }] });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {q.options.map((opt, j) => (
                    <Input
                      key={j}
                      value={opt}
                      onChange={(e) => {
                        const opts = [...q.options];
                        opts[j] = e.target.value;
                        updateQ(i, { ...q, options: opts });
                      }}
                      placeholder={`Option ${j + 1}`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="hero" onClick={() => onSave(s)} disabled={!s.title}>
            <Save className="mr-1 h-4 w-4" /> Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

// Avoid unused import linter complaint
void push;
