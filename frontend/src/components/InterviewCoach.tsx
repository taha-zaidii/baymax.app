import { useState, useRef, useEffect, useCallback } from "react";
import { Volume2, Square, ChevronDown, Mic } from "lucide-react";
import { startInterview, replyInterview, transcribeAudio } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface Props {
  onSwitchTab: (tab: number) => void;
  jobTitle?: string;
  resumeSummary?: string;
  userId?: string;
  onInterviewDone?: (avgScore: number, weakAreas: string[]) => void;
}

type Mode = "setup" | "speaking" | "listening" | "processing" | "done";

interface Turn {
  question: string;
  answer: string;
  feedback: string;
  score: number;
}

// SpeechRecognition is a browser API and not a TypeScript built-in. Declare
// the surface we actually use so the file typechecks without a DOM-lib dep.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognition = any;
declare global {
  interface Window {
    SpeechRecognition: SpeechRecognition;
    webkitSpeechRecognition: SpeechRecognition;
  }
}

/* ─── CSS Keyframes (injected once) ────────────────────────────────────── */
const OrbStyles = `
  @keyframes orb-idle {
    0%,100% { border-radius:60% 40% 30% 70%/60% 30% 70% 40%; transform:scale(1);
      box-shadow:0 0 40px 8px rgba(232,39,43,.25),0 0 80px 16px rgba(232,39,43,.10); }
    50%     { border-radius:30% 60% 70% 40%/50% 60% 30% 60%; transform:scale(1.03);
      box-shadow:0 0 50px 12px rgba(232,39,43,.30),0 0 100px 20px rgba(232,39,43,.12); }
  }
  @keyframes orb-speaking {
    0%  { border-radius:60% 40% 30% 70%/60% 30% 70% 40%; transform:scale(1.00); }
    15% { border-radius:40% 60% 60% 40%/40% 60% 40% 60%; transform:scale(1.08); }
    30% { border-radius:70% 30% 40% 60%/50% 40% 60% 50%; transform:scale(1.04); }
    45% { border-radius:50% 50% 30% 70%/60% 50% 50% 40%; transform:scale(1.10); }
    60% { border-radius:30% 70% 60% 40%/40% 70% 30% 60%; transform:scale(1.06); }
    75% { border-radius:65% 35% 45% 55%/55% 35% 65% 45%; transform:scale(1.09); }
    100%{ border-radius:60% 40% 30% 70%/60% 30% 70% 40%; transform:scale(1.00); }
  }
  @keyframes orb-speaking-glow {
    0%,100% { box-shadow:0 0 60px 15px rgba(232,39,43,.45),0 0 120px 30px rgba(232,39,43,.20),inset 0 0 40px rgba(255,80,80,.15); }
    50%     { box-shadow:0 0 80px 25px rgba(232,39,43,.60),0 0 160px 50px rgba(232,39,43,.25),inset 0 0 60px rgba(255,80,80,.20); }
  }
  @keyframes orb-listening {
    0%,100% { border-radius:50%; transform:scale(1.00);
      box-shadow:0 0 40px 10px rgba(16,185,129,.40),0 0 80px 20px rgba(16,185,129,.15); }
    50%     { border-radius:50%; transform:scale(1.06);
      box-shadow:0 0 65px 22px rgba(16,185,129,.55),0 0 130px 44px rgba(16,185,129,.22); }
  }
  @keyframes orb-processing {
    0%,100% { border-radius:55% 45% 45% 55%/55% 45% 55% 45%; transform:scale(1);
      box-shadow:0 0 40px 10px rgba(251,191,36,.35),0 0 80px 20px rgba(251,191,36,.15); }
    50%     { border-radius:45% 55% 55% 45%/45% 55% 45% 55%; transform:scale(0.97);
      box-shadow:0 0 60px 20px rgba(251,191,36,.50),0 0 120px 40px rgba(251,191,36,.20); }
  }
  @keyframes ring-pulse {
    0%   { transform:scale(1);   opacity:.6; }
    100% { transform:scale(1.9); opacity:0;  }
  }
  @keyframes bar-wave {
    0%,100% { scaleY:.4; } 50% { scaleY:1; }
  }
`;

