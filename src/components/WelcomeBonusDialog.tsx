import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Gift, Sparkles, PartyPopper } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { enqueueWelcome } from "@/lib/sync-queue";
import { WELCOME_BONUS } from "@/lib/firebase";

export function WelcomeBonusDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    if (user && !user.welcomeClaimed) setOpen(true);
    else setOpen(false);
  }, [user?.phone, user?.welcomeClaimed]);

  if (!user) return null;

  const onClaim = () => {
    // Optimistically credit locally; background sync writes to Firebase.
    enqueueWelcome(user.phone);
    setClaimed(true);
    setTimeout(() => setOpen(false), 1500);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !claimed) return;
        setOpen(o);
      }}
    >
      <DialogContent
        className="sm:max-w-md overflow-hidden border-0 p-0"
        onEscapeKeyDown={(e) => !claimed && e.preventDefault()}
        onPointerDownOutside={(e) => !claimed && e.preventDefault()}
      >
        <div className="relative bg-[image:var(--gradient-cta)] px-6 pt-10 pb-8 text-center text-primary-foreground">
          <Sparkles className="absolute left-6 top-6 h-5 w-5 animate-pulse text-yellow-200" />
          <Sparkles className="absolute right-8 top-12 h-4 w-4 animate-pulse text-yellow-100 [animation-delay:300ms]" />
          <Sparkles className="absolute left-10 bottom-6 h-3 w-3 animate-pulse text-white [animation-delay:600ms]" />

          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/20 shadow-lg ring-4 ring-white/20 animate-in zoom-in-50 duration-500">
            {claimed ? (
              <PartyPopper className="h-10 w-10 animate-bounce" />
            ) : (
              <Gift className="h-10 w-10 animate-bounce" />
            )}
          </div>

          <DialogTitle className="mt-5 text-2xl font-bold animate-in fade-in slide-in-from-bottom-2 duration-500">
            {claimed ? "Bonus Added! 🎉" : "Welcome Gift Unlocked!"}
          </DialogTitle>
          <DialogDescription className="mt-1 text-primary-foreground/85 animate-in fade-in delay-200">
            {claimed
              ? "Your balance has been credited."
              : "Hi " + user.name.split(" ")[0] + ", here's a little something to get you started."}
          </DialogDescription>

          <div className="mt-6 inline-flex items-baseline gap-2 rounded-2xl bg-white/15 px-6 py-3 backdrop-blur animate-in zoom-in duration-500 delay-150">
            <span className="text-sm opacity-80">KES</span>
            <span className="text-4xl font-extrabold tracking-tight">
              {WELCOME_BONUS.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="space-y-3 bg-card px-6 py-5">
          <p className="text-center text-xs text-muted-foreground">
            Tap claim to add this to your wallet — you can complete surveys to earn more.
          </p>
          <Button
            variant="hero"
            size="xl"
            className="w-full"
            disabled={claimed}
            onClick={onClaim}
          >
            {claimed ? "Claimed ✓" : `Claim KES ${WELCOME_BONUS}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
