# Campus Notifications Microservice

> Full Stack Track Submission

## Repository Structure

```
<roll_number>/
├── logging_middleware/          # (from pre-test)
├── notification_system_design.md
├── notification_app_be/
│   ├── priorityInbox.js         # Stage 1 — Priority Inbox algorithm
│   └── package.json
└── notification_app_fe/         # Stage 2 — React + Material UI frontend
    ├── src/
    │   ├── pages/
    │   │   ├── AllNotifications.jsx
    │   │   ├── PriorityInbox.jsx
    │   │   └── Auth.jsx
    │   ├── components/
    │   │   ├── Navbar.jsx
    │   │   ├── NotificationCard.jsx
    │   │   └── FilterBar.jsx
    │   ├── context/
    │   │   └── NotificationContext.jsx
    │   └── utils/
    │       └── priority.js      # Shared scoring logic
    ├── App.jsx
    ├── index.html
    ├── vite.config.js
    └── package.json
```

## Stage 1 — Priority Inbox (Backend)

### Setup & Run

```bash
cd notification_app_be
node priorityInbox.js              # top 10, mock data
node priorityInbox.js --top 15     # top 15
node priorityInbox.js --top 10 --token <bearer_token>  # live API
```

### Algorithm

- **Score** = `TYPE_WEIGHT × exp(−λ × ageInMinutes)`
- **Type weights**: Placement = 3, Result = 2, Event = 1
- **Data structure**: Min-Heap of size N → O(log N) per insert
- **Memory**: bounded at N items regardless of total volume

## Stage 2 — Frontend (React + MUI)

### Setup & Run

```bash
cd notification_app_fe
npm install
npm run dev
# → http://localhost:3000
```

### Features

- **Auth page** — Register + get Bearer token via Affordmed API
- **All Notifications** — Full list with filter by type, pagination (10/15/20 per page), new/viewed distinction
- **Priority Inbox** — Top N slider (5/10/15/20), ranked by algorithm, filter by type, score display
- **New vs Viewed** — Persisted in localStorage, "NEW" badge on unseen notifications
- **Responsive** — Mobile + desktop layouts with MUI

### Tech

- React 18 + Vite
- React Router v6
- Material UI v5
- No ShadCN, no other CSS libraries
