import { Heart, Brain, Music, Sparkles, ArrowRight } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Heart,
    title: "Connect Your Body",
    description:
      "Pair a heart rate monitor, Muse EEG headband, or any Bluetooth wearable. BioMusic reads your pulse, brainwaves, and stress signals in real-time.",
    accent: "from-primary/20 to-primary/10",
    iconColor: "text-primary",
    borderColor: "border-primary/30",
  },
  {
    number: "02",
    icon: Brain,
    title: "AI Analyzes Your State",
    description:
      "Every 30 seconds, our adaptive engine evaluates your focus, relaxation, and stress levels to understand exactly what your body needs.",
    accent: "from-accent/20 to-accent/10",
    iconColor: "text-accent",
    borderColor: "border-accent/30",
  },
  {
    number: "03",
    icon: Music,
    title: "Music Adapts Instantly",
    description:
      "Tempo, energy, and genre shift automatically. Stressed? Calming ambient fades in. In the zone? The beat intensifies to keep you there.",
    accent: "from-primary/20 to-primary/10",
    iconColor: "text-primary",
    borderColor: "border-primary/30",
  },
  {
    number: "04",
    icon: Sparkles,
    title: "Reach Flow State",
    description:
      "Over time, BioMusic learns your unique patterns — which tracks trigger focus, which calm anxiety — creating a truly personalized soundtrack for life.",
    accent: "from-accent/20 to-accent/10",
    iconColor: "text-accent",
    borderColor: "border-accent/30",
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-24 relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <span className="text-primary font-semibold text-sm uppercase tracking-wider">
            How It Works
          </span>
          <h2 className="text-4xl md:text-5xl font-bold mt-4 mb-6">
            From heartbeat to
            <br />
            <span className="text-gradient">perfect soundtrack</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Four steps. Zero effort. Your body drives the music.
          </p>
        </div>

        {/* Steps */}
        <div className="max-w-4xl mx-auto">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="absolute left-8 top-[5.5rem] bottom-0 w-px bg-gradient-to-b from-border to-transparent hidden md:block" />
              )}

              <div
                className="flex gap-6 md:gap-8 items-start mb-12 group animate-fade-in"
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                {/* Step number + icon */}
                <div className="shrink-0 relative">
                  <div
                    className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.accent} border ${step.borderColor} flex items-center justify-center transition-transform group-hover:scale-110 group-hover:-rotate-3`}
                  >
                    <step.icon className={`w-7 h-7 ${step.iconColor}`} />
                  </div>
                  <span className="absolute -top-2 -right-2 text-[10px] font-bold bg-card border border-border rounded-full w-6 h-6 flex items-center justify-center text-muted-foreground">
                    {step.number}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 pt-1">
                  <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed max-w-lg">
                    {step.description}
                  </p>
                </div>

                {/* Arrow on hover */}
                <div className="hidden md:flex items-center pt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="w-5 h-5 text-primary" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA callout */}
        <div className="text-center mt-8">
          <div className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary font-medium">
            <Sparkles className="w-4 h-4" />
            No manual playlists. No guessing. Just flow.
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
