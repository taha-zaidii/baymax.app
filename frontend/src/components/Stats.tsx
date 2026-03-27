import { useEffect, useRef, useState } from "react";

const stats = [
  { value: "500+", label: "Students Coached" },
  { value: "10,000+", label: "Interview Questions Generated" },
  { value: "94%", label: "Average Job Match Accuracy" },
  { value: "<1s", label: "AI Response Time (Groq)" },
];

const Stats = () => {
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
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
        {stats.map((s, i) => (
          <div
            key={i}
            className="text-center"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(20px)",
              transition: `all 0.5s ease-out ${i * 0.1}s`,
            }}
          >
            <div className="font-syne font-extrabold text-3xl md:text-5xl text-baymax-red mb-2">{visible ? s.value : "0"}</div>
            <p className="text-sm text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Stats;
