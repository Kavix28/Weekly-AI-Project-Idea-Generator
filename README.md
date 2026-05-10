# Weekly AI Project Idea Generator — Complete Workflow Documentation

**Workflow ID:** `qcXogByfl67mjgO0`
**Status:** Active
**n8n URL:** http://localhost:5678/workflow/qcXogByfl67mjgO0

---

## What This Does

Every Monday and Thursday at 08:00 AM (or on-demand via Telegram), this workflow:

1. Searches 7 parallel sources for trending developer projects
2. Generates 15 unique project ideas using Groq LLaMA-3.3-70b
3. Rates all 15 ideas in one batch call using LLaMA-3.1-8b (independent evaluator)
4. Keeps only the top 5 highest-scoring ideas
5. Saves them to Notion, Google Sheets, and sends a full HTML email report
6. Delivers 7 Telegram messages (header + 5 ideas + footer)

---

## Architecture Overview

```
TRIGGERS (3)
├── Schedule Trigger     → Every Mon + Thu 08:00 AM
├── Manual Trigger       → Test runs from n8n UI
└── Telegram Trigger     → Any message to @kavix28bot
         ↓
SET WEEKLY CONTEXT
         ↓
RESEARCH PHASE — 7 parallel sources
├── Serper GitHub Trending    (Google search → github.com)
├── Serper HackerNews         (Google search → news.ycombinator.com)
├── Serper Product Hunt       (Google search → producthunt.com)
├── Tavily AI Trends          (Deep web research — AI tools)
├── Tavily Underrated         (Deep web research — hidden gems)
├── Jina GitHub Daily         (Live scrape → github.com/trending)
└── Jina GitHub Weekly        (Live scrape → github.com/trending?since=weekly)
         ↓
MERGE ALL RESEARCH (7 → 1)
         ↓
EXTRACT AND CLEAN RESEARCH
         ↓
GROQ LLAMA-3.3-70b → GENERATE 15 IDEAS
         ↓
PARSE GROQ OUTPUT (1 item → 15 items)
         ↓
COLLECT ALL IDEAS (15 items → 1 item for batch rating)
         ↓
RATE ALL IDEAS — LLaMA-3.1-8b (1 API call rates all 15)
         ↓
MERGE RATINGS INTO IDEAS (1 item → 15 items with scores)
         ↓
SORT BY FINAL SCORE (descending)
         ↓
KEEP TOP 5 ONLY
         ↓
ADD RANK NUMBERS (rank 1–5)
         ↓
OUTPUT PHASE — 4 parallel branches
├── Save to Notion           (5 rich database pages)
├── Save to Google Sheets    (5 rows → ProjectIdeas tab)
├── Build Email HTML         → Send Weekly Email (Gmail)
│                              → Log to WeeklyLog Sheet
└── Prepare Telegram Messages (7 items: header + 5 ideas + footer)
                               → Telegram Send Each Idea (7 messages)
                               → Aggregate Telegram Output (7 → 1)
                               → Log to WeeklyLog Sheet
```

---

## Node-by-Node Reference

### TRIGGERS

#### 1. Schedule Trigger
- **Type:** `n8n-nodes-base.scheduleTrigger`
- **Schedule:** `0 8 * * 1` (Monday 08:00) + `0 8 * * 4` (Thursday 08:00)
- **Purpose:** Automatic weekly runs

#### 2. Manual Trigger
- **Type:** `n8n-nodes-base.manualTrigger`
- **Purpose:** Test runs from the n8n UI

#### 3. Telegram — Receive Message
- **Type:** `n8n-nodes-base.telegramTrigger`
- **Credential:** Telegram Bot (`tg-bot-mn7pk5v8`)
- **Updates:** `message`
- **Purpose:** On-demand runs triggered by sending any message to @kavix28bot
- **Note:** Requires `telegram_poller.js` running alongside n8n (localhost limitation)

---

### SETUP

#### 4. Send Acknowledgement *(Telegram path only)*
- **Type:** `n8n-nodes-base.telegram`
- **Credential:** Telegram Bot
- **Operation:** sendMessage
- **chatId:** `={{ $('Telegram — Receive Message').item.json.message.chat.id }}`
- **Text:** Instant "pipeline activated" confirmation message
- **Purpose:** Immediate feedback so user knows the bot received their message

