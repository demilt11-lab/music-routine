import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion } from "framer-motion";

const testimonials = [
  {
    name: "Sarah K.",
    role: "Yoga Instructor",
    avatar: "",
    initials: "SK",
    quote:
      "BioMusic transformed my practice sessions. The adaptive playlists sync perfectly with my heart rate during flows — it's like having a DJ who reads my body.",
  },
  {
    name: "Marcus T.",
    role: "Software Engineer",
    avatar: "",
    initials: "MT",
    quote:
      "I've tried every focus playlist out there. Nothing compares to BioMusic's biometric-driven approach. My deep work sessions are 2x longer now.",
  },
  {
    name: "Aisha R.",
    role: "Marathon Runner",
    avatar: "",
    initials: "AR",
    quote:
      "The EEG integration is mind-blowing. BioMusic detects when I'm hitting the wall and shifts the tempo to push me through. Game changer for race training.",
  },
];

const Testimonials = () => {
  return (
    <section className="py-24 px-4 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent/5 to-transparent pointer-events-none" />
      <div className="max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <span className="text-primary font-semibold text-sm uppercase tracking-widest">
            Testimonials
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mt-3">
            Loved by Flow-Seekers
          </h2>
          <p className="text-muted-foreground mt-4 max-w-lg mx-auto">
            Hear from people who've unlocked their peak performance with
            biometric-driven music.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.15, ease: "easeOut" }}
              className="bg-card border border-border rounded-2xl p-8 flex flex-col gap-6 transition-all duration-300 hover:border-primary/40 hover:shadow-glow"
            >
              <p className="text-muted-foreground text-sm leading-relaxed flex-1 italic">
                "{t.quote}"
              </p>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  {t.avatar && <AvatarImage src={t.avatar} alt={t.name} />}
                  <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                    {t.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-foreground text-sm font-semibold">{t.name}</p>
                  <p className="text-muted-foreground text-xs">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
