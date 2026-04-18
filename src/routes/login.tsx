import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — Pesatask" },
      { name: "description", content: "Log in to your Pesatask account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  return (
    <div
      className="flex min-h-screen items-center justify-center px-6 py-12"
      style={{ background: "var(--gradient-hero)" }}
    >
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-[var(--shadow-card)]">
        <Link to="/" className="text-sm text-primary hover:underline">
          ← Back
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Log in to continue earning.
        </p>

        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ to: "/dashboard" });
          }}
        >
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
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <Button type="submit" variant="hero" size="xl" className="w-full">
            Log in
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          New to Pesatask?{" "}
          <Link to="/" className="font-semibold text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
