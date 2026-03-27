import { useEffect, useRef, useState } from "react";

const steps = [
  { num: 1, title: "Upload Resume", desc: "Drop your PDF resume and set your target role." },
  { num: 2, title: "Run All 4 Agents", desc: "AI analyzes, coaches, scouts, and plans for you." },
  { num: 3, title: "Practice & Discover", desc: "Mock interviews, real jobs, and skills insights." },
  { num: 4, title: "Get Your Report", desc: "Download your complete career action plan." },
];

const HowItWorks = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.2 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="how-it-works" className="py-24 relative" ref={ref}>
      <div className="red-divider mb-24" />
      <div className="max-w-6xl mx-auto px-6 text-center">
        <h2 className="font-syne font-extrabold text-3xl md:text-5xl text-foreground mb-3">Simple. Powerful. Done in Minutes.</h2>
        <p className="text-muted-foreground text-lg mb-16">Four AI agents. One seamless workflow.</p>

        <div className="relative">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-10 left-[12.5%] right-[12.5%] h-0.5">
            <svg width="100%" height="2" className="overflow-visible">
              <line
                x1="0" y1="1" x2="100%" y2="1"
                stroke="#E8272B"
                strokeWidth="2"
                strokeDasharray="8 6"
                style={{
                  strokeDashoffset: visible ? 0 : 600,
                  transition: "stroke-dashoffset 1.5s ease-out",
                }}
              />
            </svg>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {steps.map((s, i) => (
              <div
                key={s.num}
                className="text-center"
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? "translateY(0)" : "translateY(20px)",
                  transition: `all 0.5s ease-out ${i * 0.15}s`,
                }}
              >
                <div className="w-12 h-12 rounded-full bg-baymax-red text-foreground font-syne font-bold text-lg flex items-center justify-center mx-auto mb-4">
                  {s.num}
                </div>
                <h3 className="font-syne font-bold text-lg text-foreground mb-2">{s.title}</h3>
                <p className="text-muted-foreground text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