/* ─── Animated Orb ──────────────────────────────────────────────────────── */
const AnimatedOrb = ({ mode, interimText }: { mode: Mode; interimText: string }) => {
  const isSpeaking  = mode === "speaking";
  const isListening = mode === "listening";

  const gradient =
    isSpeaking   ? "from-[#E8272B] via-orange-600/80 to-red-900/60"
    : isListening ? "from-emerald-400/80 via-green-600/60 to-teal-900/60"
    : mode === "processing" ? "from-yellow-400/80 via-amber-600/60 to-orange-900/60"
    : "from-[#E8272B]/70 via-red-900/50 to-black/70";

  const orbAnim =
    isSpeaking   ? "orb-speaking .6s ease-in-out infinite, orb-speaking-glow .8s ease-in-out infinite"
    : isListening ? "orb-listening 1s ease-in-out infinite"
    : mode === "processing" ? "orb-processing 1.2s ease-in-out infinite"
    : "orb-idle 4s ease-in-out infinite";

  const label =
    isSpeaking   ? "Sam speaking"
    : isListening ? (interimText ? "Hearing you..." : "Listening...")
    : mode === "processing" ? "Thinking..."
    : mode === "done" ? "Done" : "Sam";

  return (
    <div className="relative flex items-center justify-center w-56 h-56 mx-auto select-none">
      {/* Expanding rings */}
      {isListening && <>
        <div className="absolute inset-0 rounded-full border border-emerald-400/40"
             style={{ animation: "ring-pulse 1.4s ease-out infinite" }} />
        <div className="absolute inset-0 rounded-full border border-emerald-400/25"
             style={{ animation: "ring-pulse 1.4s ease-out .5s infinite" }} />
      </>}
      {isSpeaking && <>
        <div className="absolute inset-[-10px] rounded-full border border-baymax-red/35"
             style={{ animation: "ring-pulse .9s ease-out infinite" }} />
        <div className="absolute inset-[-10px] rounded-full border border-baymax-red/20"
             style={{ animation: "ring-pulse .9s ease-out .3s infinite" }} />
      </>}

      {/* Main blob */}
      <div className={`absolute w-44 h-44 bg-gradient-to-br ${gradient}`}
           style={{ animation: orbAnim, willChange: "border-radius,transform,box-shadow" }}>
        <div className="absolute inset-[20%_30%_50%_20%] rounded-full bg-white/10 blur-sm" />
      </div>

      {/* Baymax face */}
      <div className="relative flex flex-col items-center justify-center gap-2 pointer-events-none z-10">
        <svg viewBox="0 0 200 100" width="64" height="32" className="drop-shadow-lg">
          <ellipse cx="60"  cy="50" rx="18" ry={isSpeaking ? 22 : 15} fill="white" style={{ transition:"ry .2s" }} />
          <ellipse cx="140" cy="50" rx="18" ry={isSpeaking ? 22 : 15} fill="white" style={{ transition:"ry .2s" }} />
          <ellipse cx="60"  cy="50" rx="9"  ry={isSpeaking ? 13 :  8} fill="#111"  style={{ transition:"ry .2s" }} />
          <ellipse cx="140" cy="50" rx="9"  ry={isSpeaking ? 13 :  8} fill="#111"  style={{ transition:"ry .2s" }} />
        </svg>
        <span className="text-[10px] font-bold tracking-widest uppercase text-white/80">{label}</span>
      </div>
    </div>
  );
};

/* ─── Sound bars (listening state) ─────────────────────────────────────── */
const SoundBars = ({ active }: { active: boolean }) => (
  <div className="flex items-end gap-0.5 h-8">
    {[0.4, 0.9, 0.6, 1.0, 0.7, 0.85, 0.5].map((h, i) => (
      <div key={i} className={`w-1 rounded-full transition-colors ${active ? "bg-emerald-400" : "bg-border"}`}
           style={{ height: `${h * 100}%`, animation: active ? `bar-wave ${.4 + i*.07}s ease-in-out ${i*.06}s infinite alternate` : "none",
                    transformOrigin: "bottom" }} />
    ))}
  </div>
);

