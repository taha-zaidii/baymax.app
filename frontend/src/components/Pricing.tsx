import { Check, X } from "lucide-react";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "",
    features: [
      { text: "Resume scan (1x)", included: true },
      { text: "3 interview questions", included: true },
      { text: "5 job matches", included: true },
      { text: "Basic roadmap", included: true },
      { text: "PDF report", included: false },
      { text: "Email delivery", included: false },
      { text: "Priority AI", included: false },
    ],
    popular: false,
    cta: "Start Free",
  },
  {
    name: "Pro",
    price: "$9",
    period: "/mo",
    features: [
      { text: "Unlimited resume scans", included: true },
      { text: "Unlimited interview Qs", included: true },
      { text: "Unlimited job matches", included: true },
      { text: "Full career roadmap", included: true },
      { text: "PDF report", included: true },
      { text: "Email delivery", included: true },
      { text: "Priority AI (Groq)", included: true },
    ],
    popular: true,
    cta: "Get Pro",
  },
  {
    name: "Team",
    price: "$29",
    period: "/mo",
    features: [
      { text: "5 team seats", included: true },
      { text: "University/bootcamp use", included: true },
      { text: "Analytics dashboard", included: true },
      { text: "Full career roadmap", included: true },
      { text: "PDF report", included: true },
      { text: "Email delivery", included: true },
      { text: "Priority AI (Groq)", included: true },
    ],
    popular: false,
    cta: "Contact Us",
  },
];

const Pricing = () => {
  return (
    <section id="pricing" className="py-24">
      <div className="red-divider mb-24" />
      <div className="max-w-5xl mx-auto px-6 text-center">
        <h2 className="font-syne font-extrabold text-3xl md:text-5xl text-foreground mb-3">Simple, Transparent Pricing</h2>
        <p className="text-muted-foreground text-lg mb-16">Start free. Upgrade when you're ready.</p>
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan, i) => (
            <div
              key={i}
              className={`glass-card rounded-xl p-6 text-left relative ${plan.popular ? "ring-1 ring-baymax-red shadow-[0_0_20px_rgba(232,39,43,0.2)]" : ""}`}
              style={{ transform: "none" }}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-baymax-red text-foreground text-xs font-bold px-3 py-1 rounded-full">
                  Most Popular
                </span>
              )}
              <h3 className="font-syne font-bold text-lg text-foreground">{plan.name}</h3>
              <div className="mt-4 mb-6">
                <span className="font-syne font-extrabold text-4xl text-foreground">{plan.price}</span>
                <span className="text-muted-foreground text-sm">{plan.period}</span>
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-center gap-2 text-sm">
                    {f.included ? (
                      <Check size={14} className="text-green-400 shrink-0" />
                    ) : (
                      <X size={14} className="text-muted-foreground shrink-0" />
                    )}
                    <span className={f.included ? "text-foreground" : "text-muted-foreground"}>{f.text}</span>
                  </li>
                ))}
              </ul>
              <button
                className={`w-full font-syne font-bold py-3 rounded-lg transition-all text-sm ${
                  plan.popular ? "bg-baymax-red text-foreground btn-red-glow" : "border border-border text-foreground hover:border-baymax-red"
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
