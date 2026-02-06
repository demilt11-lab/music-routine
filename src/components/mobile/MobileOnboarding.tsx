import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useNativeHaptics } from "@/hooks/useNativeHaptics";
import { 
  Music, 
  Brain, 
  Zap, 
  BarChart3, 
  ChevronRight, 
  ChevronLeft 
} from "lucide-react";

interface OnboardingSlide {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
}

const slides: OnboardingSlide[] = [
  {
    icon: <Music className="w-16 h-16" />,
    title: "Your Music Journey",
    description: "Connect your music and build the perfect soundtrack for every moment of your day.",
    gradient: "from-primary/20 to-accent/20",
  },
  {
    icon: <Brain className="w-16 h-16" />,
    title: "Biometric Insights",
    description: "Track your focus, stress levels, and mood with optional EEG and heart rate monitoring.",
    gradient: "from-accent/20 to-primary/20",
  },
  {
    icon: <Zap className="w-16 h-16" />,
    title: "Flow State Tracking",
    description: "Get real-time notifications when you enter flow states and optimize your productivity.",
    gradient: "from-primary/30 to-accent/10",
  },
  {
    icon: <BarChart3 className="w-16 h-16" />,
    title: "Weekly Analytics",
    description: "View detailed insights about your listening habits and how music affects your performance.",
    gradient: "from-accent/30 to-primary/10",
  },
];

interface MobileOnboardingProps {
  onComplete: () => void;
}

export function MobileOnboarding({ onComplete }: MobileOnboardingProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const { triggerHaptic } = useNativeHaptics();

  const progress = ((currentSlide + 1) / slides.length) * 100;

  const goToNextSlide = useCallback(() => {
    if (currentSlide < slides.length - 1) {
      triggerHaptic("light");
      setCurrentSlide((prev) => prev + 1);
    }
  }, [currentSlide, triggerHaptic]);

  const goToPrevSlide = useCallback(() => {
    if (currentSlide > 0) {
      triggerHaptic("light");
      setCurrentSlide((prev) => prev - 1);
    }
  }, [currentSlide, triggerHaptic]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;

    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        goToNextSlide();
      } else {
        goToPrevSlide();
      }
    }

    setTouchStart(null);
  };

  const handleComplete = () => {
    triggerHaptic("success");
    localStorage.setItem("onboarding_completed", "true");
    onComplete();
  };

  const handleSkip = () => {
    triggerHaptic("light");
    localStorage.setItem("onboarding_completed", "true");
    onComplete();
  };

  const isLastSlide = currentSlide === slides.length - 1;
  const slide = slides[currentSlide];

  return (
    <div 
      className="fixed inset-0 z-50 bg-background flex flex-col safe-area-top safe-area-bottom"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Skip button */}
      <div className="flex justify-end p-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleSkip}
          className="text-muted-foreground"
        >
          Skip
        </Button>
      </div>

      {/* Progress bar */}
      <div className="px-6 mb-8">
        <Progress value={progress} className="h-1" />
      </div>

      {/* Slide content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div 
          className={`w-32 h-32 rounded-full bg-gradient-to-br ${slide.gradient} flex items-center justify-center mb-8 text-primary animate-fade-in`}
          key={`icon-${currentSlide}`}
        >
          {slide.icon}
        </div>

        <h2 
          className="text-3xl font-bold text-center mb-4 animate-fade-in"
          key={`title-${currentSlide}`}
        >
          <span className="text-gradient">{slide.title}</span>
        </h2>

        <p 
          className="text-muted-foreground text-center text-lg max-w-xs animate-fade-in"
          key={`desc-${currentSlide}`}
        >
          {slide.description}
        </p>
      </div>

      {/* Dots indicator */}
      <div className="flex justify-center gap-2 mb-8">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => {
              triggerHaptic("light");
              setCurrentSlide(index);
            }}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              index === currentSlide 
                ? "bg-primary w-6" 
                : "bg-muted-foreground/30"
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      {/* Navigation buttons */}
      <div className="px-6 pb-8 flex gap-4">
        {currentSlide > 0 && (
          <Button
            variant="outline"
            size="lg"
            onClick={goToPrevSlide}
            className="flex-1"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        )}
        
        {isLastSlide ? (
          <Button
            variant="hero"
            size="lg"
            onClick={handleComplete}
            className="flex-1"
          >
            Get Started
          </Button>
        ) : (
          <Button
            variant="hero"
            size="lg"
            onClick={goToNextSlide}
            className="flex-1"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
