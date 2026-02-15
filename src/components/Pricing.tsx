import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PricingProps {
  onGetStarted: () => void;
}

const tiers = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Get started with biometric-driven music",
    features: [
      { text: "3 sessions per week", included: true },
      { text: "Basic biometric tracking", included: true },
      { text: "Jamendo music library", included: true },
      { text: "Session history (7 days)", included: true },
      { text: "Weekly insights", included: false },
      { text: "AI adaptive engine", included: false },
      { text: "EEG brainwave support", included: false },
      { text: "Priority support", included: false },
    ],
    cta: "Start Free",
    highlighted: false,
  },
  {
    name: "Premium",
    price: "$9",
    period: "/month",
    description: "Unlock the full BioMusic experience",
    features: [
      { text: "Unlimited sessions", included: true },
      { text: "Advanced biometric analytics", included: true },
      { text: "All music sources", included: true },
      { text: "Unlimited session history", included: true },
      { text: "Weekly & monthly insights", included: true },
      { text: "AI adaptive engine", included: true },
      { text: "EEG brainwave support", included: true },
      { text: "Priority support", included: true },
    ],
    cta: "Go Premium",
    highlighted: true,
  },
];

const Pricing = ({ onGetStarted }: PricingProps) => {
  return (
    <section className="py-24 px-4 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent pointer-events-none" />
      <div className="max-w-5xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <span className="text-primary font-semibold text-sm uppercase tracking-widest">
            Pricing
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mt-3">
            Choose Your Flow
          </h2>
          <p className="text-muted-foreground mt-4 max-w-lg mx-auto">
            Start free and upgrade when you're ready to unlock the full
            biometric-music pipeline.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-2xl p-8 flex flex-col transition-all duration-300 ${
                tier.highlighted
                  ? "bg-card border-2 border-primary shadow-glow scale-[1.02]"
                  : "bg-card border border-border"
              }`}
            >
              {tier.highlighted && (
                <span className="gradient-primary text-primary-foreground text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full self-start mb-4">
                  Most Popular
                </span>
              )}
              <h3 className="text-2xl font-bold text-foreground">
                {tier.name}
              </h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-foreground">
                  {tier.price}
                </span>
                <span className="text-muted-foreground text-sm">
                  {tier.period}
                </span>
              </div>
              <p className="text-muted-foreground text-sm mt-2">
                {tier.description}
              </p>

              <ul className="mt-8 space-y-3 flex-1">
                {tier.features.map((feature) => (
                  <li key={feature.text} className="flex items-center gap-3">
                    {feature.included ? (
                      <Check className="h-4 w-4 text-accent shrink-0" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    )}
                    <span
                      className={
                        feature.included
                          ? "text-foreground text-sm"
                          : "text-muted-foreground/50 text-sm"
                      }
                    >
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={onGetStarted}
                className={`mt-8 w-full ${
                  tier.highlighted
                    ? "gradient-primary text-primary-foreground hover:opacity-90"
                    : ""
                }`}
                variant={tier.highlighted ? "default" : "outline"}
                size="lg"
              >
                {tier.cta}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
