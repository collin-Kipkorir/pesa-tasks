import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function SignupDialog({ open, onOpenChange }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;
    setSubmitted(true);
    setTimeout(() => {
      onOpenChange(false);
      navigate({ to: "/dashboard" });
    }, 1200);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-14 w-14 text-primary" />
            <h3 className="text-xl font-bold">Welcome aboard, {name.split(" ")[0]}!</h3>
            <p className="text-sm text-muted-foreground">Setting up your account…</p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl">Create your account</DialogTitle>
              <DialogDescription>
                Start earning M-Pesa cash today. It only takes a moment.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Wanjiku"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">M-Pesa phone number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07xx xxx xxx"
                  required
                />
              </div>
              <Button type="submit" variant="hero" size="xl" className="w-full">
                Create account
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    navigate({ to: "/login" });
                  }}
                  className="font-semibold text-primary hover:underline"
                >
                  Log in
                </button>
              </p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
