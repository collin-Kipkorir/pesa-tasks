import { NavLink } from "react-router-dom";
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
          <NavLink
            key={it.to}
            to={it.to}
            end
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`
            }
          >
            <it.icon className="h-5 w-5" />
            {it.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