/* ─── Main Component ────────────────────────────────────────────────────── */
const InterviewCoach = ({ onSwitchTab, jobTitle = "", resumeSummary = "", userId = "default", onInterviewDone }: Props) => {
  const { toast } = useToast();

  const [userJobTitle, setUserJobTitle]   = useState(jobTitle);
  const [mode, setMode]                   = useState<Mode>("setup");
  const [sessionId, setSessionId]         = useState("");
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [questionNum, setQuestionNum]     = useState(1);
  const [turns, setTurns]                 = useState<Turn[]>([]);
  const [interimText, setInterimText]     = useState("");   // live partial speech
  const [finalText, setFinalText]         = useState("");   // confirmed speech
  const [textInput, setTextInput]         = useState("");   // manual text box
  const [textMode, setTextMode]           = useState(false);
  const [showLog, setShowLog]             = useState(false);
  const [hasSpeechAPI, setHasSpeechAPI]   = useState(false);

  const recognitionRef  = useRef<SpeechRecognition | null>(null);
  const recorderRef     = useRef<MediaRecorder | null>(null);
  const chunksRef       = useRef<Blob[]>([]);
  const streamRef       = useRef<MediaStream | null>(null);
  const logRef          = useRef<HTMLDivElement>(null);
  const modeRef         = useRef<Mode>("setup");

  // Keep modeRef in sync
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // Detect SpeechRecognition support
  useEffect(() => {
    setHasSpeechAPI(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
  }, []);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [turns, interimText, finalText]);

  /* ── TTS: Sam speaks — natural voice ─────────────────────────────────── */
  const speak = useCallback((text: string, onDone: () => void) => {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();

    // Priority order: most natural first
    const pick =
      voices.find(v => v.name === "Google US English") ||
      voices.find(v => v.name === "Google UK English Male") ||
      voices.find(v => v.name.includes("Microsoft David")) ||
      voices.find(v => v.name.includes("Samantha")) ||
      voices.find(v => v.name.includes("Daniel") && v.lang === "en-GB") ||
      voices.find(v => v.name.includes("Alex") && v.lang === "en-US") ||
      voices.find(v => v.name.includes("Aaron")) ||
      voices.find(v => v.lang === "en-US" && !v.name.includes("Google")) ||
      voices.find(v => v.lang.startsWith("en"));

    if (pick) utter.voice = pick;
    utter.rate   = 0.90;   // slightly slower = clearer
    utter.pitch  = 0.95;   // slightly lower = more confident
    utter.volume = 1.0;
    utter.onend  = onDone;
    utter.onerror = onDone;
    window.speechSynthesis.speak(utter);
  }, []);

  /* ── Start SpeechRecognition (live text) + MediaRecorder (audio blob) ── */
  const startListening = useCallback(async () => {
    setInterimText("");
    setFinalText("");

    /* — SpeechRecognition for live transcript — */
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      const rec = new SR();
      rec.continuous           = true;
      rec.interimResults       = true;
      rec.lang                 = "en-US";
      rec.maxAlternatives      = 1;

      let accumulated = "";

      rec.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) {
            accumulated += t + " ";
            setFinalText(accumulated.trim());
            setInterimText("");
          } else {
            interim += t;
            setInterimText(interim);
          }
        }
      };

      rec.onerror = (e) => {
        if (e.error !== "aborted" && e.error !== "no-speech") {
          console.warn("SpeechRecognition error:", e.error);
        }
      };

      rec.onend = () => {
        // restart if still in listening mode (handles auto-stops in Chrome)
        if (modeRef.current === "listening") {
          try { rec.start(); } catch { /* ignore if already started */ }
        }
      };

      rec.start();
      recognitionRef.current = rec;
    }

    /* — MediaRecorder as audio backup for Whisper — */
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start(500);
      recorderRef.current = mr;
    } catch (err) {
      console.warn("MediaRecorder unavailable:", err);
    }

    setMode("listening");
  }, []);

  /* ── Stop recording + get final transcript ──────────────────────────── */
  const stopAndSubmit = useCallback(async () => {
    setMode("processing");

    // Stop SpeechRecognition
    recognitionRef.current?.abort();
    recognitionRef.current = null;

    // Stop MediaRecorder
    let audioBlob: Blob | null = null;
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      await new Promise<void>((res) => {
        recorderRef.current!.onstop = () => res();
        recorderRef.current!.stop();
      });
      audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());

    // Prefer SpeechRecognition text (already have it from state via ref)
    let answerText = finalText.trim();

    // If SpeechRecognition got nothing but we have audio — fall back to Whisper
    if (!answerText && audioBlob && audioBlob.size > 1000) {
      try {
        const { text } = await transcribeAudio(audioBlob);
        answerText = text.trim();
      } catch {
        toast({ title: "Transcription failed", description: "Could not process audio. Please use text mode.", variant: "destructive" });
        setMode("listening");
        await startListening();
        return;
      }
    }

    if (!answerText) {
      toast({ title: "No answer detected", description: "Speak louder or switch to text mode.", variant: "destructive" });
      setMode("listening");
      await startListening();
      return;
    }

    await submitAnswer(answerText);
  }, [finalText, startListening, toast]); // eslint-disable-line

  /* ── Evaluate answer + advance pipeline ─────────────────────────────── */
  const submitAnswer = useCallback(async (answerText: string) => {
    setMode("processing");
    setInterimText("");
    setFinalText("");
    try {
      const result = await replyInterview(sessionId, answerText, questionNum);
      setTurns((prev) => [...prev, {
        question: currentQuestion,
        answer:   answerText,
        feedback: result.feedback,
        score:    result.score,
      }]);

      if (result.is_done || questionNum >= 8) {
        window.speechSynthesis.cancel();
        setMode("done");
        // Compute weak areas (score < 6) and save
        const allTurns = [...turns, { question: currentQuestion, answer: answerText, feedback: result.feedback, score: result.score }];
        const weakTurns = allTurns.filter((t) => t.score < 6);
        const weakAreas = weakTurns.map((t) => t.question.split(" ").slice(0, 4).join(" "));
        const avg = allTurns.reduce((s, t) => s + t.score, 0) / allTurns.length;
        onInterviewDone?.(Math.round(avg * 10) / 10, weakAreas);
        // Fire-and-forget backend save
        try {
          const { saveInterviewResult } = await import("@/lib/api");
          await saveInterviewResult(userId, Math.round(avg * 10) / 10, weakAreas.join(", "));
        } catch { /* non-fatal */ }
        return;
      }

      const next = result.next_question;
      setCurrentQuestion(next);
      setQuestionNum((n) => n + 1);
      setMode("speaking");
      speak(next, async () => {
        if (!textMode) await startListening();
        else setMode("listening");
      });
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" });
      setMode("listening");
    }
  }, [sessionId, questionNum, currentQuestion, speak, startListening, textMode, toast]);

  /* ── Start interview ─────────────────────────────────────────────────── */
  const handleStart = async () => {
    if (!userJobTitle.trim()) {
      toast({ title: "Job title required", variant: "destructive" }); return;
    }
    setMode("processing");
    setTurns([]); setInterimText(""); setFinalText("");
    try {
      const { session_id, question } = await startInterview(userJobTitle, resumeSummary);
      setSessionId(session_id);
      setCurrentQuestion(question);
      setQuestionNum(1);
      setMode("speaking");
      speak(question, async () => {
        if (!textMode) await startListening();
        else setMode("listening");
      });
    } catch (e) {
      toast({ title: "Could not start interview", description: String(e), variant: "destructive" });
      setMode("setup");
    }
  };

  /* ── Cleanup ─────────────────────────────────────────────────────────── */
  const handleReset = () => {
    window.speechSynthesis.cancel();
    recognitionRef.current?.abort();
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setMode("setup"); setSessionId(""); setCurrentQuestion("");
    setQuestionNum(1); setTurns([]); setInterimText(""); setFinalText(""); setTextInput("");
  };

  const avgScore = turns.length
    ? Math.round((turns.reduce((s, t) => s + t.score, 0) / turns.length) * 10) / 10
    : 0;

  /* ─── SETUP ────────────────────────────────────────────────────────── */
  if (mode === "setup") {
    return (
      <div className="flex flex-col items-center gap-7 py-6" style={{ animation: "staggerFadeIn .4s ease-out" }}>
        <style>{OrbStyles}</style>
        <AnimatedOrb mode="setup" interimText="" />

        <div className="text-center space-y-1 max-w-sm">
          <h3 className="font-syne font-bold text-xl text-foreground">1-on-1 Interview with Sam</h3>
          <p className="text-sm text-muted-foreground">
            Sam speaks questions aloud. You reply by voice — transcript appears live as you talk.
          </p>
          {!hasSpeechAPI && (
            <p className="text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-3 py-2 mt-2">
              ⚠️ Your browser doesn't support live speech. Voice mode will use Groq Whisper (submit when done speaking).
            </p>
          )}
        </div>

        <div className="w-full max-w-sm space-y-4">
          <input type="text" value={userJobTitle}
            onChange={(e) => setUserJobTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleStart()}
            placeholder="e.g. Backend Engineer at a fintech"
            className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-baymax-red focus:outline-none transition-colors"
          />

          <label className="flex items-center gap-3 cursor-pointer select-none text-sm text-muted-foreground">
            <div onClick={() => setTextMode(v => !v)}
              className={`w-10 h-5 rounded-full transition-colors relative ${textMode ? "bg-baymax-red" : "bg-border"}`}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${textMode ? "translate-x-5" : "translate-x-0.5"}`} />
            </div>
            {textMode ? "Text mode (type answers)" : "Voice mode (speak answers)"}
          </label>

          <button onClick={handleStart}
            className="w-full bg-baymax-red text-foreground font-syne font-bold py-3 rounded-lg btn-red-glow transition-all">
            {textMode ? "Start Interview →" : "🎙️ Start Voice Interview →"}
          </button>
        </div>
      </div>
    );
  }

  /* ─── DONE ─────────────────────────────────────────────────────────── */
  if (mode === "done") {
    const grade = avgScore >= 8 ? "Excellent 🏆" : avgScore >= 6 ? "Good 👍" : "Keep Practicing 💪";
    return (
      <div className="flex flex-col items-center gap-5 py-4" style={{ animation: "staggerFadeIn .4s ease-out" }}>
        <style>{OrbStyles}</style>
        <AnimatedOrb mode="done" interimText="" />
        <div className="text-center">
          <p className="font-syne font-extrabold text-4xl text-baymax-red">{avgScore}/10</p>
          <p className="text-foreground font-semibold mt-1">{grade}</p>
        </div>
        <div className="w-full max-w-lg glass-card rounded-xl p-4 space-y-3 max-h-56 overflow-y-auto" style={{ transform:"none" }}>
          {turns.map((t, i) => {
            const c = t.score >= 8 ? "#10b981" : t.score >= 6 ? "#f59e0b" : "#ef4444";
            return (
              <div key={i} className="border-l-2 pl-3 space-y-0.5" style={{ borderColor: c }}>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Q{i + 1}</span>
                  <span className="text-xs font-bold" style={{ color: c }}>{t.score}/10</span>
                </div>
                <p className="text-xs text-foreground line-clamp-1">{t.question}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{t.feedback}</p>
              </div>
            );
          })}
        </div>
        <div className="flex gap-3">
          <button onClick={handleReset}
            className="border border-baymax-red text-baymax-red font-syne font-bold px-6 py-3 rounded-lg hover:bg-baymax-red/10 transition-all">
            Try Again
          </button>
          <button onClick={() => onSwitchTab(3)}
            className="bg-baymax-red text-foreground font-syne font-bold px-6 py-3 rounded-lg btn-red-glow transition-all">
            Find Jobs →
          </button>
        </div>
      </div>
    );
  }

  /* ─── LIVE INTERVIEW ───────────────────────────────────────────────── */
  const displayText = finalText + (interimText ? ` ${interimText}` : "");

  return (
    <div className="flex flex-col items-center gap-4" style={{ animation: "staggerFadeIn .3s ease-out" }}>
      <style>{OrbStyles}</style>

      {/* Progress bar */}
      <div className="w-full flex items-center justify-between">
        <div className="flex gap-1 items-center">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${
              i < turns.length ? "bg-baymax-red w-5" : i === turns.length ? "bg-baymax-red/50 w-3" : "bg-border w-3"
            }`} />
          ))}
          <span className="text-xs text-muted-foreground ml-2 font-mono-label">{questionNum}/8</span>
        </div>
        <div className="flex items-center gap-2">
          {avgScore > 0 && <span className="text-xs text-muted-foreground">avg <b className="text-foreground">{avgScore}</b>/10</span>}
          <button onClick={handleReset} title="End interview"
            className="p-1.5 rounded border border-border text-muted-foreground hover:text-baymax-red hover:border-baymax-red transition-all">
            <Square size={12} />
          </button>
        </div>
      </div>

      {/* Orb */}
      <AnimatedOrb mode={mode} interimText={interimText} />

      {/* Sam's question */}
      <div className="w-full rounded-xl bg-card border border-border/60 p-4 text-center">
        <p className="text-foreground leading-relaxed text-sm">{currentQuestion}</p>
      </div>

      {/* Status + live transcript ─────────────────── */}
      <div className="w-full space-y-2">
        {mode === "speaking" && (
          <div className="flex items-center justify-center gap-2 text-sm text-baymax-red-light">
            <Volume2 size={15} className="animate-pulse" />
            <span>Sam is speaking...</span>
          </div>
        )}

        {mode === "processing" && (
          <div className="flex items-center justify-center gap-2 text-sm text-yellow-400">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-yellow-400/30 border-t-yellow-400 animate-spin" />
            <span>Processing your answer...</span>
          </div>
        )}

        {mode === "listening" && (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-3 text-sm text-emerald-400">
              <SoundBars active={!!interimText || !!finalText} />
              <span className="font-semibold">
                {displayText ? "Hearing you..." : "Listening — speak now"}
              </span>
            </div>

            {/* LIVE TRANSCRIPT — the key UX element */}
            {displayText ? (
              <div className="rounded-lg border border-emerald-400/25 bg-emerald-400/5 px-4 py-3 min-h-[60px]">
                {/* Final (confirmed) words */}
                {finalText && (
                  <span className="text-sm text-foreground">{finalText}</span>
                )}
                {/* Interim (still processing) words */}
                {interimText && (
                  <span className="text-sm text-muted-foreground italic"> {interimText}</span>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-border/40 bg-secondary/30 px-4 py-3 min-h-[60px] flex items-center justify-center">
                <span className="text-sm text-muted-foreground italic flex items-center gap-2">
                  <Mic size={14} className="animate-pulse text-emerald-400" />
                  Your words will appear here as you speak...
                </span>
              </div>
            )}

            {/* Submit voice */}
            {!textMode && (
              <button onClick={stopAndSubmit}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-syne font-bold py-3 rounded-lg transition-all">
                ✓ Done Speaking — Submit Answer
              </button>
            )}
          </div>
        )}
      </div>

      {/* Text input (always available as fallback) */}
      <div className="w-full space-y-1.5">
        <div className="flex justify-between items-center">
          <label className="text-xs text-muted-foreground">
            {textMode ? "Your answer:" : "Or type instead:"}
          </label>
          {!textMode && mode === "listening" && (
            <button onClick={() => setTextMode(true)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Switch to text mode
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <textarea value={textInput} onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type your answer..."
            disabled={mode === "processing" || mode === "speaking"}
            className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-baymax-red focus:outline-none transition-colors resize-none h-16 disabled:opacity-40"
          />
          <button
            onClick={async () => {
              if (!textInput.trim()) return;
              const t = textInput; setTextInput("");
              setMode("processing");
              await submitAnswer(t);
            }}
            disabled={!textInput.trim() || mode === "processing" || mode === "speaking"}
            className="bg-baymax-red text-foreground font-syne font-bold px-4 rounded-lg btn-red-glow text-sm transition-all disabled:opacity-40">
            Send →
          </button>
        </div>
      </div>

      {/* Transcript log */}
      <div className="w-full">
        <button onClick={() => setShowLog(v => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ChevronDown size={12} className={`transition-transform ${showLog ? "rotate-180" : ""}`} />
          {showLog ? "Hide" : "Show"} transcript ({turns.length} turns)
        </button>
        {showLog && (
          <div ref={logRef} className="mt-2 max-h-40 overflow-y-auto space-y-3 pr-1">
            {turns.map((t, i) => {
              const c = t.score >= 8 ? "#10b981" : t.score >= 6 ? "#f59e0b" : "#ef4444";
              return (
                <div key={i} className="border-l-2 pl-3 space-y-1" style={{ borderColor: c }}>
                  <p className="text-xs"><span className="text-muted-foreground font-semibold">Sam: </span>{t.question}</p>
                  <p className="text-xs"><span className="text-muted-foreground font-semibold">You: </span>{t.answer}</p>
                  <p className="text-xs font-semibold" style={{ color: c }}>{t.score}/10 — {t.feedback}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default InterviewCoach;