#### 5. Set Search Context
- **Type:** `n8n-nodes-base.set`
- **Receives from:** Schedule Trigger, Manual Trigger, Send Acknowledgement
- **Sets these fields:**
  | Field | Value |
  |---|---|
  | `week_number` | Current ISO week number |
  | `date_generated` | Today's date (YYYY-MM-DD) |
  | `current_year` | Current year |
  | `week_label` | `"Week 12 — 2026-03-26"` |
  | `run_start` | ISO timestamp |
  | `developer_profile` | Skills summary for prompt context |
  | `telegram_chat_id` | `1673048293` |
  | `trigger_source` | `"scheduled"` |

---

### RESEARCH PHASE (7 parallel nodes)

All 7 nodes run simultaneously after Set Search Context.

#### 6. Serper GitHub Trending
- **Type:** HTTP Request
- **Credential:** Serper API (`uyQQKQQnrwPGdyEO`)
- **URL:** `https://google.serper.dev/search`
- **Query:** `site:github.com trending {year} AI automation agent stars`
- **Results:** 10, filtered to last week (`tbs: qdr:w`)

#### 7. Serper HackerNews
- **Type:** HTTP Request
- **Credential:** Serper API
- **URL:** `https://google.serper.dev/search`
- **Query:** `site:news.ycombinator.com Show HN project {year}`
- **Results:** 10, filtered to last week

#### 8. Tavily AI Trends
- **Type:** HTTP Request
- **Credential:** Tavily API (`hYgF4f7XJknd4Fjg`)
- **URL:** `https://api.tavily.com/search`
- **Query:** Trending AI developer projects this week
- **Search depth:** advanced, `include_answer: true`, max 10 results
- **Domains:** github.com, news.ycombinator.com, producthunt.com, dev.to, reddit.com, medium.com

#### 9. Tavily Underrated
- **Type:** HTTP Request
- **Credential:** Tavily API
- **URL:** `https://api.tavily.com/search`
- **Query:** Underrated hidden gem developer projects GitHub automation AI
- **Search depth:** advanced, max 8 results

#### 10. Serper Product Hunt
- **Type:** HTTP Request
- **Credential:** Serper API
- **URL:** `https://google.serper.dev/search`
- **Query:** `site:producthunt.com developer tools AI automation trending this week`

#### 11. Jina GitHub Daily
- **Type:** HTTP Request
- **Credential:** Jina AI API (`3c3LaRtoaIHsHK6I`)
- **URL:** `https://r.jina.ai/https://github.com/trending`
- **Returns:** Live markdown scrape of GitHub trending (today)

#### 12. Jina GitHub Weekly
- **Type:** HTTP Request
- **Credential:** Jina AI API
- **URL:** `https://r.jina.ai/https://github.com/trending?since=weekly`
- **Returns:** Live markdown scrape of GitHub trending (this week)

---

### PROCESSING PHASE

#### 13. Merge All Research
- **Type:** `n8n-nodes-base.merge`
- **Mode:** `append`
- **Inputs:** All 7 research nodes
- **Output:** 7 items combined into one stream

#### 14. Extract and Clean Research
- **Type:** Code (JavaScript)
- **Input:** 7 merged items
- **Output:** 1 item with `combined_research` string (max 11,500 chars)
- **Logic:**
  - Extracts `organic` results from Serper responses
  - Extracts `answer` and `results` from Tavily responses
  - Extracts `content` from Jina scrapes
  - Labels each section, truncates to fit LLM context window
  - Also outputs: `research_length`, `sources_combined`, `date`, `week_label`

