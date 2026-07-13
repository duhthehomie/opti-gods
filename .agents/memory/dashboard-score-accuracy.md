---
name: Dashboard 100% score accuracy
description: How the optimization score gates 100% behind script confirmation to prevent false 100% from just clicking Boost.
---

**Rule:** The score ring shows `displayScore`, not raw `scorePercent`. `displayScore = scorePercent === 100 && !scriptRan ? 99 : scorePercent`.

**Why:** Clicking "Boost My Score" enables all tweaks in-app state instantly, which would hit 100% without the user ever running the .bat. leaq explicitly requested 100% only shows after the script is actually run.

**How to apply:**
- `scriptRan` state initialized from `localStorage.getItem("og_script_ran") === "true"`
- `confirmScriptRan()` sets both state and localStorage
- At scorePercent===100 && !scriptRan: amber text link in score description + amber "I've Run the Script" button in CTA area
- All JSX uses `displayScore` for ring strokeDasharray, percentage label, tier badges, border glow, and progress bar — never raw `scorePercent`
- Only exception: `scorePercent === 100 && !scriptRan` conditional itself (detecting the unconfirmed-100% state)
