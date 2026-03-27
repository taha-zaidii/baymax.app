import { useState } from "react";
import { Bookmark, ExternalLink, AlertCircle, Search } from "lucide-react";
import { searchJobs } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";

interface Props {
  jobTitle?: string;
  skillsSummary?: string;
}

const filters = ["Remote", "Pakistan", "Full-time", "Internship", "Entry Level"];

const JobScout = ({ jobTitle: initialJobTitle = "", skillsSummary = "" }: Props) => {
  const { toast } = useToast();
  const [jobTitle, setJobTitle] = useState(initialJobTitle || "Software Engineer");
  const [activeFilters, setActiveFilters] = useState<string[]>(["Pakistan"]);
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [jobsContent, setJobsContent] = useState<string | null>(null);

  const jobsApi = useApi<{ jobs: string }>();

  const toggleFilter = (f: string) => {
    setActiveFilters((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);
  };

  const handleSearch = async () => {
    if (!jobTitle.trim()) {
      toast({ title: "Job title required", description: "Enter a role to search for.", variant: "destructive" });
      return;
    }
    try {
      const filterContext = activeFilters.length > 0 ? ` (${activeFilters.join(", ")})` : "";
      const result = await jobsApi.execute(() =>
        searchJobs(jobTitle + filterContext, skillsSummary)
      );
      setJobsContent(result.jobs);
    } catch (err) {
      toast({ title: "Job search failed", description: String(err), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Search bar + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          placeholder="e.g. Software Engineer"
          className="bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:border-baymax-red focus:outline-none transition-colors flex-1 min-w-[200px]"
          onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
        />
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => toggleFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
              activeFilters.includes(f) ? "bg-baymax-red border-baymax-red text-foreground" : "border-border text-muted-foreground hover:border-baymax-red"
            }`}
          >
            {f}
          </button>
        ))}
        <button
          onClick={handleSearch}
          disabled={jobsApi.loading}
          className="bg-baymax-red text-foreground font-syne font-bold px-5 py-2.5 rounded-lg btn-red-glow transition-all disabled:opacity-50 flex items-center gap-2 text-sm"
        >
          {jobsApi.loading ? (
            <span className="w-4 h-4 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
          ) : (
            <Search size={14} />
          )}
          {jobsApi.loading ? "Searching..." : "Search Jobs"}
        </button>
      </div>

      {jobsApi.error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="text-red-400 mt-0.5 shrink-0" size={16} />
          <p className="text-sm text-red-300">{jobsApi.error}</p>
        </div>
      )}

      {/* Results */}
      {jobsContent ? (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <div className="glass-card rounded-xl p-6" style={{ transform: "none" }}>
              <h4 className="font-syne font-bold text-sm text-foreground mb-4">
                🔍 Zara's Job Matches — {jobTitle}
              </h4>
              <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{jobsContent}</div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="glass-card rounded-xl p-5 border-l-2 border-l-baymax-red" style={{ transform: "none" }}>
              <h4 className="font-syne font-bold text-sm text-foreground mb-2">⚡ Quick Links</h4>
              <div className="space-y-2">
                {[
                  { name: "Rozee.pk", url: `https://www.rozee.pk/job/search/q/${encodeURIComponent(jobTitle)}` },
                  { name: "LinkedIn Jobs", url: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(jobTitle)}&location=Pakistan` },
                  { name: "Mustakbil.com", url: `https://mustakbil.com/jobs?query=${encodeURIComponent(jobTitle)}` },
                ].map((link) => (
                  <a
                    key={link.name}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-baymax-red hover:underline"
                  >
                    {link.name} <ExternalLink size={10} />
                  </a>
                ))}
              </div>
            </div>
            <div className="glass-card rounded-xl p-5 border-l-2 border-l-green-500" style={{ transform: "none" }}>
              <h4 className="font-syne font-bold text-sm text-foreground mb-2">💡 Pro Tip</h4>
              <p className="text-sm text-muted-foreground">Companies in Pakistan are actively hiring. Tailor your resume for each application!</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-sm">Enter a job title and click <span className="text-baymax-red font-bold">Search Jobs</span> to find live opportunities.</p>
          <p className="text-muted-foreground text-xs mt-2">Powered by Zara · Searches Rozee.pk, LinkedIn, Mustakbil &amp; more</p>
        </div>
      )}
    </div>
  );
};

export default JobScout;