#### 15. Groq Generate 15 Ideas
- **Type:** HTTP Request
- **Credential:** Groq API (`q2bqby7vhOdnFcKw`)
- **URL:** `https://api.groq.com/openai/v1/chat/completions`
- **Model:** `llama-3.3-70b-versatile`
- **Temperature:** 0.9 (high creativity)
- **Max tokens:** 4000
- **System prompt:** Senior software architect persona, knows what gets GitHub stars
- **User prompt:** Injects `combined_research`, requests 15 ideas as JSON
- **Output schema per idea:**
  ```json
  {
    "id": 1,
    "project_name": "string",
    "category": "trending|underrated",
    "original_inspiration": "string",
    "unique_modification": "string",
    "why_nobody_built_this": "string",
    "core_features": ["string"],
    "tech_stack": ["string"],
    "github_topics": ["string"],
    "target_audience": "string",
    "pain_point_solved": "string",
    "time_to_build_hours": 24,
    "difficulty": "Easy|Medium|Hard",
    "monetisation_potential": "string",
    "viral_hook": "string",
    "readme_headline": "string",
    "cv_value": 8,
    "trending_score": 7
  }
  ```

#### 16. Parse Groq Output
- **Type:** Code (JavaScript)
- **Input:** 1 item (raw Groq response)
- **Output:** 15 items (one per idea)
- **Logic:** Strips markdown fences, parses JSON, handles parse errors gracefully, adds `date`, `week`, `week_label` to each item

#### 17. Collect All Ideas
- **Type:** Code (JavaScript)
- **Input:** 15 items
- **Output:** 1 item containing:
  - `ideas_json` — all 15 ideas serialised as JSON string
  - `ideas_count` — 15
  - `rating_prompt` — compact summary of all 15 ideas for the rating prompt

#### 18. Rate All Ideas
- **Type:** HTTP Request
- **Credential:** Groq API (`0fz1u4bLdd8BkZ1r`)
- **URL:** `https://api.groq.com/openai/v1/chat/completions`
- **Model:** `llama-3.1-8b-instant` *(different from generator — independent perspective)*
- **Temperature:** 0.3 (strict, consistent)
- **Max tokens:** 2500
- **Purpose:** Rates ALL 15 ideas in ONE API call (avoids rate limits)
- **Scoring formula:** `final_score = (impact×0.4) + (uniqueness×0.3) + (stars×0.3)`
- **Verdicts:** BUILD IT (≥7.0) / MAYBE (5.0–6.9) / SKIP IT (<5.0)
- **Output:** JSON array of 15 rating objects

#### 19. Merge Ratings Into Ideas
- **Type:** Code (JavaScript)
- **Input:** 1 item (Rate All Ideas response + ideas_json from Collect All Ideas)
- **Output:** 15 items with ratings merged in
- **Fields added per idea:**
  - `real_world_impact` (1–10)
  - `uniqueness_score` (1–10)
  - `star_potential` (1–10)
  - `final_score` (3.0–9.0)
  - `rating_reasoning` (2–3 sentences)
  - `biggest_strength`
  - `biggest_weakness`
  - `verdict` (BUILD IT / MAYBE / SKIP IT)
  - `rated: true`
  - `rating_model: "llama-3.1-8b-instant"`

#### 20. Sort by Final Score
- **Type:** `n8n-nodes-base.sort`
- **Field:** `final_score`
- **Order:** Descending

#### 21. Keep Top 5 Only
- **Type:** `n8n-nodes-base.limit`
- **Max items:** 5

#### 22. Add Rank Numbers
- **Type:** Code (JavaScript)
- **Adds:** `rank` (1–5), `rank_label` (`"#1 of 5"`), `is_top_pick` (true for rank 1)

---

### OUTPUT PHASE (4 parallel branches from Add Rank Numbers)

#### Branch A — Notion

#### 23. Save to Notion
- **Type:** `n8n-nodes-base.notion`
- **Credential:** Notion API (`bEJFf9aSi9I7Lsov`)
- **Operation:** Create database page
- **Database:** `3273baec-7aae-81ed-890f-e02578633613`
- **Properties saved:** Project Name, Week, Date Generated, Rank, Impact Score, Uniqueness Score, Star Potential, Final Score, CV Value, Trending Score, Difficulty, Time to Build, Target Audience, Unique Modification, Pain Point Solved, Impact Reasoning, Biggest Strength, Biggest Weakness, Monetisation, GitHub Topics, Viral Hook, Verdict, Status, Tech Stack, Original Inspiration

---

#### Branch B — Google Sheets

