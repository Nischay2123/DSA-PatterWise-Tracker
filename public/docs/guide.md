# How to use DSA Tracker

DSA Tracker is a checklist for interview DSA practice that also makes you revise what you've solved, so it sticks. It holds 649 problems from six well-known lists, grouped by topic and pattern. This page explains every feature: what it means, how it works and how to use it.

Your progress is saved **in this browser only**. There's no account and no sync, so export a backup now and then (see [Your data](#your-data)).

## Quick start

1. **Pick a sheet.** Open **Settings → Sheet** and choose the list you're working through, for example Striver A2Z, NeetCode 150 or Blind 75. Everything else follows this choice.
2. **Press Continue** on the dashboard. It takes you to the next problem worth doing.
3. **Solve it** on LeetCode, GeeksforGeeks or TakeUForward (the links are on the row), then **tick the checkbox** and say how it went: clean, took a hint, or saw the solution.
4. **Come back when reviews are due.** A 🔔 banner tells you which questions to re-solve today.
5. **Revise topics.** Once you've done 75% of a topic, the **Revision** page schedules a short quiz on it.

## Sheets

A *sheet* is the list of problems you're working through. Choose it in **Settings → Sheet**.

| Sheet | What it is |
|---|---|
| **Striver A2Z** (default) | The original 467-problem Striver A2Z sheet this tracker was built from. |
| **Full syllabus** | All 649 problems from every list. |
| **NeetCode 150 / NeetCode 250** | The NeetCode lists. |
| **LeetCode Top 150** | LeetCode's Top Interview 150. |
| **LeetCode 75** | LeetCode's 75-question study plan. |
| **Blind 75** | The classic 75-question list. |
| **Skip the hard ones / Most asked / Hard practice** | Slices of the full syllabus: Easy and Medium only, High or Very High interview frequency only, or Hard only. |
| **Custom** | Pick an interview-frequency floor and the difficulties you want. |

Under each option Settings shows how many problems it holds, how many you've solved, how many topics revision will cover, and any topics "dropped" because the sheet leaves them with fewer than 3 problems.

**What the sheet controls:**

- the progress figure in the sidebar and the **x/y · %** pill at the top right;
- which problems the list shows, plus the counts on every topic and pattern;
- the Pattern, Importance and Interview-frequency filter options;
- the Breakdown and the Topic map;
- which reviews count as due;
- what topic revision measures and quizzes you on.

To see problems outside your sheet without changing it, turn off the **"‹sheet› only"** toggle in the filter bar. Rows that are in your sheet then get a coloured left edge.

Switching sheet never deletes progress. A problem you solved stays solved under every sheet that includes it.

## The dashboard

