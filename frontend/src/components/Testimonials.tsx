import { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";

const testimonials = [
  {
    text: "Baymax helped me land my first internship at Arbisoft. The mock interview coach was insane.",
    name: "Ali Hassan",
    school: "FAST NUCES Karachi, CS 2025",
    initials: "AH",
    color: "#E8272B",
  },
  {
    text: "I went from a 52 resume score to 91 in one session. The skills gap report was eye-opening.",
    name: "Fatima Malik",
    school: "NUST Islamabad, Software Engineering",
    initials: "FM",
    color: "#FF6B35",
  },
  {
    text: "Found a remote job at a US startup through Job Scout. Never thought it was possible.",
    name: "Usman Tariq",
    school: "IBA Karachi, Computer Science",
    initials: "UT",
    color: "#4285F4",
  },
];

const Testimonials = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.2 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="py-24" ref={ref}>
      <div className="red-divider mb-24" />
      <div className="max-w-6xl mx-auto px-6 text-center">
        <h2 className="font-syne font-extrabold text-3xl md:text-5xl text-foreground mb-16">What Students Are Saying</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="glass-card rounded-xl p-6 text-left"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(20px)",
                transition: `all 0.5s ease-out ${i * 0.1}s`,
              }}
            >
              <div className="flex gap-1 mb-4">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} size={14} className="text-amber-400 fill-amber-400" />
                ))}
              </div>
              <p className="text-sm text-foreground mb-6">"{t.text}"</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-foreground" style={{ background: t.color }}>
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm text-foreground font-bold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.school}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
