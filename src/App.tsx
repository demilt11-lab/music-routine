import { lazy, Suspense } from "react";
import { ThemeProvider } from "next-themes";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ScrollToTop from "@/components/ScrollToTop";
import { queryClient } from "@/lib/query";
import { AuthProvider } from "@/app/auth";
import { ProtectedRoute } from "@/app/ProtectedRoute";
import { AppShell } from "@/app/AppShell";

import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import NotFound from "@/pages/NotFound";

const Onboarding = lazy(() => import("@/pages/Onboarding"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Session = lazy(() => import("@/pages/Session"));
const History = lazy(() => import("@/pages/History"));
const Insights = lazy(() => import("@/pages/Insights"));
const Settings = lazy(() => import("@/pages/Settings"));

const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <ScrollToTop />
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route
                      path="/onboarding"
                      element={
                        <ProtectedRoute>
                          <Onboarding />
                        </ProtectedRoute>
                      }
                    />
                    {/* Authenticated app surface, wrapped in the shell layout. */}
                    <Route
                      element={
                        <ProtectedRoute>
                          <AppShell />
                        </ProtectedRoute>
                      }
                    >
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/history" element={<History />} />
                      <Route path="/insights" element={<Insights />} />
                      <Route path="/settings" element={<Settings />} />
                    </Route>
                    {/* Active session runs full-bleed without the shell chrome. */}
                    <Route
                      path="/session/:id"
                      element={
                        <ProtectedRoute>
                          <Session />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </ErrorBoundary>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
