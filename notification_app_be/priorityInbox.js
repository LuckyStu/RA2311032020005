/**
 * Priority Inbox - Campus Notifications Microservice (Stage 1)
 *
 * Strategy:
 *  - Each notification is scored by combining a TYPE WEIGHT and a RECENCY SCORE.
 *  - Type weights:  Placement = 3, Result = 2, Event = 1
 *  - Recency score: decays exponentially so newer notifications outrank older
 *    ones of the same type. Formula: exp(-λ * ageInMinutes) where λ = 0.001
 *    This means a notification loses ~6% of its recency score per hour, giving
 *    a smooth continuous ranking that favours freshness without ignoring type.
 *  - Final score = TYPE_WEIGHT * RECENCY_SCORE
 *
 * Maintaining top-N efficiently as new notifications arrive:
 *  - We use a MIN-HEAP of size N so every insert / evict is O(log N).
 *  - When a new notification arrives we compute its score and:
 *      • If the heap has < N items → push directly.
 *      • Else if score > heap.min → replace the minimum.
 *  - This keeps memory bounded at N and each update is O(log N) regardless of
 *    total volume.
 *
 * Usage:
 *   node priorityInbox.js                   (demo with built-in mock data)
 *   node priorityInbox.js --top 5            (show top 5)
 *   node priorityInbox.js --token <bearer>   (fetch live from API)
 */

const https = require("https");
const http = require("http");

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_WEIGHTS = {
  Placement: 3,
  Result: 2,
  Event: 1,
};

const DECAY_LAMBDA = 0.001; // per minute

const NOTIFICATIONS_API =
  "http://20.207.122.201/evaluation-service/notifications";

// ─── Min-Heap Implementation ─────────────────────────────────────────────────

class MinHeap {
  constructor() {
    this._data = [];
  }

  get size() {
    return this._data.length;
  }

  peek() {
    return this._data[0] ?? null;
  }

  push(item) {
    this._data.push(item);
    this._bubbleUp(this._data.length - 1);
  }

  pop() {
    if (!this._data.length) return null;
    const top = this._data[0];
    const last = this._data.pop();
    if (this._data.length) {
      this._data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  toSortedArray() {
    // Return a descending-score copy without mutating the heap
    return [...this._data].sort((a, b) => b.score - a.score);
  }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this._data[parent].score <= this._data[i].score) break;
      [this._data[parent], this._data[i]] = [this._data[i], this._data[parent]];
      i = parent;
    }
  }

  _sinkDown(i) {
    const n = this._data.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && this._data[l].score < this._data[smallest].score)
        smallest = l;
      if (r < n && this._data[r].score < this._data[smallest].score)
        smallest = r;
      if (smallest === i) break;
      [this._data[smallest], this._data[i]] = [
        this._data[i],
        this._data[smallest],
      ];
      i = smallest;
    }
  }
}

// ─── Core Logic ──────────────────────────────────────────────────────────────

/**
 * Calculate the priority score for a single notification.
 * @param {{ Type: string, Timestamp: string }} notification
 * @returns {number}
 */
function scoreNotification(notification) {
  const typeWeight = TYPE_WEIGHTS[notification.Type] ?? 1;
  const ts = new Date(notification.Timestamp).getTime();
  const ageInMinutes = (Date.now() - ts) / 60_000;
  const recencyScore = Math.exp(-DECAY_LAMBDA * ageInMinutes);
  return typeWeight * recencyScore;
}

/**
 * Get the top-N priority notifications from an array using a Min-Heap.
 * This runs in O(M log N) time where M = total notifications.
 *
 * @param {Array} notifications  - Raw notification objects from API
 * @param {number} n             - How many top notifications to return
 * @returns {Array}              - Top N notifications, sorted best-first
 */
function getTopNPriorityNotifications(notifications, n = 10) {
  if (!Array.isArray(notifications) || notifications.length === 0) return [];
  if (n <= 0) return [];

  const heap = new MinHeap();

  for (const notif of notifications) {
    const score = scoreNotification(notif);
    const entry = { score, notif };

    if (heap.size < n) {
      heap.push(entry);
    } else if (score > heap.peek().score) {
      heap.pop();
      heap.push(entry);
    }
  }

  return heap.toSortedArray().map(({ notif, score }) => ({ ...notif, score }));
}

// ─── Live API helpers ─────────────────────────────────────────────────────────

function fetchNotifications(token) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { Authorization: `Bearer ${token}` },
    };
    const req = http.get(NOTIFICATIONS_API, options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed.notifications ?? []);
        } catch (e) {
          reject(new Error("Failed to parse API response"));
        }
      });
    });
    req.on("error", reject);
  });
}

