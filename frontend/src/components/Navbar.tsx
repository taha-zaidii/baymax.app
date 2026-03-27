import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 100);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "backdrop-blur-[20px] border-b border-baymax-red"
          : "border-b border-transparent"
      }`}
      style={{ background: scrolled ? "rgba(8,8,8,0.85)" : "transparent" }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <button onClick={() => scrollTo("hero")} className="flex items-center gap-2 font-syne font-bold text-xl text-foreground">
          <span className="w-8 h-8 rounded-lg bg-baymax-red flex items-center justify-center text-sm font-bold">B</span>
          Baymax.app
        </button>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {[
            ["how-it-works", "How It Works"],
            ["features", "Agents"],
            ["pricing", "Pricing"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {label}
            </button>
          ))}
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sign In</button>
          <button
            onClick={() => scrollTo("dashboard")}
            className="bg-baymax-red text-foreground font-syne font-bold text-sm px-5 py-2 rounded-lg btn-red-glow transition-all"
          >
            Get Started
          </button>
        </div>

        {/* Mobile menu toggle */}
        <button className="md:hidden text-foreground" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-border px-6 py-4 space-y-3" style={{ background: "rgba(8,8,8,0.95)" }}>
          {[["how-it-works", "How It Works"], ["features", "Agents"], ["pricing", "Pricing"]].map(([id, label]) => (
            <button key={id} onClick={() => scrollTo(id)} className="block text-sm text-muted-foreground">
              {label}
            </button>
          ))}
          <button onClick={() => scrollTo("dashboard")} className="bg-baymax-red text-foreground font-syne font-bold text-sm px-5 py-2 rounded-lg w-full">
            Get Started
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
