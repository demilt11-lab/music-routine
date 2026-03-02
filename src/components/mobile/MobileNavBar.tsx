import { forwardRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, History, BarChart3, Calendar, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNativeHaptics } from "@/hooks/useNativeHaptics";

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { path: "/", label: "Home", icon: Home },
  { path: "/history", label: "History", icon: History },
  { path: "/dashboard", label: "Session", icon: BarChart3 },
  { path: "/insights", label: "Insights", icon: Calendar },
  { path: "/monthly", label: "Progress", icon: User },
];

export const MobileNavBar = forwardRef<HTMLElement>((_, ref) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { tapFeedback, selectionFeedback } = useNativeHaptics();

  const handleNavigation = (path: string) => {
    if (location.pathname !== path) {
      selectionFeedback();
      navigate(path);
    } else {
      tapFeedback();
    }
  };

  return (
    <nav ref={ref} className="fixed bottom-0 left-0 right-0 z-50 md:hidden safe-area-bottom">
      <div className="glass border-t border-border/50 backdrop-blur-xl">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <button
                key={item.path}
                onClick={() => handleNavigation(item.path)}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-all duration-200",
                  "active:scale-95 touch-manipulation",
                  isActive 
                    ? "text-primary" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn(
                  "w-5 h-5 transition-transform",
                  isActive && "scale-110"
                )} />
                <span className={cn(
                  "text-[10px] font-medium",
                  isActive && "font-semibold"
                )}>
                  {item.label}
                </span>
                {isActive && (
                  <div className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
});

MobileNavBar.displayName = "MobileNavBar";
