import BaymaxMascot from "./BaymaxMascot";

const particles = Array.from({ length: 15 }, (_, i) => ({
  id: i,
  left: Math.random() * 100,
  delay: Math.random() * 5,
  duration: 4 + Math.random() * 4,
}));

const floatingCards = [
  { text: "📄 Resume Score: 94/100", top: "10%", left: "5%", rotate: "-6deg", delay: "0s" },
  { text: "🎤 Interview Ready", top: "55%", left: "-10%", rotate: "4deg", delay: "0.5s" },
  { text: "✅ 12 Jobs Matched", top: "70%", left: "60%", rotate: "-3deg", delay: "1s" },
];

const HeroSection = () => {
  return (
    <section id="hero" className="hero-mesh min-h-screen relative overflow-hidden flex items-center">
      <div className="max-w-7xl mx-auto px-6 pt-24 pb-16 grid md:grid-cols-2 gap-12 items-center w-full">
        {/* Left */}
        <div className="space-y-6">
          <span
            className="inline-block bg-baymax-red/20 text-baymax-red text-xs font-mono-label px-3 py-1.5 rounded-full border border-baymax-red/30"
            style={{ animation: "staggerFadeIn 0.5s ease-out 0.1s both" }}
          >
            🤖 Powered by Groq + CrewAI
          </span>

          <h1
            className="font-syne font-extrabold text-4xl md:text-[68px] md:leading-[1.05] text-foreground"
            style={{ animation: "staggerFadeIn 0.5s ease-out 0.2s both" }}
          >
            Your AI Career Team, On Demand.
          </h1>

          <p
            className="text-muted-foreground text-lg max-w-[480px]"
            style={{ animation: "staggerFadeIn 0.5s ease-out 0.35s both" }}
          >
            Upload your resume. Ace your interviews. Find real jobs. Get a 90-day roadmap. All in one place — built for Pakistan's next generation of tech talent.
          </p>

          <div
            className="flex flex-wrap gap-3"
            style={{ animation: "staggerFadeIn 0.5s ease-out 0.5s both" }}
          >
            <button
              onClick={() => document.getElementById("dashboard")?.scrollIntoView({ behavior: "smooth" })}
              className="bg-baymax-red text-foreground font-syne font-bold px-7 py-3 rounded-lg btn-red-glow transition-all text-base"
            >
              Start for Free →
            </button>
            <button
              onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
              className="border border-foreground/20 text-foreground font-syne font-bold px-7 py-3 rounded-lg hover:border-baymax-red transition-all text-base"
            >
              See How It Works
            </button>
          </div>

          {/* Trust bar */}
          <div className="flex items-center gap-3 pt-2" style={{ animation: "staggerFadeIn 0.5s ease-out 0.65s both" }}>
            <div className="flex -space-x-2">
              {["#E8272B", "#FF6B6B", "#C41E22", "#FF4444", "#A01820"].map((c, i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-background" style={{ background: c }} />
              ))}
            </div>
            <span className="text-sm text-muted-foreground">500+ students coached</span>
          </div>
        </div>

        {/* Right */}
        <div className="relative flex items-center justify-center" style={{ animation: "staggerFadeIn 0.5s ease-out 0.3s both" }}>
          {/* Floating cards */}
          {floatingCards.map((card, i) => (
            <div
              key={i}
              className="absolute glass-card rounded-xl px-4 py-2 text-sm font-dm whitespace-nowrap z-10 pointer-events-none"
              style={{
                top: card.top,
                left: card.left,
                transform: `rotate(${card.rotate})`,
                animation: `baymaxFloat 3s ease-in-out ${card.delay} infinite`,
              }}
            >
              {card.text}
            </div>
          ))}

          <BaymaxMascot size={280} showWave={true} />

          {/* Particles */}
          {particles.map((p) => (
            <div
              key={p.id}
              className="absolute w-1 h-1 rounded-full bg-baymax-red/60"
              style={{
                left: `${p.left}%`,
                bottom: "10%",
                animation: `particleFloat ${p.duration}s ease-in-out ${p.delay}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
