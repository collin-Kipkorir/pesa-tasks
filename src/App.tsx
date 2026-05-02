import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import InstallDialog from "@/components/InstallDialog";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Dashboard from "@/pages/Dashboard";
import Wallet from "@/pages/Wallet";
import Profile from "@/pages/Profile";
import Rewards from "@/pages/Rewards";
import Admin from "@/pages/Admin";
import Task from "@/pages/Task";

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/rewards" element={<Rewards />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/task/:id" element={<Task />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster />
  <InstallDialog />
      </AuthProvider>
    </BrowserRouter>
  );
}
