import { Brain, BarChart3, Activity, Headphones, Zap, Shield } from "lucide-react";

const features = [
  {
    icon: Activity,
    title: "Live Biometric Tracking",
    description: "Connect heart rate monitors, EEG headbands, and wearables to feed real-time data into your music engine.",
    color: "text-accent",
    bgColor: "bg-accent/10",
  },
  {
    icon: Brain,
    title: "Adaptive AI Engine",
    description: "Our AI analyzes your brainwaves, stress, and focus to dynamically adjust tempo, energy, and genre in real-time.",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    icon: BarChart3,
    title: "Flow State Analytics",
    description: "Visualize how music shifts your biometrics over time with interactive timelines and correlation charts.",
    color: "text-accent",
    bgColor: "bg-accent/10",
  },
  {
    icon: Headphones,
    title: "Spotify & Jamendo Integration",
    description: "Auto-queue the perfect tracks from Spotify or free Jamendo libraries based on your body's signals.",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    icon: Zap,
    title: "Real-time Adaptation",
    description: "Watch your playlist morph live as your heart rate climbs during a workout or your focus deepens in a study session.",
    color: "text-accent",
    bgColor: "bg-accent/10",
  },
  {
    icon: Shield,
    title: "Privacy First",
    description: "Your biometric and listening data is encrypted end-to-end and never shared with third parties.",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
];

const Features = () => {
  return (
    <section id="features" className="py-24 bg-secondary/30">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <span className="text-primary font-semibold text-sm uppercase tracking-wider">Features</span>
          <h2 className="text-4xl md:text-5xl font-bold mt-4 mb-6">
            Everything you need to
            <br />
            <span className="text-gradient">unlock your flow state</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Biometric sensors meet adaptive AI — your body drives the soundtrack.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group p-6 rounded-2xl bg-card border border-border/50 shadow-card hover:shadow-lg hover:border-primary/20 transition-all duration-300 hover:-translate-y-1"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className={`w-14 h-14 rounded-xl ${feature.bgColor} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                <feature.icon className={`w-7 h-7 ${feature.color}`} />
              </div>
              <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
