# 🛰️ Relay | Futuristic Support Command Center

Relay is a high-end, glassmorphic support ecosystem designed for modern operational teams. It provides a seamless, real-time bridge between field users and support agents, featuring a premium dark-mode aesthetic and state-of-the-art interaction design.

---

## ✨ Design Philosophy: "The Command Center"

Relay is built with a **Futuristic Glassmorphic** aesthetic. It moves away from boring, static tables and into a dynamic, "alive" interface.
- **Translucency**: Every panel uses high-index blur (backdrop-filter) and subtle transparency.
- **Luminance**: Critical actions use neon indigo and purple glows to guide the eye.
- **Motion**: Every transition is smooth, from the spinning logo rings to the message bubble animations.

---

## 🛠️ Core Modules

### 1. 🔐 Sentinel Auth (Phone-Based)
A secure, streamlined entry point that eliminates the need for complex passwords.
- **Session Persistence**: Remembers your login even after a browser refresh.
- **Identity Awareness**: Automatically routes you to the correct interface (User or Agent) based on your database profile.

### 2. 💬 Pulse Chat (User Interface)
The frontline for field users to report issues.
- **Instant Connectivity**: Real-time messaging powered by Supabase.
- **Multimedia Support**: Send and receive images or documents via the integrated attachment system.
- **Smart Status**: Visual indicators (Open, Active, Resolved) so users always know their request's progress.

### 3. 🛸 Relay Inbox (Agent Dashboard)
A high-density command center for support teams.
- **Auto-Claim System**: Tickets are automatically assigned to an agent the moment they open them.
- **Live Performance Stats**: Real-time tracking of Open vs. Resolved tickets.
- **Global Search & Filter**: Quickly pivot between different ticket types and statuses.

---

## 🚀 Technical Stack

- **Framework**: [Next.js 16 (Turbopack)](https://nextjs.org/) for lightning-fast development and performance.
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/) using the latest modern CSS features.
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL) for secure data storage.
- **Real-time**: Supabase Broadcast & Postgres Changes for sub-100ms message delivery.
- **Storage**: Supabase Storage for secure file handling.

---

## 📦 Setup & Installation

### 1. Environment Configuration
Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

### 2. Database Schema
Run the provided `supabase_schema.sql` in your Supabase SQL Editor. This creates:
- `profiles`: User identities and team roles.
- `tickets`: The core support requests.
- `messages`: The conversation history.

### 3. Storage Setup
- Create a bucket in Supabase named **`attachments`**.
- Set the bucket to **Public**.
- Add a Storage Policy to allow `SELECT` and `INSERT` for `anon` users.

---

## 📖 How to Use

### As a User
1. Enter your phone number (must exist in the `profiles` table).
2. Click **+ New Support Request** to start a conversation.
3. Attach photos or documents using the 📎 icon.

### As an Agent (Admin/CT Team)
1. Ensure your `team_type` in Supabase is set to `Admin` or `CT Team`.
2. Log in with your phone number.
3. Select an **Open** ticket from the sidebar to automatically claim it.
4. Click **Resolve** once the issue is finalized to clear it from your active queue.

---

## 🎨 UI Reference Guide

| Element | Style | Rationale |
| :--- | :--- | :--- |
| **Active Cards** | `indigo-600/10` | Subtle focus without overwhelming the dark theme. |
| **Glow Accents** | `blur-[120px]` | Creates depth and a "space-age" feel. |
| **Typography** | `Inter` | Clean, geometric, and highly readable in dark mode. |
| **Glass Panels** | `blur(20px)` | Provides visual hierarchy and modern elegance. |

---

*Developed with ❤️ for the Relay Support Team.*
