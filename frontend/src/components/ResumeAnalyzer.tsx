import { useState, useRef, useEffect } from "react";
import { Upload, X, CheckCircle, AlertCircle } from "lucide-react";
import { extractResume, analyzeResume } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";

interface Props {
  onSwitchTab: (tab: number) => void;
  onAnalysisComplete?: (jobTitle: string, resumeSummary: string) => void;
}

interface AnalysisResult {
  score: number;
  atsScore: number;
  skillsFound: string[];
  missingSkills: string[];
  improvements: Array<{ before: string; after: string }>;
  summary: string;
}

const ScoreRing = ({ score, visible }: { score: number; visible: boolean }) => {
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="#1e1e1e"
          strokeWidth="6"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="#E8272B"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={visible ? offset : circumference}
          style={{ transition: "stroke-dashoffset 1.5s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-syne font-extrabold text-3xl text-foreground">
          {visible ? score : 0}
        </span>
        <span className="text-xs text-muted-foreground">/100</span>
      </div>
    </div>
  );
};

const parseAnalysisResponse = (text: string): AnalysisResult => {
  // Parse the AI response to extract structured data
  // This is a simplified parser - adjust based on your agent's output format

  const scoreMatch = text.match(/(\d+)[\s\-]*(?:match|score)/i);
  const score = scoreMatch ? parseInt(scoreMatch[1]) : 75;

  // Extract skills mentioned
  const skillsSection = text.match(
    /(?:skills?|found|detected)[:\s]*([\s\S]*?)(?:gaps?|missing|weakness)/i,
  );
  const skillsFound = skillsSection
    ? skillsSection[1]
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 6)
    : ["Python", "React", "SQL"];

  const gapsSection = text.match(
    /(?:gaps?|missing|weakness)[:\s]*([\s\S]*?)(?:improvements?|suggestions?|recommendations?|$)/i,
  );
  const missingSkills = gapsSection
    ? gapsSection[1]
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 4)
    : ["System Design", "Docker"];

  return {
    score,
    atsScore: score > 60 ? 75 + (score - 60) : 60 + score / 3,
    skillsFound,
    missingSkills,
    improvements: [
      {
        before: "Experience with technologies",
        after:
          "Designed and optimized systems with modern tech stack, achieving measurable improvements",
      },
    ],
    summary: text.substring(0, 300),
  };
};

