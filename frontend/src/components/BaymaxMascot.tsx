import { useState, useEffect } from "react";

interface BaymaxMascotProps {
  size?: number;
  showWave?: boolean;
  showTooltip?: boolean;
  className?: string;
}

const BaymaxMascot = ({ size = 280, showWave = false, showTooltip = true, className = "" }: BaymaxMascotProps) => {
  const [waving, setWaving] = useState(showWave);
  const [hovered, setHovered] = useState(false);
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    if (showWave) {
      setWaving(true);
      const t = setTimeout(() => setWaving(false), 1200);
      return () => clearTimeout(t);
    }
  }, [showWave]);

  const handleHover = () => {
    setHovered(true);
    setBlinking(true);
    setTimeout(() => setBlinking(false), 150);
  };

  const scale = size / 280;

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={handleHover}
      onMouseLeave={() => setHovered(false)}
      style={{ width: size, height: size * 1.1 }}
    >
      {/* Red glow */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(232,39,43,0.12) 0%, transparent 70%)",
          filter: "blur(20px)",
          transform: "scale(1.2)",
        }}
      />

      {/* Tooltip */}
      {hovered && showTooltip && (
        <div
          className="absolute left-1/2 -translate-x-1/2 glass-card rounded-xl px-4 py-2 text-sm font-dm whitespace-nowrap z-10"
          style={{
            top: -10 * scale,
            animation: "staggerFadeIn 0.2s ease-out forwards",
          }}
        >
          Hi! I'm Baymax. How can I help? 😊
        </div>
      )}

      <svg
        viewBox="0 0 200 220"
        width={size}
        height={size * 1.1}
        style={{
          animation: "baymaxFloat 3s ease-in-out infinite",
          filter: "drop-shadow(0 0 40px rgba(232,39,43,0.4))",
        }}
      >
        {/* Body */}
        <ellipse cx="100" cy="145" rx="65" ry="70" fill="white" />
        {/* Head */}
        <circle cx="100" cy="65" r="40" fill="white" />
        {/* Eyes */}
        <g style={{ transform: blinking ? "scaleY(0)" : "scaleY(1)", transformOrigin: "100px 58px", transition: "transform 0.15s" }}>
          <ellipse cx="88" cy="58" rx="4" ry="5" fill="#111" />
          <ellipse cx="112" cy="58" rx="4" ry="5" fill="#111" />
        </g>
        {/* Line between eyes */}
        <line x1="92" y1="58" x2="108" y2="58" stroke="#111" strokeWidth="1.5" />
        {/* Left arm */}
        <ellipse cx="30" cy="140" rx="18" ry="30" fill="white" />
        {/* Right arm */}
        <g style={{
          transformOrigin: "170px 120px",
          animation: waving ? "baymaxWave 0.4s ease-in-out 3" : "none"
        }}>
          <ellipse cx="170" cy="140" rx="18" ry="30" fill="white" />
        </g>
        {/* Legs */}
        <ellipse cx="80" cy="210" rx="16" ry="12" fill="white" />
        <ellipse cx="120" cy="210" rx="16" ry="12" fill="white" />
      </svg>
    </div>
  );
};

export default BaymaxMascot;
