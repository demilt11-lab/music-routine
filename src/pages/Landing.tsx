import { Link } from "react-router-dom";
import { Activity, Brain, HeartPulse, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/app/auth";

const FEATURES = [
  { icon: HeartPulse, title: "Reads your body", body: "Heart rate, HRV and stress stream in from your watch or band in real time." },
  { icon: Brain, title: "Finds your flow", body: "An adaptive engine maps your physiology to the music that pulls you into focus." },
  { icon: Sparkles, title: "Learns your taste", body: "Every thumbs up tunes future recommendations to what actually works for you." },
];

export default function Landing() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold">BioMusic</span>
        </div>
        <Button asChild variant="ghost">
          <Link to={user ? "/dashboard" : "/auth"}>{user ? "Open app" : "Sign in"}</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        <section className="py-20 text-center md:py-28">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
            Music that adapts to your body, in real time.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            BioMusic reads your heart rate, brainwaves and stress to steer your soundtrack toward your optimal
            flow state — for workouts, focus, sleep and more.
          </p>
          <div className="mt-10 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link to={user ? "/dashboard" : "/auth"}>Start a session</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-6 pb-24 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border/60 bg-card p-6">
              <Icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