#### 24. Save to Google Sheets
- **Type:** `n8n-nodes-base.googleSheets`
- **Credential:** Google Sheets account (`v0bzsG17QwHLfJQK`)
- **Spreadsheet:** `1NUwfMYpOXuLI8ysTM0_siFxIL-jgNUGjFAD5AH2U-MY`
- **Tab:** `ProjectIdeas`
- **Operation:** Append
- **onError:** `continueRegularOutput` (pipeline continues even if auth fails)
- **Columns:** Week, Date, Rank, Project Name, Original Inspiration, Unique Modification, Tech Stack, Impact Score, Uniqueness, Star Potential, Final Score, CV Value, Difficulty, Time to Build, Audience, Monetisation, Verdict, Viral Hook, Biggest Strength, Biggest Weakness, Rating Reasoning, GitHub Topics, Status

---

#### Branch C — Email

#### 25. Build Email HTML
- **Type:** Code (JavaScript)
- **Input:** 5 ranked ideas
- **Output:** 1 item with:
  - `email_body` — full HTML with 5 styled idea cards
  - `ideas_count`, `build_it_count`, `maybe_count`
  - `top_project`, `top_score`, `top_verdict`, `avg_score`
  - `week_label`, `date`
- **Email design:** Dark header, colour-coded verdict badges, score bars, tech stack table, AI evaluator section

#### 26. Send Weekly Email
- **Type:** `n8n-nodes-base.gmail`
- **Credential:** Gmail account 2 (`ox8SCPukBXJu947X`)
- **To:** `kavyakapoor28i@gmail.com`
- **Subject:** `🚀 Week X — Top 5 Project Ideas (N rated BUILD IT, avg X.X/10)`
- **Type:** HTML
- **onError:** `continueRegularOutput`

#### 27. Log to WeeklyLog Sheet *(receives from both Email and Telegram branches)*
- **Type:** `n8n-nodes-base.googleSheets`
- **Credential:** Google Sheets account
- **Tab:** `WeeklyLog`
- **Operation:** Append
- **Columns:** Week, Date, Ideas Generated, Top Project, Top Score, Email Sent, Avg Score, Build It Count
- **onError:** `continueRegularOutput`

---

#### Branch D — Telegram

#### 28. Prepare Telegram Messages
- **Type:** Code (JavaScript)
- **Input:** 5 ranked ideas
- **Output:** 7 items (header + 5 idea cards + footer)
- **Message 1 (header):** Run summary — week, top pick, score, sources
- **Messages 2–6 (ideas):** Per-idea card with score bar, twist, hook, stack, difficulty, CV value, AI evaluator verdict
- **Message 7 (footer):** Delivery confirmation + next run times + "Send Give" CTA
- **chat_id:** Hardcoded to `1673048293`

#### 29. Telegram — Send Each Idea
- **Type:** `n8n-nodes-base.telegram`
- **Credential:** Telegram Bot (`tg-bot-mn7pk5v8`)
- **Operation:** sendMessage
- **chatId:** `={{ $json.chat_id }}`
- **Text:** `={{ $json.message_text }}`
- **Parse mode:** Markdown
- **Processes:** All 7 items → 7 sequential Telegram messages

#### 30. Aggregate Telegram Output
- **Type:** `n8n-nodes-base.aggregate`
- **Mode:** Aggregate all item data
- **Purpose:** Collapses 7 items back to 1 before WeeklyLog

---

## Credentials Required

| Service | Credential Name | Type | Used By |
|---|---|---|---|
| Groq | Groq API | httpHeaderAuth | Generate 15 Ideas, Rate All Ideas |
| Serper | Serper API | httpHeaderAuth | GitHub Trending, HackerNews, Product Hunt |
| Tavily | Tavily API | httpHeaderAuth | AI Trends, Underrated |
| Jina AI | Jina AI API | httpHeaderAuth | GitHub Daily, GitHub Weekly |
| Notion | Notion API | notionApi | Save to Notion |
| Google | Google Sheets account | googleSheetsOAuth2Api | Save to Sheets, WeeklyLog |
| Gmail | Gmail account 2 | gmailOAuth2 | Send Weekly Email |
| Telegram | Telegram Bot | telegramApi | Receive Message, Send messages |

---

## Telegram Bot Setup

**Bot:** @kavix28bot
**Chat ID:** 1673048293
**Token:** `8578602652:AAFG1Fcw3HUpRgk-eyI3btPgev3Gaq1YmFo`

