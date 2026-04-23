import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, Lock, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import loginIllustration from "@/assets/login-illustration.png";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — Pesatask" },
      { name: "description", content: "Log in to your Pesatask account." },
    ],
  }),
  component: LoginPage,
});

function FloatingInput({
  id,
  label,
  type = "text",
  value,
  onChange,
  icon: Icon,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="relative rounded-md border border-input bg-background px-3 pt-5 pb-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
      <label htmlFor={id} className="absolute left-3 top-1.5 text-xs text-muted-foreground">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          className="h-8 border-0 p-0 shadow-none focus-visible:ring-0"
        />
      </div>
    </div>
  );
}

function LoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(phone, password);
      navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-64 items-end justify-center pb-2" style={{ background: "var(--gradient-hero)" }}>
        <img
          src={loginIllustration}
          alt="Person earning rewards on a laptop"
          width={768}
          height={512}
          className="h-56 w-auto object-contain"
        />
      </div>

      <main className="mx-auto w-full max-w-xl px-6 pt-10 pb-16">
        <h1 className="text-center text-2xl font-bold">Welcome Back</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Log in and continue your journey 🚀
        </p>

        <form className="mt-8 space-y-5" onSubmit={submit}>
          <FloatingInput
            id="phone"
            label="Phone Number (e.g., 0712345678)"
            type="tel"
            value={phone}
            onChange={setPhone}
            icon={Phone}
          />
          <FloatingInput
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            icon={Lock}
          />
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" variant="hero" size="xl" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Login"}
          </Button>
          <Button
            type="button"
            variant="hero"
            size="xl"
            className="w-full"
            onClick={() => navigate({ to: "/signup" })}
          >
            New here? Create an account
          </Button>
        </form>

      </main>
    </div>
  );
}
