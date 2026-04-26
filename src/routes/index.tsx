import { createFileRoute, Link } from "@tanstack/react-router";
import heroImg from "@/assets/hero-earner.png";
import mpesaLogo from "@/assets/mpesa-logo.png";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Users, Wallet } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pesatask Paid Surveys — Earn M-Pesa Cash" },
      {
        name: "description",
        content:
          "Complete surveys, rate apps and explore offers. Withdraw instantly to M-Pesa. Join thousands of Kenyans earning daily with Pesatask.",
      },
      { property: "og:title", content: "Pesatask Paid Surveys — Earn M-Pesa Cash" },
      {
        property: "og:description",
        content: "Turn spare time into real M-Pesa cash with paid surveys.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="absolute inset-x-0 top-0 z-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-bold text-primary-deep">Pesatask</span>
          <Link
            to="/login"
            className="text-sm font-medium text-primary-deep hover:text-primary"
          >
            Log in
          </Link>
        </div>
      </header>

      {/* Hero illustration band */}
      <section
        className="flex items-end justify-center pt-16"
        style={{ background: "var(--gradient-hero)" }}
      >
        <img
          src={heroImg}
          alt="Person earning M-Pesa cash from surveys on a laptop"
          width={1024}
          height={1024}
          className="h-72 w-auto sm:h-80 md:h-96"
        />
      </section>

      {/* Content */}
      <main className="mx-auto max-w-2xl px-6 pb-16 pt-10 text-center">
        <p className="text-base font-bold tracking-tight text-primary">
          Pesatask Paid Surveys
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
          Turn Spare Time into Real M-Pesa Cash
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
          Complete surveys, rate apps, and explore offers. Withdraw instantly to
          M-Pesa and join thousands of Kenyans already earning daily.
        </p>

        <div className="mt-8">
          <Button
            asChild
            variant="hero"
            size="xl"
            className="w-full max-w-md"
          >
            <Link to="/login">Get Started</Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="mt-12 grid grid-cols-2 gap-6">
          <div>
            <div className="text-2xl font-bold text-primary sm:text-3xl">7,600+</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Trusted Users Across Kenya
            </p>
          </div>
          <div>
            <div className="text-2xl font-bold text-primary sm:text-3xl">
              Ksh 140,000+
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Paid Out Securely</p>
          </div>
        </div>

        {/* M-Pesa badge */}
        <div className="mt-10 flex justify-center">
          <img
            src={mpesaLogo}
            alt="M-Pesa"
            width={512}
            height={512}
            loading="lazy"
            className="h-12 w-auto"
          />
        </div>

        {/* Testimonial */}
        <figure className="mt-10 rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
            <Users className="h-6 w-6" />
          </div>
          <blockquote className="mt-4 italic text-foreground">
            “I made KES 500 in a week with simple surveys. The M-Pesa cash-out is
            instant and reliable!”
          </blockquote>
          <figcaption className="mt-3 text-sm text-muted-foreground">
            — Jane, Nairobi
          </figcaption>
        </figure>

        {/* Trust row */}
        <div className="mt-10 grid grid-cols-3 gap-4 text-xs text-muted-foreground">
          <div className="flex flex-col items-center gap-1">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Secure Payouts
          </div>
          <div className="flex flex-col items-center gap-1">
            <Wallet className="h-5 w-5 text-primary" />
            Instant M-Pesa
          </div>
          <div className="flex flex-col items-center gap-1">
            <Users className="h-5 w-5 text-primary" />
            7,600+ Users
          </div>
        </div>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Pesatask. All rights reserved.
      </footer>

    </div>
  );
}
