# Screenshot Capture Checklist

The final report (`PROJECT_REPORT.md`) references **9 screenshots**.
Capture each one, save it under this folder using the exact filename below,
and the report will render it inline.

| # | Filename | What to capture | How to reproduce |
|---|----------|-----------------|------------------|
| 1 | `01-resume-analyzer.png` | Resume Analyzer with all three score cards visible (Overall / ATS / Match) and at least one Improvement bullet | Tab 1 → upload any PDF + paste a JD → click *Analyze Resume* |
| 2 | `02-interview-coach.png` | Voice interview mid-session — orb animating, transcript visible, current question on top | Tab 2 → click *Start Interview* → speak one answer |
| 3 | `03-job-scout.png` | At least 4 ranked job cards with match percentages and apply buttons | Tab 3 → click *Search* (after Tab 1 has run) |
| 4 | `04-roadmap-tabs.png` | Roadmap planner tab strip showing 🧠 CSP Algorithm · 📋 Plan Summary · 📚 Resources | Tab 4 |
| 5 | `05-csp-ac3-pruning.png` | **(Highest priority for grading.)** CSP visualizer mid-AC-3: an arc highlighted, a domain chip struck through, the active-event banner showing "AC-3 PRUNE" | Tab 4 → 🧠 CSP Algorithm → click *Run CSP Solver* → step forward until you land on an `ac3_revised` event |
| 6 | `06-csp-final-schedule.png` | **(Highest priority for grading.)** CSP visualizer at the final step: every variable assigned (green border), schedule calendar fully populated, the *SOLVED* banner visible | Same view → click ⏭ END |
| 7 | `07-dashboard.png` | Full Dashboard with the 5-tab sidebar and progress bar | Any tab — capture from desktop width ≥ 1280 px so the sidebar shows |
| 8 | `08-resume-builder.png` | Resume Builder with form on the left and the live A4 preview on the right | Tab 0 → fill in profile + one job + one project |
| 9 | `09-demo-flow.png` | Either a montage or a single shot showing the end-to-end pipeline state (progress bar at 100% in the sidebar) | Run all 5 stages once, then capture the Dashboard |

## Tips

* Use the browser's built-in screenshot tool (Cmd-Shift-4 on macOS, Win-Shift-S on Windows) so the cursor isn't captured.
* Aim for **1280×800 or larger** so text is legible when the report is printed.
* PNG is preferred over JPEG — text edges stay crisp.
* The report inlines screenshots via `![caption](docs/screenshots/<file>.png)` lines, so just dropping the files here with the right names is enough.

## Optional — animated GIF of the CSP run

Tools like [Kap](https://getkap.co/) (macOS) or [ScreenToGif](https://www.screentogif.com/) (Windows) can record the CSP visualizer playing. Save as `csp-animation.gif` in this folder and add a reference to it in `PROJECT_REPORT.md` Section 4.7 if you'd like.
