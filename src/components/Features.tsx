import { Music, BarChart3, Clock, Headphones, Zap, Shield } from "lucide-react";

const features = [
  {
    icon: Music,
    title: "Spotify Integration",
    description: "Connect your Spotify account to seamlessly track and manage your listening history.",
    color: "text-accent",
    bgColor: "bg-accent/10",
  },
  {
    icon: BarChart3,
    title: "Listening Analytics",
    description: "Discover patterns in your music habits with detailed insights and visualizations.",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    icon: Clock,
    title: "Session Tracking",
    description: "Log your listening sessions and build a complete picture of your music journey.",
    color: "text-accent",
    bgColor: "bg-accent/10",
  },
  {
    icon: Headphones,
    title: "Smart Playlists",
    description: "Create routine-based playlists that match your daily activities and moods.",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    icon: Zap,
    title: "Real-time Sync",
    description: "Your data syncs instantly across all devices for a seamless experience.",
    color: "text-accent",
    bgColor: "bg-accent/10",
  },
  {
    icon: Shield,
    title: "Privacy First",
    description: "Your music data is encrypted and never shared with third parties.",
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
            <span className="text-gradient">master your music routine</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Powerful tools to track, analyze, and enhance your listening experience.
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