// ─── Demo / CLI entry point ───────────────────────────────────────────────────

const MOCK_NOTIFICATIONS = [
  {
    ID: "d146095a-0d86-4a34-9e69-3900a14576bc",
    Type: "Result",
    Message: "mid-sem",
    Timestamp: "2026-04-22 17:51:30",
  },
  {
    ID: "b283218f-ea5a-4b7c-93a9-1f2f240d64b0",
    Type: "Placement",
    Message: "CSX Corporation hiring",
    Timestamp: "2026-04-22 17:51:18",
  },
  {
    ID: "81589ada-0ad3-4f77-9554-f52fb558e09d",
    Type: "Event",
    Message: "farewell",
    Timestamp: "2026-04-22 17:51:06",
  },
  {
    ID: "0005513a-142b-4bbc-8678-eefec65e1ede",
    Type: "Result",
    Message: "mid-sem",
    Timestamp: "2026-04-22 17:50:54",
  },
  {
    ID: "ea836726-c25e-4f21-a72f-544a6af8a37f",
    Type: "Result",
    Message: "project-review",
    Timestamp: "2026-04-22 17:50:42",
  },
  {
    ID: "003cb427-8fc6-47f7-bb00-be228f6b0d2c",
    Type: "Result",
    Message: "external",
    Timestamp: "2026-04-22 17:50:30",
  },
  {
    ID: "e5c4ff20-31bf-4d40-8f02-72fda59e8918",
    Type: "Result",
    Message: "project-review",
    Timestamp: "2026-04-22 17:50:18",
  },
  {
    ID: "1cfce5ee-ad37-4894-8946-d707627176a5",
    Type: "Event",
    Message: "tech-fest",
    Timestamp: "2026-04-22 17:50:06",
  },
  {
    ID: "cf2885a6-45ac-4ba0-b548-6e9e9d4c52c8",
    Type: "Result",
    Message: "project-review",
    Timestamp: "2026-04-22 17:49:54",
  },
  {
    ID: "8a7412bd-6065-4d09-8501-a37f11cc848b",
    Type: "Placement",
    Message: "Google hiring",
    Timestamp: "2026-04-22 17:49:40",
  },
  {
    ID: "fa1234bc-aaaa-bbbb-cccc-ddddeeeeffffaa",
    Type: "Placement",
    Message: "Microsoft hiring drive",
    Timestamp: "2026-04-22 17:49:20",
  },
  {
    ID: "bb9876aa-1111-2222-3333-444455556666",
    Type: "Event",
    Message: "annual sports day",
    Timestamp: "2026-04-22 17:48:00",
  },
];

async function main() {
  const args = process.argv.slice(2);
  const topIndex = args.indexOf("--top");
  const tokenIndex = args.indexOf("--token");
  const n = topIndex !== -1 ? parseInt(args[topIndex + 1], 10) || 10 : 10;
  const token = tokenIndex !== -1 ? args[tokenIndex + 1] : null;

  let notifications;

  if (token) {
    console.log(`\nFetching live notifications from API...`);
    try {
      notifications = await fetchNotifications(token);
      console.log(`Fetched ${notifications.length} notifications.\n`);
    } catch (err) {
      console.error("API fetch failed:", err.message);
      console.log("Falling back to mock data.\n");
      notifications = MOCK_NOTIFICATIONS;
    }
  } else {
    console.log(`\nUsing mock notifications (${MOCK_NOTIFICATIONS.length} total).\n`);
    notifications = MOCK_NOTIFICATIONS;
  }

  const topN = getTopNPriorityNotifications(notifications, n);

  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║         PRIORITY INBOX — Top ${String(n).padEnd(2)} Notifications          ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  topN.forEach((notif, idx) => {
    const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`;
    const typeEmoji =
      notif.Type === "Placement" ? "💼" : notif.Type === "Result" ? "📊" : "🎉";
    console.log(
      `${String(medal).padEnd(4)} [${typeEmoji} ${notif.Type.padEnd(9)}]  Score: ${notif.score.toFixed(6)}  |  ${notif.Message.padEnd(30)}  |  ${notif.Timestamp}`
    );
    console.log(`       ID: ${notif.ID}`);
    console.log();
  });

  console.log(`\nScoring formula: score = TYPE_WEIGHT × exp(-λ × ageInMinutes)`);
  console.log(`Type Weights → Placement: 3 | Result: 2 | Event: 1`);
  console.log(`Decay constant λ = ${DECAY_LAMBDA} per minute\n`);

  return topN;
}

main().catch(console.error);

module.exports = { getTopNPriorityNotifications, scoreNotification, MinHeap };
