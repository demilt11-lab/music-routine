import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import SessionHistory from "./pages/SessionHistory";
import WeeklyInsights from "./pages/WeeklyInsights";
import MonthlyProgress from "./pages/MonthlyProgress";
import Settings from "./pages/Settings";
import TrackFeedback from "./pages/TrackFeedback";
import NotFound from "./pages/NotFound";
import { MobileNavBar } from "./components/mobile/MobileNavBar";
import ScrollToTop from "./components/ScrollToTop";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <div className="min-h-screen pb-16 md:pb-0">
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/history" element={<SessionHistory />} />
            <Route path="/insights" element={<WeeklyInsights />} />
            <Route path="/monthly" element={<MonthlyProgress />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/feedback" element={<TrackFeedback />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <MobileNavBar />
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
