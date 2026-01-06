import { Button } from "@/components/ui/button";
import { Music, Headphones, Sparkles } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";

interface HeroProps {
  onGetStarted: () => void;
}

const Hero = ({ onGetStarted }: HeroProps) => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />
      </div>

      {/* Floating Elements */}
      <div className="absolute top-20 left-10 animate-float opacity-20">
        <Music className="w-16 h-16 text-primary" />
      </div>
      <div className="absolute bottom-32 right-16 animate-float opacity-20" style={{ animationDelay: '2s' }}>
        <Headphones className="w-20 h-20 text-accent" />
      </div>
      <div className="absolute top-40 right-32 animate-float opacity-20" style={{ animationDelay: '4s' }}>
        <Sparkles className="w-12 h-12 text-primary" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 text-center">
        <div className="animate-fade-in">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            Powered by Spotify
          </span>
        </div>

        <h1 
          className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight mb-6 animate-fade-in"
          style={{ animationDelay: '0.1s' }}
        >
          <span className="text-foreground">Your Music</span>
          <br />
          <span className="text-gradient">Your Routine</span>
        </h1>

        <p 
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in"
          style={{ animationDelay: '0.2s' }}
        >
          Track your listening sessions, discover patterns, and build the perfect 
          soundtrack for your daily routine with Spotify integration.
        </p>

        <div 
          className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in"
          style={{ animationDelay: '0.3s' }}
        >
          <Button variant="hero" size="xl" onClick={onGetStarted}>
            Get Started Free
          </Button>
          <Button variant="outline" size="xl">
            Learn More
          </Button>
        </div>

        {/* Stats */}
        <div 
          className="mt-20 grid grid-cols-3 gap-8 max-w-2xl mx-auto animate-fade-in"
          style={{ animationDelay: '0.5s' }}
        >
          {[
            { value: "10K+", label: "Active Users" },
            { value: "1M+", label: "Songs Tracked" },
            { value: "50K+", label: "Sessions Logged" },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-gradient">{stat.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Gradient Fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};

export default Hero;
