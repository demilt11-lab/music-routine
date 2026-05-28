import { NavLink, Outlet } from "react-router-dom";
import { Activity, Compass, History, LineChart, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Home", icon: Compass },
  { to: "/history", label: "History", icon: History },
  { to: "/insights", label: "Insights", icon: LineChart },
  { to: "/settings", label: "Settings", icon: Settings },
];

/** Authenticated layout: content area plus a mobile-first bottom nav. */
export function AppShell() {
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
          <Activity className="h-5 w-5 text-primary" />
          <span className="font-semibold tracking-tight">BioMusic</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-3xl items-stretch justify-around">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
