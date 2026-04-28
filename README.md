![Relay Hero Banner](/hero-banner.png)

# 🛰️ Relay | Cybernetic Support Command Center

Relay is a high-performance, glassmorphic support ecosystem engineered for mission-critical operations. It redefines traditional support ticketing by providing a **Living Command Center** experience—combining real-time intelligence, automated workflow enforcement, and a state-of-the-art "cyber-dark" aesthetic.

---

## 💎 Design Identity: "The Cybernetic Void"

Relay is built on the principle of **Operational Clarity**. Every pixel is designed to reduce cognitive load while maximizing the density of actionable information.

### 🎨 Visual Language & UX
- **The Void Palette**: Utilizes `#050507` (Deep Black) as defined in `globals.css` to eliminate visual noise.
- **Glassmorphism 2.0**: UI panels feature multi-layered `backdrop-blur(20px)` and `bg-white/[0.03]` translucent materials.
- **Atmospheric Lighting**: Subtle glows and luminescent borders (`indigo-500/20`) guide the eye to urgent tasks.
- **Semantic Color System**:
    - <kbd>Indigo & Purple</kbd>: Primary navigation and active focus (`#6366f1`, `#a855f7`).
    - <kbd>Cyber Emerald</kbd>: Resolved status / Healthy SLA.
    - <kbd>Solar Amber</kbd>: Warning / Near Breach (**5-minute threshold**).
    - <kbd>Pulse Red</kbd>: Critical / Breached / Escalated.

---

## 🚀 Key Operational Modules

### 1. 🛸 High-Density Inbox (The Cockpit)
Designed for agents processing hundreds of tickets daily. 
- **Real-time Synchronization**: Powered by Supabase Realtime, the inbox updates instantly without page refreshes.
- **Smart Priority Engine**: Tickets are dynamically sorted by **Priority (DESC)**, then **SLA Deadline (ASC)**.
- **Contextual Search**: High-speed filtering across Subject, Ticket ID, and User metadata.
- **Bulk Operations**: Perform "Bulk Assign" or "Bulk Resolve" on multiple selected tickets simultaneously.

### 2. 📊 Operational Intelligence (Insights)
A futuristic analytics suite providing a bird's-eye view of support health.
- **KPI Command Strip**: Real-time tracking of **Today's Volume**, **Average TAT (Turnaround Time)**, and **SLA Compliance**.
- **Geographic Hotspots**: Automated clustering of ticket volume by city to detect regional service gaps.
- **Critical User Tracking**: Automatically flags "Repeat Users" with >3 tickets for specialized intervention.
- **Issue Distribution**: Dynamic visualization of problem categories via high-index bar charts.

### 3. ⚙️ The Sentinel (Workflow Automation)
An invisible logic layer that ensures operational precision.
- **Dynamic SLA Enforcement**: Every ticket is governed by rules defined in the `sla_rules` table.
- **Visual Urgency Strips**: Ticket cards feature a dynamic vertical strip that changes to **Yellow (5m remaining)** or **Red (Breached)**.
- **Auto-Escalation**: Overdue tickets are automatically labeled as `ESCALATED` in the UI.

### 💬 4. Unified Communication (Chat)
A low-latency messaging interface for agent-user collaboration.
- **Rich Media Support**: Integrated file uploads (images/logs) via Supabase Storage.
- **First Response Tracking**: Automatically captures `first_response_at` on the first agent message to calculate FRT metrics.
- **Audit Log**: Every assignment, response, and resolution is logged in `ticket_events`.

---

## 🏗️ Technical Architecture

| Layer | Technology | implementation Details |
| :--- | :--- | :--- |
| **Framework** | **Next.js 16.2** | Utilizing App Router and Server Actions. |
| **Runtime** | **React 19** | Concurrent rendering and modern hook architecture. |
| **Styling** | **Tailwind CSS 4** | Advanced JIT styling with native CSS variables. |
| **Backend** | **Supabase** | PostgreSQL database with RLS and Realtime Broadcast. |

### 🗄️ Detailed Data Model

- **`profiles`**: User metadata and `team_type` (Admin, CT Team, VS Team).
- **`tickets`**: Core entity with `sla_deadline`, `priority`, and geospatial data.
- **`ticket_events`**: Audit log for ticket lifecycle tracking.
- **`ticket_metrics`**: SQL view for real-time TAT and SLA calculations.
- **`messages`**: Threaded communication with attachment support.

---

## 🛠️ Installation & Development

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/your-repo/relay-support.git
    npm install
    ```
2.  **Environment Setup**:
    Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to your `.env.local`.
3.  **Initialize Database**:
    Apply the [supabase_schema.sql](file:///c:/Users/DELL/OneDrive/Desktop/relay-support/supabase_schema.sql) in your Supabase SQL Editor.
4.  **Run Dev Server**:
    ```bash
    npm run dev
    ```

---

## ⚡ Performance Optimization

- **Turbopack**: Ultra-fast HMR for rapid iteration.
- **Zero-Runtime CSS**: Tailwind 4 eliminates style calculation overhead.
- **SQL Materialized Logic**: Offloading complex metrics to database views.

---

*Engineered for Excellence. Designed for the Future.*
