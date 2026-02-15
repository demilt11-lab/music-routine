import { Button } from "@/components/ui/button";
import { Music2, Menu, X } from "lucide-react";
import { useState } from "react";

interface NavbarProps {
  onLogin: () => void;
  onRegister: () => void;
}

const Navbar = ({ onLogin, onRegister }: NavbarProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow transition-transform group-hover:scale-105">
              <Music2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">BioMusic</span>
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
              How It Works
            </a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </a>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" onClick={onLogin}>
              Sign In
            </Button>
            <Button variant="hero" onClick={onRegister}>
              Get Started
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden p-2 rounded-lg hover:bg-secondary transition-colors"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden border-t border-border/50 glass">
          <div className="container mx-auto px-6 py-4 space-y-4">
            <a href="#features" onClick={() => setIsOpen(false)} className="block text-muted-foreground hover:text-foreground transition-colors py-2">
              Features
            </a>
            <a href="#how-it-works" onClick={() => setIsOpen(false)} className="block text-muted-foreground hover:text-foreground transition-colors py-2">
              How It Works
            </a>
            <a href="#pricing" onClick={() => setIsOpen(false)} className="block text-muted-foreground hover:text-foreground transition-colors py-2">
              Pricing
            </a>
            <div className="flex flex-col gap-2 pt-4 border-t border-border/50">
              <Button variant="ghost" onClick={onLogin} className="w-full justify-center">
                Sign In
              </Button>
              <Button variant="hero" onClick={onRegister} className="w-full justify-center">
                Get Started
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
