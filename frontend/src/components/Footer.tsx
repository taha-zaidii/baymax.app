import { Github, Linkedin, Twitter } from "lucide-react";

const Footer = () => {
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <footer className="border-t border-baymax-red pt-16 pb-8" style={{ background: "#080808" }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          <div>
            <div className="flex items-center gap-2 font-syne font-bold text-xl text-foreground mb-3">
              <span className="w-8 h-8 rounded-lg bg-baymax-red flex items-center justify-center text-sm font-bold">B</span>
              Baymax.app
            </div>
            <p className="text-sm text-muted-foreground mb-4">AI-powered career coaching for CS students and graduates in Pakistan.</p>
            <p className="text-sm text-muted-foreground">Made with ❤️ in Pakistan 🇵🇰</p>
          </div>
          <div>
            <h4 className="font-syne font-bold text-sm text-foreground mb-4">Product</h4>
            <ul className="space-y-2">
              {[["how-it-works", "How It Works"], ["features", "Features"], ["pricing", "Pricing"], ["dashboard", "Dashboard"]].map(([id, label]) => (
                <li key={id}><button onClick={() => scrollTo(id)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{label}</button></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-syne font-bold text-sm text-foreground mb-4">Agents</h4>
            <ul className="space-y-2">
              {["Resume Analyzer", "Interview Coach", "Job Scout", "Roadmap Planner"].map((a) => (
                <li key={a}><button onClick={() => scrollTo("dashboard")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{a}</button></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-syne font-bold text-sm text-foreground mb-4">Connect</h4>
            <div className="flex gap-3">
              {[Github, Linkedin, Twitter].map((Icon, i) => (
                <a key={i} href="#" className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-baymax-red transition-all">
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-border pt-6 text-center">
          <p className="text-xs text-muted-foreground">© 2026 Baymax.app — All rights reserved</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
