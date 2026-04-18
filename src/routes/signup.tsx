import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Mail, Phone, Lock } from "lucide-react";
import signupIllustration from "@/assets/signup-illustration.png";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign up — Pesatask" },
      {
        name: "description",
        content: "Create your Pesatask account and start earning M-Pesa cash today.",
      },
    ],
  }),
  component: SignupPage,
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
      <label
        htmlFor={id}
        className="absolute left-3 top-1.5 text-xs text-muted-foreground"
      >
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

function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div
        className="flex h-64 items-end justify-center pb-2"
        style={{ background: "var(--gradient-hero)" }}
      >
        <img
          src={signupIllustration}
          alt="Happy person holding cash"
          width={768}
          height={512}
          className="h-56 w-auto object-contain"
        />
      </div>

      <main className="mx-auto w-full max-w-xl px-6 pt-10 pb-16">
        <h1 className="text-center text-2xl font-bold">Create Your Account</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Join us today and start earning rewards instantly 🚀
        </p>

        <form
          className="mt-8 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ to: "/dashboard" });
          }}
        >
          <FloatingInput id="name" label="Full Name" value={name} onChange={setName} icon={User} />
          <FloatingInput
            id="email"
            label="Email Address"
            type="email"
            value={email}
            onChange={setEmail}
            icon={Mail}
          />
          <FloatingInput
            id="phone"
            label="Phone Number (e.g., 0712345678 or 254712345678)"
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

          <Button type="submit" variant="hero" size="xl" className="w-full">
            Sign Up
          </Button>
          <Button
            type="button"
            variant="hero"
            size="xl"
            className="w-full"
            onClick={() => navigate({ to: "/login" })}
          >
            Already have an account? Login
          </Button>
        </form>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            ← Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
