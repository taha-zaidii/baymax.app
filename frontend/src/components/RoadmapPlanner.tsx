import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { generateRoadmap } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";

interface Props {
  jobTitle?: string;
  skillsGap?: string;
}

type TaskType = "skills" | "projects" | "certifications" | "applications";
interface Task { text: string; type: TaskType; checked: boolean; }

const defaultRoadmap: { month: string; subtitle: string; tasks: Task[] }[] = [
  {
    month: "Month 1", subtitle: "Build Foundation",
    tasks: [
      { text: "Complete DSA basics (Arrays, Linked Lists, Trees)", type: "skills", checked: false },
      { text: "Build portfolio project with React + FastAPI", type: "projects", checked: false },
      { text: "Set up LinkedIn profile & GitHub README", type: "applications", checked: false },
    ],
  },
  {
    month: "Month 2", subtitle: "Skill Up",
    tasks: [
      { text: "Docker + System Design course", type: "certifications", checked: false },
      { text: "Contribute to open source (2 PRs)", type: "projects", checked: false },
      { text: "Mock interviews × 5 sessions", type: "skills", checked: false },
    ],
  },
  {
    month: "Month 3", subtitle: "Apply & Land",
    tasks: [
      { text: "Apply to 20 companies on LinkedIn & Rozee.pk", type: "applications", checked: false },
      { text: "Follow-up and networking outreach", type: "applications", checked: false },
      { text: "Negotiate and accept offer 🎉", type: "applications", checked: false },
    ],
  },
];

const typeColors: Record<TaskType, string> = {
  skills: "text-blue-300 bg-blue-500/10 border-blue-500/30",
  projects: "text-green-300 bg-green-500/10 border-green-500/30",
  certifications: "text-amber-300 bg-amber-500/10 border-amber-500/30",
  applications: "text-baymax-red-light bg-baymax-red/10 border-baymax-red/30",
};

const RoadmapPlanner = ({ jobTitle: initialJobTitle = "", skillsGap = "" }: Props) => {
  const { toast } = useToast();
  const [jobTitle, setJobTitle] = useState(initialJobTitle || "Software Engineer");
  const [aiRoadmap, setAiRoadmap] = useState<string | null>(null);
  const [checkboxRoadmap, setCheckboxRoadmap] = useState(() => {
    const saved = localStorage.getItem("baymax-roadmap");
    return saved ? JSON.parse(saved) : defaultRoadmap;
  });

  const roadmapApi = useApi<{ roadmap: string }>();

  const generateAiRoadmap = async () => {
    if (!jobTitle.trim()) {
      toast({ title: "Job title required", description: "Enter your target role to generate a roadmap.", variant: "destructive" });
      return;
    }
    try {
      const result = await roadmapApi.execute(() =>
        generateRoadmap(jobTitle, skillsGap)
      );
      setAiRoadmap(result.roadmap);
    } catch (err) {
      toast({ title: "Roadmap generation failed", description: String(err), variant: "destructive" });
    }
  };

  const toggleTask = (mi: number, ti: number) => {
    const updated = checkboxRoadmap.map((m: typeof defaultRoadmap[0], i: number) =>
      i === mi ? { ...m, tasks: m.tasks.map((t: Task, j: number) => j === ti ? { ...t, checked: !t.checked } : t) } : m
    );
    setCheckboxRoadmap(updated);
    localStorage.setItem("baymax-roadmap", JSON.stringify(updated));
  };

  const totalTasks = checkboxRoadmap.reduce((a: number, m: typeof defaultRoadmap[0]) => a + m.tasks.length, 0);
  const doneTasks = checkboxRoadmap.reduce((a: number, m: typeof defaultRoadmap[0]) => a + m.tasks.filter((t: Task) => t.checked).length, 0);

  return (
    <div className="space-y-6">
      {/* Job title + generate button */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          placeholder="e.g. ML Engineer"
          className="bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:border-baymax-red focus:outline-none transition-colors flex-1 min-w-[200px]"
        />
        <button
          onClick={generateAiRoadmap}
          disabled={roadmapApi.loading}
          className="bg-baymax-red text-foreground font-syne font-bold px-5 py-2.5 rounded-lg btn-red-glow transition-all disabled:opacity-50 text-sm"
        >
          {roadmapApi.loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
              Generating...
            </span>
          ) : (
            "🗺️ Generate AI Roadmap"
          )}
        </button>
      </div>

      {roadmapApi.error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="text-red-400 mt-0.5 shrink-0" size={16} />
          <p className="text-sm text-red-300">{roadmapApi.error}</p>
        </div>
      )}

      {/* AI-generated roadmap */}
      {aiRoadmap && (
        <div className="glass-card rounded-xl p-6" style={{ transform: "none", animation: "staggerFadeIn 0.4s ease-out" }}>
          <h4 className="font-syne font-bold text-lg text-foreground mb-4">
            📋 Rahul's Personalised Roadmap — {jobTitle}
          </h4>
          <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{aiRoadmap}</div>
        </div>
      )}

      {/* Interactive checklist */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="font-syne font-bold text-xl text-foreground">Your 90-Day Checklist</h3>
            <p className="text-sm text-muted-foreground mt-1">Target: <span className="text-baymax-red">{jobTitle}</span></p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground font-mono-label">{doneTasks} / {totalTasks} tasks</span>
            <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-baymax-red rounded-full transition-all" style={{ width: `${(doneTasks / totalTasks) * 100}%` }} />
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {checkboxRoadmap.map((month: typeof defaultRoadmap[0], mi: number) => (
            <div key={mi} className="glass-card rounded-xl p-5" style={{ transform: "none" }}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs bg-baymax-red text-foreground px-2 py-0.5 rounded-full font-bold">{month.month}</span>
                <span className="text-sm text-foreground font-syne font-bold">{month.subtitle}</span>
              </div>
              <div className="space-y-3">
                {month.tasks.map((task: Task, ti: number) => (
                  <label key={ti} className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={task.checked}
                      onChange={() => toggleTask(mi, ti)}
                      className="mt-1 w-4 h-4 rounded border-border accent-baymax-red"
                    />
                    <div className="flex-1">
                      <span className={`text-sm transition-all ${task.checked ? "line-through text-muted-foreground opacity-60" : "text-foreground"}`}>
                        {task.text}
                      </span>
                      <span className={`inline-block ml-2 text-[10px] px-1.5 py-0.5 rounded-full border ${typeColors[task.type]}`}>
                        {task.type}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RoadmapPlanner;