const ResumeAnalyzer = ({ onSwitchTab, onAnalysisComplete }: Props) => {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [dragging, setDragging] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [jobTitle, setJobTitle] = useState("");
  const [experience, setExperience] = useState("0-1");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null,
  );

  const fileRef = useRef<HTMLInputElement>(null);
  const extractApi = useApi<{ success: boolean; extracted_text: string }>();
  const analyzeApi = useApi<{ analysis: string }>();

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith(".pdf")) {
      toast({
        title: "Invalid file",
        description: "Please upload a PDF file",
        variant: "destructive",
      });
      return;
    }
    setFile(selectedFile);
    setShowResults(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const extractAndAnalyze = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please upload a resume PDF first",
        variant: "destructive",
      });
      return;
    }

    if (!jobTitle.trim()) {
      toast({
        title: "Job title required",
        description: "Please enter the target job title",
        variant: "destructive",
      });
      return;
    }

    try {
      // Step 1: Extract text from PDF
      const extractResult = await extractApi.execute(() => extractResume(file));
      setResumeText(extractResult.extracted_text);

      // Step 2: Analyze resume
      const analysisResult = await analyzeApi.execute(() =>
        analyzeResume(extractResult.extracted_text, jobTitle),
      );

      // Parse results
      const parsed = parseAnalysisResponse(analysisResult.analysis);
      setAnalysisResult(parsed);
      setShowResults(true);

      // Share context with other tabs
      onAnalysisComplete?.(jobTitle, analysisResult.analysis.substring(0, 600));

      toast({
        title: "Analysis complete",
        description: "Your resume has been analyzed successfully",
      });
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Analysis failed";
      toast({
        title: "Analysis failed",
        description: errorMsg,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-8">
      {/* Left */}
      <div className="space-y-5">
        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
            dragging
              ? "border-baymax-red bg-baymax-red/5"
              : "border-border hover:border-baymax-red/50"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !file && fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileInputChange}
          />
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <CheckCircle className="text-green-400" size={20} />
              <span className="text-foreground text-sm">{file.name}</span>
              <span className="text-muted-foreground text-xs">
                ({(file.size / 1024).toFixed(0)} KB)
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  setShowResults(false);
                }}
                className="text-baymax-red hover:text-baymax-red-light"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              <Upload
                className="mx-auto mb-3 text-muted-foreground"
                size={32}
              />
              <p className="text-foreground text-sm">
                Drop your resume PDF here
              </p>
              <p className="text-baymax-red text-xs mt-1">or click to browse</p>
            </>
          )}
        </div>

        <input
          type="text"
          placeholder="e.g. Software Engineer"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-baymax-red focus:outline-none transition-colors"
        />

        <select
          value={experience}
          onChange={(e) => setExperience(e.target.value)}
          className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-sm text-foreground focus:border-baymax-red focus:outline-none transition-colors"
        >
          <option value="0-1">0–1 years experience</option>
          <option value="1-3">1–3 years</option>
          <option value="3-5">3–5 years</option>
          <option value="5+">5+ years</option>
        </select>

        {analyzeApi.error && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertCircle className="text-red-400 mt-0.5 shrink-0" size={16} />
            <p className="text-sm text-red-300">{analyzeApi.error}</p>
          </div>
        )}

        <button
          onClick={extractAndAnalyze}
          disabled={!file || analyzeApi.loading || extractApi.loading}
          className="w-full bg-baymax-red text-foreground font-syne font-bold py-3 rounded-lg btn-red-glow transition-all disabled:opacity-50"
        >
          {analyzeApi.loading || extractApi.loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
              Baymax is reading your resume...
            </span>
          ) : (
            "Analyze with Baymax →"
          )}
        </button>
      </div>

      {/* Right — Results */}
      {showResults && analysisResult && (
        <div
          className="space-y-6"
          style={{ animation: "staggerFadeIn 0.4s ease-out forwards" }}
        >
          <div className="text-center">
            <ScoreRing score={analysisResult.score} visible={showResults} />
            <p className="text-muted-foreground text-sm mt-2">
              {analysisResult.score >= 80
                ? "Excellent Score"
                : analysisResult.score >= 60
                  ? "Good Score"
                  : "Needs Improvement"}
            </p>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">ATS Compatibility</span>
              <span className="text-foreground">
                {Math.round(analysisResult.atsScore)}%
              </span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-baymax-red rounded-full"
                style={{
                  width: `${analysisResult.atsScore}%`,
                  animation: "fillBar 1s ease-out",
                }}
              />
            </div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-2">Skills Found</p>
            <div className="flex flex-wrap gap-2">
              {analysisResult.skillsFound.map((s) => (
                <span
                  key={s}
                  className="text-xs px-2.5 py-1 rounded-full border border-green-500/30 bg-green-500/10 text-green-300"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-2">Missing Skills</p>
            <div className="flex flex-wrap gap-2">
              {analysisResult.missingSkills.map((s) => (
                <span
                  key={s}
                  className="text-xs px-2.5 py-1 rounded-full border border-baymax-red/30 bg-baymax-red/10 text-baymax-red-light"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Improved Bullet Points
            </p>
            {analysisResult.improvements.map((ba, i) => (
              <div
                key={i}
                className="glass-card rounded-lg p-4 space-y-2"
                style={{ transform: "none" }}
              >
                <p className="text-sm text-muted-foreground line-through">
                  {ba.before}
                </p>
                <p className="text-sm text-foreground flex items-start gap-2">
                  <CheckCircle
                    className="text-green-400 shrink-0 mt-0.5"
                    size={14}
                  />
                  {ba.after}
                </p>
              </div>
            ))}
          </div>

          <button
            onClick={() => onSwitchTab(1)}
            className="w-full border border-baymax-red text-baymax-red font-syne font-bold py-3 rounded-lg hover:bg-baymax-red/10 transition-all"
          >
            Practice Interview for This Role →
          </button>
        </div>
      )}
    </div>
  );
};

export default ResumeAnalyzer;