- **Up next / Continue.** The first unsolved problem in the current list whose prerequisite topics are done (see [Prerequisites](#prerequisites-and-locks)). It respects your filters: filter to one pattern and Continue stays in that pattern.
- **Day streak, solved today, in this range.** Counts from your solve history.
- **Topic map.** A diagram of which topic to finish before which. Green means finished, yellow means started, and the numbers are solved/total in your sheet. Click the heading to open it.
- **Activity.** A GitHub-style calendar of the days you solved or revised. Use the arrows to move between years.
- **Breakdown.** Solved/total in your sheet by difficulty, importance, interview frequency and source list, plus how many problems you've starred.

## The problem list

Problems are grouped by **topic** (Arrays, Graphs…) and, inside each topic, by **pattern** (Two Pointers, Sliding Window…). Click a heading to expand it.

**Each row shows:**

- **E / M / H**: difficulty.
- **The title**: links to the problem.
- **LC · GFG · TUF**: the same problem on other sites, when there is more than one link.
- **Premium**: needs LeetCode Premium.
- **Source tags** (A2Z, NC150, NC250, B75, LC150, LC75): which lists include this problem.
- **🔒 Topic name**: this problem builds on a topic you haven't finished yet (see [locks](#prerequisites-and-locks)).
- **review in 3d / mastered / 🔔 Review due**: its per-question review schedule (see [Reviews](#per-question-reviews)).
- **▶ and 📖 icons**: a video solution and a written article, when available.
- **★**: star it to come back to later.
- **⌄**: expand it for details, your solution, notes and mistakes.

**In the expanded details:**

- estimated time, importance, interview frequency and the original Striver step;
- the next review date;
- links to the topic's pattern notes (they open in a new tab);
- **Solution**: your approach, pseudocode and code;
- **Notes**: six short fields (approach, key insight, common mistake, complexity, edge cases, reminder);
- **Mistakes**: your own list of things you got wrong, to read before re-solving.

Each **pattern** also has a **Fundamentals** button that lists the core ideas of that pattern, and a 📖 icon that opens its notes.

## Filters

The bar at the top of the list. On a phone, tap **Filters** to open it.

- **Search**: matches problem titles, topics and patterns.
- **Difficulty**: All, Easy, Medium or Hard.
- **Pattern**: only the patterns in your sheet, grouped by topic, each with its number of problems.
- **Status**: *To do* (unsolved), *Solved*, *Starred*, or *Due for review*.
- **Importance** and **Interview freq**: only the values your sheet actually has.
- **‹sheet› only**: on by default. Turn it off to also see problems outside your sheet.

The badge on **Filters** counts how many filters are active. When nothing matches, use **Clear filters**.

## Marking a problem done

Tick the checkbox. Unticking is always allowed.

**The completion gate.** By default, ticking a problem for the first time asks you to *show your work*: an approach plus pseudocode or code.

- **Without an API key** it only checks that you wrote something.
- **With an API key** (see [Settings](#settings)) your solution is graded first, and needs 70/100 to pass. If it passes, the tick lands and your six note fields are written for you from your solution. If grading fails, you see why and can try again. If the provider can't be reached, you decide: **Mark done anyway**.

The gate can be turned off in **Settings → Completion rules**.

**How did it go?** Every solve records one of:

- **Clean**: solved without help.
- **Took a hint**: needed a nudge.
- **Saw the solution**: looked at the answer.

The completion panel asks before the tick. A plain tick records *clean* and then offers the choice right away, so you can correct it.

## Per-question reviews

A light spaced-repetition schedule for each question you solve, so you can still do it next month.

**The schedule.** After a solve, the question comes back after **1 day**, then **3, 7, 15, 30 and 60 days**.

**Doing a review.** When a review is due, re-solve the question *without looking at your old code*. Then click **🔔 Review due** on the row and choose how it went:

| You choose | What happens |
|---|---|
| **Clean** | Moves up to the next, longer interval. |
| **Took a hint** | Repeats the same interval. |
| **Saw the solution** | Starts again with a 1-day review. |

Passing the 60-day review **cleanly** makes the question **mastered**, and it stops coming back. A hint or the solution on the last step never counts as mastery.

**Where due reviews appear:**

- a banner on the dashboard with **Review now**, which shows only the due questions;
- a **Reviews due** count in the sidebar;
- the number in the browser tab title, e.g. *(3) DSA Tracker*;
- the **Status → Due for review** filter.

Only questions in your current sheet count.

**Questions solved before reviews existed** aren't scheduled automatically, so you don't start with a pile of reviews. To add one, expand it and choose an outcome under **Start spaced reviews**. You can also review any solved question early the same way.

**Unticking** a question clears its schedule.

## Topic revision

Separate from per-question reviews: a short graded quiz on a whole **topic**, so you remember the ideas and not just the answers.

**When it unlocks.** A topic becomes revisable at **75% solved** (counted within your sheet). From then on it's scheduled again after **7, 14, 30, 60 and 90 days**, each interval starting from your last pass.

**A session asks:**

- **4 fundamentals**: concept questions about the topic's patterns, e.g. *"When does sliding window NOT apply?"*;
- **3 of your solved problems**, recalled from memory: approach, pseudocode, complexity and edge cases;
- how confident you felt on each.

**Grading.** With an API key the answers are graded, and you need 70/100 to pass. A core concept scoring very low fails the session on its own. Concepts you were weak on are asked more often next time. Without a key you can mark the revision as done yourself; it's recorded as *not graded*.

**States on the Revision page:**

| State | Meaning |
|---|---|
| Not started / In progress | Below 75% solved. |
| Revision scheduled | Your next revision date is in the future. |
| Revision due | It's time to revise this topic. |
| Revision failed | Your last attempt didn't pass. Try again. |
| Mastered | Three passed revisions and 100% of the topic solved. |

**Blocking.** While a topic's revision is due, you can't tick *new* problems in that topic until you revise it. This only applies when a grader is configured. Turn it off in **Settings → Completion rules**.

**Revise any time.** Once you've solved at least 3 problems in a topic, you can start a revision whenever you like from the topic's header or the Revision page.

The **Fundamentals** topic (language basics, pattern printing) is never revised or blocked.

## Prerequisites and locks

Topics are ordered as a build-up. For example, Binary Search comes after Arrays, and Graphs come after Trees and Heaps. The topic map shows the whole graph.

- A topic counts as **done** when you've solved **75%** of it in your sheet.
- A topic whose prerequisites aren't done shows **🔒 after Arrays** in its header.
- A problem that also builds on another unfinished topic shows a **🔒 topic** chip.

**A lock never stops you.** You can open, solve and tick any problem at any time. A lock only suggests a better order, and **Continue** follows that order. Fundamentals never locks anything.

Don't want them? Turn off **Settings → Completion rules → Show prerequisite locks**. The chips disappear and Continue simply goes to the next unsolved problem.

## Notes

**Notes** in the sidebar opens written study notes. From the problem list they open in a new tab, so you keep your place.

- **DSA patterns**: one note per topic, covering when to use each technique, Java templates, complexity and common pitfalls, with diagrams.
- **Java for DSA**: input/output, strings, collections, comparators and bit tricks.
- **Java core / OOP**: OOP, the JVM and memory, generics and exceptions, modern Java, multithreading.

You can also open notes from:

- the **Pattern notes** chips inside each topic;
- the 📖 icon on each pattern heading;
- the note links in a problem's expanded details.

These are reference notes. Your own per-problem notes live on each problem row.

## Your data

Everything is stored in this browser's local database. Clearing site data or switching browsers or devices loses it, unless you have a backup.

- **Export backup** (sidebar): downloads everything as a JSON file, including progress, solutions, notes, mistakes, review schedules, revision history and settings. Your API key is never included.
- **Import backup**: replaces your current data with a backup file. **Undo import** restores what you had just before.
- **Advanced — merge a backup** (bottom of the tracker page): combines a backup from another device with this one instead of replacing it. A problem solved in either copy stays solved, differing notes are kept side by side, and review schedules and revision history are combined.

## Settings

Open **Settings** from the sidebar.

- **Sheet**: which list you're working through (see [Sheets](#sheets)).
- **Evaluation provider**: choose Gemini or Groq, a model and your own API key, used to grade solutions and topic revisions. The key stays in this browser and is only ever sent to that provider. Use a key just for this app.
- **Theme** isn't in Settings: switch light, dark or system from the sidebar.
- **Completion rules**:
  - *Require pseudocode or code before marking a question done*: the completion gate.
  - *Block new completions in a topic while its revision is due*: the topic-revision block.
  - *Show prerequisite locks*: the 🔒 chips and the order Continue follows.

## FAQ

**Why does the top-right say 78/467 when there are 649 problems?** It counts your chosen sheet. Choose *Full syllabus* to count all 649.

**I solved something on another list. Is it lost when I switch sheets?** No. Progress belongs to the problem, not the sheet.

**A topic says "after Arrays". Can I still do it?** Yes. Locks are suggestions only.

**What's the difference between a review and a revision?** A *review* is re-solving one question on a 1-to-60-day schedule. A *revision* is a graded quiz on a whole topic once you've done 75% of it.

**Do I need an API key?** No. Without one, everything works except AI grading: the completion gate only checks that you wrote something, and you mark revisions as done yourself.
