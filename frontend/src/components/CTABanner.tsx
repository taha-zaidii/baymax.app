const CTABanner = () => {
  return (
    <section className="py-24 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #1a0506, #080808)" }}>
      <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
        <h2 className="font-syne font-extrabold text-3xl md:text-5xl text-foreground mb-4">Ready to land your dream job?</h2>
        <p className="text-muted-foreground text-lg mb-8">Start free. No credit card. Built for Pakistan.</p>
        <button
          onClick={() => document.getElementById("dashboard")?.scrollIntoView({ behavior: "smooth" })}
          className="bg-foreground text-baymax-red font-syne font-bold px-10 py-4 rounded-lg text-lg hover:scale-105 transition-transform"
        >
          Start with Baymax →
        </button>
      </div>
      {/* Peeking Baymax */}
      <div className="absolute bottom-0 right-8 md:right-16 opacity-40">
        <svg viewBox="0 0 200 120" width="160" height="100">
          <circle cx="100" cy="40" r="40" fill="white" />
          <ellipse cx="88" cy="33" rx="4" ry="5" fill="#111" />
          <ellipse cx="112" cy="33" rx="4" ry="5" fill="#111" />
          <line x1="92" y1="33" x2="108" y2="33" stroke="#111" strokeWidth="1.5" />
          <ellipse cx="30" cy="90" rx="18" ry="25" fill="white" />
          <ellipse cx="170" cy="90" rx="18" ry="25" fill="white" />
          <ellipse cx="100" cy="100" rx="65" ry="40" fill="white" />
        </svg>
      </div>
    </section>
  );
};

export default CTABanner;
