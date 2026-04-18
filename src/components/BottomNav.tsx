import { Link } from "@tanstack/react-router";
import { Home as HomeIcon, Gift, Wallet, User } from "lucide-react";

const items = [
  { to: "/dashboard", icon: HomeIcon, label: "Home" },
  { to: "/rewards", icon: Gift, label: "Rewards" },
  { to: "/wallet", icon: Wallet, label: "Wallet" },
  { to: "/profile", icon: User, label: "Profile" },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-card">
      <div className="mx-auto grid max-w-3xl grid-cols-4">
        {items.map((it) => (
          <Link
            key={it.to}
            to={it.to}
            className="flex flex-col items-center gap-1 py-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            activeProps={{ className: "text-primary" }}
            activeOptions={{ exact: true }}
          >
            <it.icon className="h-5 w-5" />
            {it.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
