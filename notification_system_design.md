# Stage 1

## Priority Inbox — Notification System Design

---

## Problem Statement

The campus notifications app generates a high volume of notifications across three types:
- **Placement** — Job/internship opportunities
- **Result** — Academic results, evaluations
- **Event** — Campus events, fests, announcements

Users lose track of important notifications due to the sheer volume. The goal is to build a **Priority Inbox** that always surfaces the top `N` most important *unread* notifications first, in real time.

---

## Approach & Algorithm

### Scoring Model

Each notification receives a **priority score** computed as:

```
score = TYPE_WEIGHT × exp(−λ × ageInMinutes)
```

| Factor | Detail |
|---|---|
| `TYPE_WEIGHT` | Placement = **3**, Result = **2**, Event = **1** |
| `exp(−λ × age)` | Exponential recency decay; λ = 0.001 per minute |
| `ageInMinutes` | `(now − Timestamp) / 60_000 ms` |

**Why exponential decay?**
- It models diminishing relevance of older notifications naturally.
- With λ = 0.001, a notification loses ~6% of its recency score per hour — slow enough to keep important older placements relevant, fast enough for events to fade.
- Unlike hard cutoffs (e.g. "only show last 24h"), this is **continuous** and requires no arbitrary thresholds.

**Why type weights?**
- A placement (career-critical) must outrank an event even if the event is newer.
- Weights encode domain priority: Placement > Result > Event.

**Combined effect:**
A Placement notification from 10 minutes ago scores `3 × exp(−0.001 × 10) ≈ 2.97`, while an Event from 1 minute ago scores `1 × exp(−0.001 × 1) ≈ 0.999`. The Placement wins — correctly.

---

## Data Structure: Min-Heap of Size N

### Why a Min-Heap?

| Operation | Array + Sort | Min-Heap (size N) |
|---|---|---|
| Insert new notification | O(M log M) | **O(log N)** |
| Get top N | O(M log M) | **O(N log N)** |
| Memory | O(M) — all M | **O(N)** — bounded |

M = total notifications (can be thousands). N = 10–20. The heap is dramatically more efficient.

### How it works

```
For each incoming notification:
  1. Compute score
  2. If heap.size < N  →  push directly
  3. Else if score > heap.min  →  evict minimum, push new
  4. Output: heap.toSortedArray() descending by score
```

The heap's **minimum is always at index 0**, acting as the "eviction candidate" — the weakest element currently in the top N. A new notification only enters if it beats the weakest.

### Handling new notifications in real time

As notifications keep arriving:
- Each update is **O(log N)**, independent of total message volume.
- No full re-sort ever needed.
- Memory stays bounded at exactly N items.

This design scales to millions of notifications without degradation.

---

## Why Not a Database Query?

Per the problem statement, DB queries are not expected. The Min-Heap approach is a **pure in-memory algorithm** that:
- Requires no database
- Works with notifications fetched from the API in one shot
- Can be plugged into a streaming pipeline (e.g. WebSocket / Kafka) by simply calling the insert logic per event

---

## Project Structure

```
notification_app_be/
├── priorityInbox.js       # Core algorithm + CLI runner
└── package.json

notification_app_fe/
├── src/
│   ├── pages/
│   │   ├── AllNotifications.jsx
│   │   └── PriorityInbox.jsx
│   ├── components/
│   │   ├── NotificationCard.jsx
│   │   ├── FilterBar.jsx
│   │   └── Navbar.jsx
│   ├── context/
│   │   └── NotificationContext.jsx
│   ├── hooks/
│   │   └── useNotifications.js
│   └── utils/
│       └── priority.js        # Shared scoring logic (mirrors BE)
├── App.jsx
├── main.jsx
└── package.json

notification_system_design.md  ← this file
```

---

## Running Stage 1

```bash
cd notification_app_be

# Show top 10 (mock data)
node priorityInbox.js

# Show top 15
node priorityInbox.js --top 15

# Use live API with Bearer token
node priorityInbox.js --top 10 --token <your_bearer_token>
```

---

## Sample Output

```
╔══════════════════════════════════════════════════════════════╗
║         PRIORITY INBOX — Top 10 Notifications               ║
╚══════════════════════════════════════════════════════════════╝

🥇  [💼 Placement ]  Score: 2.970446  |  CSX Corporation hiring         |  2026-04-22 17:51:18
       ID: b283218f-ea5a-4b7c-93a9-1f2f240d64b0

🥈  [💼 Placement ]  Score: 2.965502  |  Google hiring                  |  2026-04-22 17:49:40
       ID: 8a7412bd-6065-4d09-8501-a37f11cc848b

🥉  [💼 Placement ]  Score: 2.963432  |  Microsoft hiring drive          |  2026-04-22 17:49:20
       ID: fa1234bc-aaaa-bbbb-cccc-ddddeeeeffffaa

4.  [📊 Result    ]  Score: 1.979963  |  mid-sem                        |  2026-04-22 17:51:30
       ID: d146095a-0d86-4a34-9e69-3900a14576bc
...
```

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Min-Heap over sorted array | O(log N) insert vs O(M log M) re-sort |
| Exponential decay over linear | Smooth, continuous, no arbitrary cutoffs |
| Combined score (type × recency) | Domain priority + freshness in one scalar |
| Bounded heap of size N | Memory efficient, stream-friendly |
| Pure JS, no libraries | Zero dependencies, portable, matches backend skill stack |
