import { useState } from "react";

const FloatingBaymax = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <div className="glass-card rounded-xl p-4 mb-3 w-64 text-sm" style={{ transform: "none", animation: "staggerFadeIn 0.2s ease-out" }}>
          <p className="text-foreground font-bold mb-2 font-syne">Quick Help</p>
          <ul className="space-y-2 text-muted-foreground">
            <li className="hover:text-foreground cursor-pointer transition-colors" onClick={() => { document.getElementById("dashboard")?.scrollIntoView({ behavior: "smooth" }); setOpen(false); }}>📄 Analyze my resume</li>
            <li className="hover:text-foreground cursor-pointer transition-colors" onClick={() => { document.getElementById("dashboard")?.scrollIntoView({ behavior: "smooth" }); setOpen(false); }}>🎤 Practice interviews</li>
            <li className="hover:text-foreground cursor-pointer transition-colors" onClick={() => { document.getElementById("dashboard")?.scrollIntoView({ behavior: "smooth" }); setOpen(false); }}>🔍 Find jobs</li>
            <li className="hover:text-foreground cursor-pointer transition-colors" onClick={() => { document.getElementById("dashboard")?.scrollIntoView({ behavior: "smooth" }); setOpen(false); }}>🗺️ View roadmap</li>
          </ul>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="w-14 h-14 rounded-full bg-foreground flex items-center justify-center shadow-lg relative btn-red-glow transition-all hover:scale-110"
        style={{ filter: "drop-shadow(0 0 20px rgba(232,39,43,0.4))" }}
      >
        {/* Pulse ring */}
        <span className="absolute inset-0 rounded-full border-2 border-baymax-red" style={{ animation: "pulseRing 4s ease-out infinite" }} />
        <svg viewBox="0 0 200 220" width="28" height="30">
          <ellipse cx="100" cy="145" rx="65" ry="70" fill="#111" />
          <circle cx="100" cy="65" r="40" fill="#111" />
          <ellipse cx="88" cy="58" rx="4" ry="5" fill="white" />
          <ellipse cx="112" cy="58" rx="4" ry="5" fill="white" />
          <line x1="92" y1="58" x2="108" y2="58" stroke="white" strokeWidth="1.5" />
        </svg>
      </button>
    </div>
  );
};

export default FloatingBaymax;
