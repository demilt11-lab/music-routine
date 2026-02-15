import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Star,
  Download,
  Heart,
  Activity,
  Brain,
  Music,
  Smartphone,
  Shield,
  Zap,
  ArrowRight,
  ChevronLeft,
} from "lucide-react";
import { motion } from "framer-motion";

const screenshots = [
  {
    title: "Biometric Dashboard",
    description: "Real-time heart rate, EEG, and stress monitoring",
    gradient: "from-primary/20 to-accent/10",
    icon: Activity,
  },
  {
    title: "Adaptive Sessions",
    description: "Music that adapts to your biometric state",
    gradient: "from-accent/20 to-primary/10",
    icon: Music,
  },
  {
    title: "Flow Analytics",
    description: "Weekly and monthly insights into your flow patterns",
    gradient: "from-primary/15 to-primary/5",
    icon: Brain,
  },
];

const features = [
  {
    icon: Activity,
    title: "Biometric Tracking",
    desc: "Heart rate, HRV, stress level, and EEG brainwave monitoring via Bluetooth devices.",
  },
  {
    icon: Music,
    title: "Adaptive Music Engine",
    desc: "AI-powered music selection that adjusts tempo, energy, and genre to your biometric state.",
  },
  {
    icon: Brain,
    title: "EEG Brainwave Support",
    desc: "Connect Muse headbands for alpha, beta, theta, delta, and gamma wave tracking.",
  },
  {
    icon: Zap,
    title: "Flow State Detection",
    desc: "Automatic detection of peak performance zones with real-time haptic feedback.",
  },
  {
    icon: Shield,
    title: "Private & Secure",
    desc: "Your biometric data is encrypted end-to-end. We never share it with third parties.",
  },
  {
    icon: Smartphone,
    title: "Cross-Platform",
    desc: "Available on iOS, Android, and the web. Your data syncs across all devices.",
  },
];

const reviews = [
  {
    name: "Sarah K.",
    rating: 5,
    text: "Transformed my yoga practice. The adaptive playlists are incredible.",
  },
  {
    name: "Marcus T.",
    rating: 5,
    text: "My deep work sessions are 2x longer now. Best focus tool I've ever used.",
  },
  {
    name: "Aisha R.",
    rating: 5,
    text: "The EEG integration is mind-blowing. Game changer for race training.",
  },
];

const AppListing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="text-sm">Back</span>
          </button>
          <span className="text-sm font-medium text-foreground">
            App Store
          </span>
          <div className="w-12" />
        </div>
      </header>

      {/* Hero */}
      <section className="px-4 pt-8 pb-12">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-start gap-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-24 h-24 md:w-32 md:h-32 rounded-[28px] overflow-hidden shadow-glow shrink-0"
            >
              <img
                src="/app-icon.png"
                alt="BioMusic App Icon"
                className="w-full h-full object-cover"
              />
            </motion.div>

            <div className="flex-1">
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-3xl md:text-4xl font-bold text-foreground"
              >
                BioMusic
              </motion.h1>
              <p className="text-muted-foreground mt-1">
                Biometric-Driven Music for Peak Flow
              </p>

              <div className="flex items-center gap-3 mt-3">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4 fill-primary text-primary"
                    />
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">
                  4.9 · 2.4K Ratings
                </span>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                <Badge variant="secondary">Health & Fitness</Badge>
                <Badge variant="secondary">Music</Badge>
                <Badge variant="secondary">Productivity</Badge>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <Button
                  size="lg"
                  className="gradient-primary text-primary-foreground gap-2"
                  onClick={() =>
                    window.open(
                      "https://apps.apple.com",
                      "_blank"
                    )
                  }
                >
                  <Download className="h-4 w-4" />
                  Download for iOS
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2"
                  onClick={() =>
                    window.open(
                      "https://play.google.com",
                      "_blank"
                    )
                  }
                >
                  <Download className="h-4 w-4" />
                  Get on Android
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Free to download · In-app purchases available
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Screenshots */}
      <section className="px-4 pb-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-bold text-foreground mb-6">
            Screenshots
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {screenshots.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`rounded-2xl bg-gradient-to-br ${s.gradient} border border-border p-6 aspect-[9/16] flex flex-col items-center justify-center text-center gap-4`}
              >
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                  <s.icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-foreground">
                  {s.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {s.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 pb-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-bold text-foreground mb-6">
            What's Inside
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="bg-card border border-border rounded-xl p-5 flex gap-4"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {f.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {f.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section className="px-4 pb-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-bold text-foreground mb-6">
            Ratings & Reviews
          </h2>
          <div className="flex items-center gap-6 mb-8">
            <div className="text-center">
              <p className="text-5xl font-bold text-foreground">4.9</p>
              <p className="text-xs text-muted-foreground mt-1">
                out of 5
              </p>
            </div>
            <div className="flex-1 space-y-1">
              {[5, 4, 3, 2, 1].map((stars) => (
                <div key={stars} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-3">
                    {stars}
                  </span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{
                        width:
                          stars === 5
                            ? "88%"
                            : stars === 4
                            ? "9%"
                            : stars === 3
                            ? "2%"
                            : "1%",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {reviews.map((r) => (
              <div
                key={r.name}
                className="bg-card border border-border rounded-xl p-5"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">
                    {r.name}
                  </span>
                  <div className="flex gap-0.5">
                    {[...Array(r.rating)].map((_, i) => (
                      <Star
                        key={i}
                        className="h-3 w-3 fill-primary text-primary"
                      />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{r.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-24">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-card border border-primary/30 rounded-2xl p-8 text-center"
          >
            <Heart className="h-8 w-8 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Ready to Find Your Flow?
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Download BioMusic and let your body lead the soundtrack.
            </p>
            <Button
              size="lg"
              className="gradient-primary text-primary-foreground gap-2"
              onClick={() => navigate("/auth")}
            >
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Button>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default AppListing;
