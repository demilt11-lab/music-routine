import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Music2, Eye, EyeOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "login" | "register";
  onToggleMode: () => void;
  onSuccess: (token: string) => void;
}

const AuthModal = ({ isOpen, onClose, mode, onToggleMode, onSuccess }: AuthModalProps) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate API call - in production, connect to your FastAPI backend
    setTimeout(() => {
      setIsLoading(false);
      if (username && password) {
        // Mock success - replace with actual API call
        const mockToken = "mock-jwt-token-" + Date.now();
        toast({
          title: mode === "login" ? "Welcome back!" : "Account created!",
          description: mode === "login" 
            ? "You've successfully signed in." 
            : "Your account has been created successfully.",
        });
        onSuccess(mockToken);
        onClose();
        setUsername("");
        setPassword("");
      }
    }, 1500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-glow">
              <Music2 className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <DialogTitle className="text-2xl font-bold text-center">
            {mode === "login" ? "Welcome back" : "Create account"}
          </DialogTitle>
          <p className="text-center text-muted-foreground text-sm">
            {mode === "login" 
              ? "Sign in to continue to Routine Music" 
              : "Get started with your music journey"}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="h-12"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 pr-12"
              />
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <Button type="submit" variant="hero" size="lg" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {mode === "login" ? "Signing in..." : "Creating account..."}
              </>
            ) : (
              mode === "login" ? "Sign In" : "Create Account"
            )}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button 
              onClick={onToggleMode}
              className="text-primary font-semibold hover:underline"
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;
