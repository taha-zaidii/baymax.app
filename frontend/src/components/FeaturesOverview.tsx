import { useEffect, useRef, useState } from "react";
import { FileText, Mic, Search, Map } from "lucide-react";

const features = [
  { icon: FileText, title: "Resume Analyzer", desc: "AI-powered resume scoring, ATS optimization, skills gap analysis, and bullet point rewriting." },
  { icon: Mic, title: "Interview Coach", desc: "10-question mock interviews with real-time scoring, strengths analysis, and improvement tips." },
  { icon: Search, title: "Job Scout", desc: "Smart job matching across Pakistan's top companies with salary insights and skills fit analysis." },
  { icon: Map, title: "Roadmap Planner", desc: "90-day personalized career roadmap with task tracking, resources, and milestone checkpoints." },
];

const FeaturesOverview = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.2 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="features" className="py-24 relative" ref={ref}>
      <div className="red-divider mb-24" />
      {/* Dot grid background */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
      <div className="max-w-6xl mx-auto px-6 relative z-10 text-center">
        <h2 className="font-syne font-extrabold text-3xl md:text-5xl text-foreground mb-3">Meet Your AI Career Team</h2>
        <p className="text-muted-foreground text-lg mb-16">Four specialized agents. One unified goal.</p>
        <div className="grid md:grid-cols-2 gap-6">
          {features.map((f, i) => (
            <div
              key={i}
              className="glass-card rounded-xl p-8 text-left"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(20px)",
                transition: `all 0.5s ease-out ${i * 0.1}s`,
              }}
            >
              <f.icon className="text-baymax-red mb-4" size={28} />
              <h3 className="font-syne font-bold text-lg text-foreground mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesOverview;
