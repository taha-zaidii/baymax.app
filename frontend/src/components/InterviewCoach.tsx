import { useState } from "react";
import { Pause, SkipForward, Square, AlertCircle } from "lucide-react";
import { generateInterview } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";

interface Props {
  onSwitchTab: (tab: number) => void;
  jobTitle?: string;
  resumeSummary?: string;
}

const InterviewCoach = ({ onSwitchTab, jobTitle = "Software Engineer", resumeSummary = "" }: Props) => {
  const { toast } = useToast();
  const [userJobTitle, setUserJobTitle] = useState(jobTitle);
  const [answer, setAnswer] = useState("");
  const [interviewContent, setInterviewContent] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [phase, setPhase] = useState<"setup" | "answering" | "done">("setup");

  const interviewApi = useApi<{ interview: string }>();

  const startInterview = async () => {
    if (!userJobTitle.trim()) {
      toast({ title: "Job title required", description: "Enter the role you're interviewing for.", variant: "destructive" });
      return;
    }
    try {
      const result = await interviewApi.execute(() =>
        generateInterview(userJobTitle, resumeSummary)
      );
      setInterviewContent(result.interview);
      setPhase("answering");
    } catch (err) {
      toast({ title: "Failed to generate interview", description: String(err), variant: "destructive" });
    }
  };

  const submitAnswers = () => {
    if (!answer.trim()) return;
    setUserAnswers((prev) => [...prev, answer]);
    setAnswer("");
    setPhase("done");
  };

  if (phase === "setup") {
    return (
      <div className="space-y-6 max-w-xl mx-auto py-8" style={{ animation: "staggerFadeIn 0.4s ease-out" }}>
        <div className="text-center space-y-2">
          <h3 className="font-syne font-bold text-xl text-foreground">Mock Interview Coach</h3>
          <p className="text-sm text-muted-foreground">Sam will generate personalised interview questions for your target role.</p>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            value={userJobTitle}
            onChange={(e) => setUserJobTitle(e.target.value)}
            placeholder="e.g. Backend Engineer at a fintech"
            className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-baymax-red focus:outline-none transition-colors"
          />

          {interviewApi.error && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertCircle className="text-red-400 mt-0.5 shrink-0" size={16} />
              <p className="text-sm text-red-300">{interviewApi.error}</p>
            </div>
          )}

          <button
            onClick={startInterview}
            disabled={interviewApi.loading}
            className="w-full bg-baymax-red text-foreground font-syne font-bold py-3 rounded-lg btn-red-glow transition-all disabled:opacity-50"
          >
            {interviewApi.loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
                Sam is preparing your interview...
              </span>
            ) : (
              "Start Interview →"
            )}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="text-center space-y-6 py-8" style={{ animation: "staggerFadeIn 0.4s ease-out" }}>
        <div className="font-syne font-extrabold text-6xl text-baymax-red">✓</div>
        <p className="text-foreground text-lg font-syne font-bold">Interview Complete!</p>
        <div className="glass-card rounded-xl p-4 max-w-md mx-auto text-left space-y-2" style={{ transform: "none" }}>
          <p className="text-sm text-muted-foreground">Your answers have been recorded. Review the AI-generated questions and model answers above to compare your performance.</p>
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={() => { setPhase("setup"); setInterviewContent(null); setUserAnswers([]); }}
            className="border border-baymax-red text-baymax-red font-syne font-bold px-6 py-3 rounded-lg hover:bg-baymax-red/10 transition-all"
          >
            New Interview
          </button>
          <button onClick={() => onSwitchTab(2)} className="bg-baymax-red text-foreground font-syne font-bold px-8 py-3 rounded-lg btn-red-glow transition-all">
            Find Jobs for This Role →
          </button>
        </div>
      </div>
    );
  }

  // answering phase — show AI-generated Q&A + answer box
  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          Interviewing for: <span className="text-foreground">{userJobTitle}</span>
        </span>
        <div className="flex gap-2">
          <button onClick={() => setPhase("setup")} className="p-2 rounded-lg border border-border hover:border-baymax-red text-muted-foreground hover:text-foreground transition-all">
            <SkipForward size={14} />
          </button>
          <button onClick={() => setPhase("done")} className="p-2 rounded-lg border border-baymax-red text-baymax-red hover:bg-baymax-red/10 transition-all">
            <Square size={14} />
          </button>
        </div>
      </div>

      {/* AI-generated interview content */}
      <div className="glass-card rounded-xl p-5 max-h-[380px] overflow-y-auto" style={{ transform: "none" }}>
        <div className="flex gap-3 items-start mb-3">
          <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center shrink-0">
            <svg viewBox="0 0 200 220" width="20" height="22"><ellipse cx="100" cy="145" rx="65" ry="70" fill="#111" /><circle cx="100" cy="65" r="40" fill="#111" /><ellipse cx="88" cy="58" rx="4" ry="5" fill="white" /><ellipse cx="112" cy="58" rx="4" ry="5" fill="white" /></svg>
          </div>
          <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{interviewContent}</div>
        </div>
      </div>

      {/* Answer input */}
      <div className="space-y-2">
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Type your answers here (optional — for self-reflection)..."
          className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-baymax-red focus:outline-none transition-colors resize-none h-24"
        />
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground font-mono-label">{answer.split(/\s+/).filter(Boolean).length} words</span>
          <button onClick={submitAnswers} className="bg-baymax-red text-foreground font-syne font-bold px-6 py-2.5 rounded-lg btn-red-glow transition-all text-sm">
            Finish Session →
          </button>
        </div>
      </div>
    </div>
  );
};

export default InterviewCoach;
