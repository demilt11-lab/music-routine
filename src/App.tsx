import { lazy, Suspense, useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Loader2 } from "lucide-react";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import { MobileNavBar } from "./components/mobile/MobileNavBar";
import ScrollToTop from "./components/ScrollToTop";
import { ConnectionStatusBanner } from "./components/ConnectionStatusBanner";
import { IOSInstallPrompt } from "./components/mobile/IOSInstallPrompt";

// Lazy-load less critical pages
const SessionHistory = lazy(() => import("./pages/SessionHistory"));
const WeeklyInsights = lazy(() => import("./pages/WeeklyInsights"));
const MonthlyProgress = lazy(() => import("./pages/MonthlyProgress"));
const Settings = lazy(() => import("./pages/Settings"));
const TrackFeedback = lazy(() => import("./pages/TrackFeedback"));
const AppListing = lazy(() => import("./pages/AppListing"));
const Install = lazy(() => import("./pages/Install"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Log mutation errors for debugging (but avoid noisy UI toasts)
      onError: (error) => {
        console.error("Mutation error:", error);
      },
    },
  },
});

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

/** Returns true if the current host is a non-production environment */
const isNonProductionHost = () => {
  const h = window.location.hostname;
  return h === "localhost" || h.includes("lovableproject.com") || h.startsWith("id-preview--");
};

const App = () => {
  // Suppress noisy unhandled promise rejections
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      console.error("Unhandled rejection:", event.reason);
      event.preventDefault();
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  // Clean up stale service workers in dev/preview environments
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (!isNonProductionHost()) return;
    const cleanup = async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    };
    cleanup().catch((err) => console.warn("SW cleanup failed:", err));
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ErrorBoundary>
              <ConnectionStatusBanner />
              <IOSInstallPrompt />
              <MobileNavBar />
              <ScrollToTop />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/history" element={<SessionHistory />} />
                  <Route path="/insights" element={<WeeklyInsights />} />
                  <Route path="/progress" element={<MonthlyProgress />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/track-feedback" element={<TrackFeedback />} />
                  <Route path="/apps" element={<AppListing />} />
                  <Route path="/install" element={<Install />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
