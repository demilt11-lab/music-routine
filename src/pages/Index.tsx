import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
import Pricing from "@/components/Pricing";
import Footer from "@/components/Footer";
import Testimonials from "@/components/Testimonials";
import BackToTop from "@/components/BackToTop";
import AuthModal from "@/components/AuthModal";
import { MobileOnboarding } from "@/components/mobile/MobileOnboarding";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const { showOnboarding, isLoading, completeOnboarding } = useOnboarding();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  // Single auth listener — no duplicate getSession + onAuthStateChange race
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        navigate("/dashboard", { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogin = () => {
    setAuthMode("login");
    setIsAuthModalOpen(true);
  };

  const handleRegister = () => {
    setAuthMode("register");
    setIsAuthModalOpen(true);
  };

  // Show onboarding for first-time mobile users
  if (isMobile && showOnboarding && !isLoading) {
    return <MobileOnboarding onComplete={completeOnboarding} />;
  }

  return (
    <div className="min-h-screen bg-background dark">
      <Navbar onLogin={handleLogin} onRegister={handleRegister} />
      <Hero onGetStarted={handleRegister} />
      <Features />
      <HowItWorks />
      <Pricing onGetStarted={handleRegister} />
      <Testimonials />
      <Footer />
      <BackToTop />
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        mode={authMode}
        onToggleMode={() => setAuthMode(authMode === "login" ? "register" : "login")}
      />
    </div>
  );
};

export default Index;