### How Telegram Works (localhost limitation)

Telegram requires HTTPS for webhooks. Since n8n runs on `http://localhost`, a polling bridge script handles message reception:

```bash
node telegram_poller.js
```

This script:
- Polls Telegram every 25 seconds for new messages
- Routes commands to the correct action
- Triggers the n8n workflow via the REST API
- Has a 2-minute cooldown to prevent duplicate runs
- Skips all messages that arrived before it started

### Commands

| Message | Action |
|---|---|
| `Give` | Triggers full pipeline → 7 Telegram messages in ~90 seconds |
| `/status` | Instant status reply |
| `/help` | Instant help reply |
| Anything else | "Send Give to generate ideas" reply |

---

## Output Destinations

### Notion Database
- **ID:** `3273baec-7aae-81ed-890f-e02578633613`
- **Name:** Weekly Project Ideas — AI Generator
- **5 pages created per run**, each with 25+ properties

### Google Sheets
- **Spreadsheet ID:** `1NUwfMYpOXuLI8ysTM0_siFxIL-jgNUGjFAD5AH2U-MY`
- **ProjectIdeas tab:** 5 rows appended per run (23 columns)
- **WeeklyLog tab:** 1 summary row per run (8 columns)

### Email
- **To:** kavyakapoor28i@gmail.com
- **Format:** Full HTML with 5 styled idea cards
- **Sent via:** Gmail OAuth2

### Telegram
- **7 messages per run:**
  1. Header (run summary)
  2. Idea #1 (full card)
  3. Idea #2 (full card)
  4. Idea #3 (full card)
  5. Idea #4 (full card)
  6. Idea #5 (full card)
  7. Footer (next steps + schedule)

---

## Schedule

| Day | Time | Action |
|---|---|---|
| Every Monday | 08:00 AM | Full pipeline runs automatically |
| Every Thursday | 08:00 AM | Full pipeline runs automatically |
| Any time | On demand | Send `Give` to @kavix28bot |

---

## Scoring System

Each idea is rated by LLaMA-3.1-8b on three dimensions:

| Dimension | Weight | Description |
|---|---|---|
| Real-world impact | 40% | Does it solve a problem millions face daily? |
| Uniqueness | 30% | Has nobody built exactly this before? |
| Star potential | 30% | Could it realistically go viral on GitHub? |

**Formula:** `final_score = (impact × 0.4) + (uniqueness × 0.3) + (stars × 0.3)`

**Verdicts:**
- 🟢 **BUILD IT** — score ≥ 7.0
- 🟡 **MAYBE** — score 5.0–6.9
- 🔴 **SKIP IT** — score < 5.0

---

## How to Run

### Automatic
Just leave n8n running. It fires every Monday and Thursday at 08:00 AM.

### Manual (n8n UI)
1. Open http://localhost:5678/workflow/qcXogByfl67mjgO0
2. Click **Test workflow**

### Via Telegram
1. Make sure n8n is running
2. Run `node telegram_poller.js` in a terminal
3. Send `Give` to @kavix28bot

### Via Script
```bash
node run_main_workflow.js
```

---

## Error Handling

| Node | Behaviour on failure |
|---|---|
| Save to Google Sheets | `continueRegularOutput` — pipeline continues |
| Send Weekly Email | `continueRegularOutput` — pipeline continues |
| Log to WeeklyLog Sheet | `continueRegularOutput` — pipeline continues |
| All research nodes | `retryOnFail: true`, max 3 tries, 3s wait |
| Groq Generate | `retryOnFail: true`, max 3 tries, 5s wait |
| Rate All Ideas | `retryOnFail: true`, max 3 tries, 3s wait |

---

## File Reference

| File | Purpose |
|---|---|
| `telegram_poller.js` | Run alongside n8n to handle Telegram messages |
| `run_main_workflow.js` | Trigger a manual test run via script |
| `verify_scores85.js` | Inspect execution results and scores |
| `decrypt_creds.js` | Check credential token status |

---

*Generated: March 2026 | n8n version 2.6.3*
#   W e e k l y - A I - P r o j e c t - I d e a - G e n e r a t o r  
 