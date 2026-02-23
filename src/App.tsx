import { lazy, Suspense } from "react";
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

const App = () => (
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
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
