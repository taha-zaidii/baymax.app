import { useState } from "react";
import BaymaxMascot from "./BaymaxMascot";
import ResumeAnalyzer from "./ResumeAnalyzer";
import ResumeBuilder, { resumeStateToText } from "./ResumeBuilder";
import InterviewCoach from "./InterviewCoach";
import JobScout from "./JobScout";
import RoadmapPlanner from "./RoadmapPlanner";

const tabs = [
  { icon: "📄", label: "Resume" },
  { icon: "🏗️", label: "Builder" },
  { icon: "🎤", label: "Interview" },
  { icon: "🔍", label: "Job Scout" },
  { icon: "🗺️", label: "Roadmap" },
];

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState(0);

  // Shared cross-agent context
  const [sharedJobTitle, setSharedJobTitle]         = useState("");
  const [sharedResumeSummary, setSharedResumeSummary] = useState("");

  // Builder resume text — shared up so Analyzer can analyze it directly
  const [builderResumeText, setBuilderResumeText] = useState("");

  const handleAnalysisComplete = (jobTitle: string, summary: string) => {
    setSharedJobTitle(jobTitle);
    setSharedResumeSummary(summary);
  };

  return (
    <section id="dashboard" className="py-24">
      <div className="red-divider mb-24" />
      <div className="max-w-6xl mx-auto px-6">
        <div
          className="rounded-[20px] border border-border p-6 md:p-8 dashboard-glow"
          style={{ background: "#0f0f0f" }}
        >
          {/* Welcome */}
          <div className="flex items-center gap-4 mb-8">
            <BaymaxMascot size={80} showWave={true} showTooltip={false} />
            <div className="flex-1">
              <p className="text-foreground text-lg font-syne font-bold">Hey there! I'm Baymax.</p>
              <p className="text-muted-foreground text-sm">Your personal career assistant. What would you like to work on today?</p>
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              5 agents online
            </div>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 mb-8">
            {tabs.map((tab, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                  activeTab === i
                    ? "bg-baymax-red text-foreground"
                    : "bg-secondary text-muted-foreground hover:border-baymax-red border border-transparent hover:border"
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div key={activeTab} style={{ animation: "staggerFadeIn 0.3s ease-out" }}>
            {activeTab === 0 && (
              <ResumeAnalyzer
                onSwitchTab={setActiveTab}
                onAnalysisComplete={handleAnalysisComplete}
                builderResumeText={builderResumeText}
              />
            )}
            {activeTab === 1 && (
              <ResumeBuilder
                jobTitle={sharedJobTitle}
                onResumeTextChange={setBuilderResumeText}
              />
            )}
            {activeTab === 2 && (
              <InterviewCoach
                onSwitchTab={setActiveTab}
                jobTitle={sharedJobTitle}
                resumeSummary={sharedResumeSummary}
              />
            )}
            {activeTab === 3 && (
              <JobScout
                jobTitle={sharedJobTitle}
                skillsSummary={sharedResumeSummary}
              />
            )}
            {activeTab === 4 && (
              <RoadmapPlanner
                jobTitle={sharedJobTitle}
                skillsGap={sharedResumeSummary}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Dashboard;
