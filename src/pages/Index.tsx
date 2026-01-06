import { useState } from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Footer from "@/components/Footer";
import AuthModal from "@/components/AuthModal";
import Dashboard from "@/components/Dashboard";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [isSpotifyConnected, setIsSpotifyConnected] = useState(false);
  const { toast } = useToast();

  const handleLogin = () => {
    setAuthMode("login");
    setIsAuthModalOpen(true);
  };

  const handleRegister = () => {
    setAuthMode("register");
    setIsAuthModalOpen(true);
  };

  const handleAuthSuccess = (token: string) => {
    setIsAuthenticated(true);
    localStorage.setItem("token", token);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setIsSpotifyConnected(false);
    localStorage.removeItem("token");
    toast({
      title: "Signed out",
      description: "You've been successfully signed out.",
    });
  };

  const handleConnectSpotify = () => {
    // In production, this would redirect to Spotify OAuth
    // For now, simulate connection
    if (!isSpotifyConnected) {
      toast({
        title: "Connecting to Spotify...",
        description: "Redirecting to Spotify authorization.",
      });
      setTimeout(() => {
        setIsSpotifyConnected(true);
        toast({
          title: "Spotify Connected!",
          description: "Your account is now linked with Spotify.",
        });
      }, 1500);
    }
  };

  if (isAuthenticated) {
    return (
      <Dashboard 
        onLogout={handleLogout} 
        onConnectSpotify={handleConnectSpotify}
        isSpotifyConnected={isSpotifyConnected}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background dark">
      <Navbar onLogin={handleLogin} onRegister={handleRegister} />
      <Hero onGetStarted={handleRegister} />
      <Features />
      <Footer />
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        mode={authMode}
        onToggleMode={() => setAuthMode(authMode === "login" ? "register" : "login")}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
};

export default Index;
