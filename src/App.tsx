import { lazy, Suspense, useEffect } from "react";
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

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

const App = () => {
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      console.error("Unhandled rejection:", event.reason);
      event.preventDefault();
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const isPreviewHost =
      window.location.hostname.includes("lovableproject.com") ||
      window.location.hostname.startsWith("id-preview--");

    if (!isPreviewHost || !("serviceWorker" in navigator)) return;
    if (sessionStorage.getItem("preview-sw-cleaned") === "1") return;

    const clearPreviewServiceWorker = async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length > 0) {
        await Promise.all(registrations.map((registration) => registration.unregister()));

        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(
            keys
              .filter((key) => key.includes("workbox") || key.includes("precache") || key.includes("runtime"))
              .map((key) => caches.delete(key))
          );
        }
      }

      sessionStorage.setItem("preview-sw-cleaned", "1");
    };

    clearPreviewServiceWorker().catch((error) => {
      console.warn("Preview service worker cleanup failed:", error);
      sessionStorage.setItem("preview-sw-cleaned", "1");
    });
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ConnectionStatusBanner />
        <ScrollToTop />
        <div className="min-h-screen pb-16 md:pb-0">
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/history" element={<SessionHistory />} />
                <Route path="/insights" element={<WeeklyInsights />} />
                <Route path="/monthly" element={<MonthlyProgress />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/feedback" element={<TrackFeedback />} />
                <Route path="/app" element={<AppListing />} />
                <Route path="/install" element={<Install />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
          <MobileNavBar />
          <IOSInstallPrompt />
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
