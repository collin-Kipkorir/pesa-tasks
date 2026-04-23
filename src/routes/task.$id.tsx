import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, CheckCircle2, Loader2, PartyPopper } from "lucide-react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { useSurvey } from "@/lib/use-surveys";
import { enqueueSurvey } from "@/lib/sync-queue";
import { toast } from "sonner";

export const Route = createFileRoute("/task/$id")({
  head: () => ({ meta: [{ title: "Task — Pesatask" }] }),
  component: () => (
    <RequireAuth>
      <TaskPage />
    </RequireAuth>
  ),
});

function TaskPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { survey, loading } = useSurvey(id);
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!loading && !survey) navigate({ to: "/dashboard" });
  }, [loading, survey, navigate]);

  if (loading || !survey) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // already done?
  if (user?.completed?.[survey.id] && !done) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <CheckCircle2 className="h-12 w-12 text-primary" />
        <h2 className="text-xl font-bold">You already completed this survey</h2>
        <Button variant="hero" onClick={() => navigate({ to: "/dashboard" })}>
          Back to dashboard
        </Button>
      </div>
    );
  }

  const total = survey.questions.length;
  const current = survey.questions[step];
  const answered = answers[step] !== undefined;

  const next = () => {
    if (step < total - 1) {
      setStep(step + 1);
      return;
    }
    if (!user) return;
    setSubmitting(true);
    try {
      // Optimistic local credit; queue syncs to Firebase in background.
      enqueueSurvey(user.phone, survey.id, survey.title, survey.reward);
      setDone(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to claim reward.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-muted/30 px-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[image:var(--gradient-cta)] text-primary-foreground shadow-[var(--shadow-cta)] animate-in zoom-in">
          <PartyPopper className="h-10 w-10 animate-bounce" />
        </div>
        <h1 className="text-2xl font-bold">Reward Claimed!</h1>
        <p className="text-muted-foreground">
          KES <span className="font-bold text-primary">{survey.reward}</span> has been added to your balance.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate({ to: "/wallet" })}>
            View Wallet
          </Button>
          <Button variant="hero" onClick={() => navigate({ to: "/dashboard" })}>
            More Surveys
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-12">
      <header className="sticky top-0 z-20 border-b bg-card">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link to="/dashboard" className="rounded-md p-1.5 hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold leading-tight">{survey.title}</h1>
            <p className="text-[11px] text-muted-foreground">
              Question {step + 1} of {total} · Reward KES {survey.reward}
            </p>
          </div>
        </div>
        <Progress value={((step + 1) / total) * 100} className="h-1 rounded-none" />
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        <article className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)] animate-in fade-in slide-in-from-right-4">
          <h2 className="text-lg font-semibold">{current.q}</h2>
          <div className="mt-5 space-y-2">
            {current.options.map((opt, i) => {
              const selected = answers[step] === opt;
              return (
                <button
                  key={i}
                  onClick={() => setAnswers({ ...answers, [step]: opt })}
                  className={`flex w-full items-center justify-between rounded-lg border-2 px-4 py-3 text-left text-sm font-medium transition-all ${
                    selected
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-input bg-background hover:border-primary/40"
                  }`}
                >
                  <span>{opt}</span>
                  {selected && <CheckCircle2 className="h-5 w-5 text-primary" />}
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex gap-3">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
                Previous
              </Button>
            )}
            <Button
              variant="hero"
              className="flex-1"
              onClick={next}
              disabled={!answered || submitting}
            >
              {submitting
                ? "Submitting..."
                : step === total - 1
                  ? `Finish & Claim KES ${survey.reward}`
                  : "Next"}
            </Button>
          </div>
        </article>
      </main>
    </div>
  );
}
