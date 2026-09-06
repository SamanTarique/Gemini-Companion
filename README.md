# Gemini Companion

AI-Powered Personal Productivity Assistant

Transform your thoughts, voice reflections, and daily insights into actionable plans with Google Gemini, Firebase, and intelligent automation.

---

## Overview

Gemini Companion is a privacy-first, production-grade personal productivity assistant that converts unstructured conversations and voice reflections into structured tasks, calendar events, reminders, and intelligent daily plans. Built for the modern knowledge worker, it bridges the gap between thinking and doing.

Whether you're brainstorming during a morning session, reflecting on your day, or planning your week—Gemini Companion listens, understands, and transforms your input into actionable outcomes.

---

## Problem Statement

Productivity fragmentation is a widespread challenge:

- Ideas exist in disparate places (voice memos, notes, conversations)
- Manual conversion from reflection to action consumes valuable time
- Calendar and task management tools operate independently from ideation
- No personal memory or learning from past patterns
- Energy and focus management are neglected in traditional productivity tools

Gemini Companion solves this by creating a unified, AI-driven pipeline from thoughts to structured action.

---

## Key Features

| Feature | Description |
|---------|-------------|
| Journal & Voice Dictation | Capture thoughts via text or speech using Web Speech API. Audio processing stays on your device. |
| AI-Powered Search & Insights | Semantically search past entries and extract actionable patterns using Gemini. |
| Automatic Calendar Integration | Extract events and deadlines from reflections; sync seamlessly with Google Calendar. |
| Smart Task Extraction | Convert conversations into priority-tagged tasks with deadlines, estimates, and subtasks. |
| Daily Planner | AI-generated daily plans with time-blocked focus sessions and energy management strategy. |
| Focus Mode | Distraction-free work sessions with intelligent break recommendations. |
| Productivity Insights | Morning briefs, evening reviews, and weekly summaries powered by Gemini AI. |
| Privacy First | Federated Google Sign-In, Firestore security rules, and enforced zero cross-user visibility. |
| Semantic Memory | Long-term memory system for themes, patterns, and personal knowledge graphs. |
| Google Workspace Integration | Sync Gmail commitments and Google Calendar events automatically. |

---

## AI Workflow Architecture

The system follows a structured AI workflow: Think → Understand → Plan → Act → Focus → Replan

```
User Input (Text/Voice)
        |
        v
AI Analysis (Gemini) - Extract intent, sentiment, entities
        |
        v
Structured Planning - Convert to tasks, events, deadlines
        |
        v
Execution - Create calendar events, tasks, reminders
        |
        v
Focus Sessions - Intelligent work blocks with breaks
        |
        v
Daily Insights - Review, learn, and adjust for next cycle
```

---

## Competitive Differentiation

| Aspect | Traditional Tools | Gemini Companion |
|--------|------------------|------------------|
| Input Method | Keyboard-only, structured forms | Voice, text, conversational |
| AI Integration | None or bolt-on | Deeply integrated at every workflow step |
| Pipeline | Separate ideation, planning, execution | Unified Think → Act pipeline |
| Energy Awareness | Static schedules | Dynamic daily plans with energy strategy |
| Privacy Model | Centralized servers | Federated auth, user-isolated Firestore |
| Memory & Learning | Task lists only | Semantic memory with pattern extraction |
| Integrations | Limited | Seamless Google Calendar & Gmail sync |

---

## Technology Stack

### Frontend
- React 19 - Modern UI framework with hooks
- TypeScript - Type-safe development
- Tailwind CSS - Utility-first styling
- Vite - Lightning-fast development and production builds
- Lucide React - Consistent icon library
- Motion - Smooth animations
- React Markdown - Rich text rendering

### Backend
- Express.js - Lightweight Node.js server
- WebSockets (WS) - Real-time AI streaming and voice communication
- Google Generative AI SDK (@google/genai) - Gemini API integration

### Data & Authentication
- Firebase Authentication - Federated Google Sign-In
- Cloud Firestore - User-isolated document database
- Firestore Security Rules - Enforced user data isolation

### Cloud Infrastructure
- Google Cloud Run - Serverless deployment
- Google Cloud Secret Manager - Secure API key management
- Google Cloud APIs - Firestore, AI Platform, Secret Manager

### Development Tools
- TSX - TypeScript executor for Node.js
- ESBuild - Fast JavaScript bundler
- Autoprefixer - CSS vendor prefixing
- JSZip - Data export functionality

---

## Project Structure

```
gemini-companion/
│
├── index.html                      # HTML entry point
├── package.json                    # Dependencies and npm scripts
├── tsconfig.json                   # TypeScript configuration
├── vite.config.ts                  # Vite build configuration
├── server.ts                       # Express backend server (main entry)
│
├── firestore.rules                 # Firestore security rules
├── firebase-blueprint.json         # Firestore database schema
├── firebase-applet-config.json     # Firebase project config
│
├── .env.example                    # Environment variables template
├── .gitignore                      # Git exclusions
├── metadata.json                   # Project metadata
├── security_spec.md                # Security threat model and analysis
│
├── public/                         # Static assets directory
│   └── (favicon, assets, etc.)
│
├── dist/                           # Production build (generated)
│   ├── index.html                  # Built frontend
│   ├── assets/                     # Bundled CSS, JS, images
│   └── server.cjs                  # Bundled backend
│
└── node_modules/                   # Dependencies (generated)
```

### Directory Details

**Root Level Files:**
- `index.html` - Single Page Application entry point
- `package.json` - Project dependencies, scripts, and metadata
- `tsconfig.json` - TypeScript compiler options (strict mode enabled)
- `vite.config.ts` - Vite build tool configuration for development and production
- `server.ts` - Express backend server with all API endpoints and WebSocket handlers

**Configuration Files:**
- `firestore.rules` - Security rules enforcing user data isolation and schema validation
- `firebase-blueprint.json` - Database structure with collections and field definitions
- `firebase-applet-config.json` - Firebase console configuration and API keys
- `.env.example` - Template for environment variables (GEMINI_API_KEY, APP_URL)
- `metadata.json` - Project metadata for deployment and identification

**Documentation:**
- `security_spec.md` - Comprehensive threat modeling and OWASP LLM security analysis

**Build Outputs:**
- `dist/` - Production bundle (generated by build process)
  - Frontend assets optimized by Vite
  - Backend compiled to Node.js CommonJS format
  - Ready for Cloud Run deployment

---

## Installation

### Prerequisites
- Node.js 16 or higher
- npm or bun package manager
- Google Cloud Project with billing enabled
- Firebase project linked to Google Cloud

### Setup Steps

#### 1. Clone Repository
```bash
git clone https://github.com/SamanTarique/Gemini-Companion.git
cd Gemini-Companion
```

#### 2. Enable Required Google Cloud APIs
```bash
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  aiplatform.googleapis.com
```

#### 3. Configure Environment Variables
Create a `.env` file in the project root:

```env
GEMINI_API_KEY="your_gemini_api_key_here"
APP_URL="http://localhost:3000"
```

Get your Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

**Important**: Never commit `.env` to version control. The `.env.example` file shows the required format.

#### 4. Install Dependencies
```bash
npm install
# or
bun install
```

#### 5. Deploy Firestore Security Rules
```bash
firebase deploy --only firestore:rules
```

---

## Local Development

### Start Development Server
```bash
npm run dev
```

Runs Vite dev server with hot module replacement and Express backend on http://localhost:3000

### Build for Production
```bash
npm run build
```

Generates frontend and backend bundles in `dist/`

### Type Checking
```bash
npm run lint
```

### Clean Build Artifacts
```bash
npm run clean
```

---

## Cloud Run Deployment

### Deploy Container
```bash
gcloud run deploy gemini-companion \
  --source . \
  --region asia-east1 \
  --platform managed \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --set-env-vars NODE_ENV=production
```

### Store API Key in Secret Manager
```bash
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "your_api_key_here" | gcloud secrets versions add GEMINI_API_KEY --data-file=-
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Security & Privacy

### Authentication & Authorization
- Federated Google Sign-In via Firebase Authentication
- No plaintext passwords stored
- Bearer JWT tokens for API requests
- Strict request.auth.uid validation in all Firestore rules

### Data Isolation
- Owner-bound security rules: every collection anchored to request.auth.uid == userId
- Complete cross-user visibility enforcement
- Undefined payload sanitization to prevent injection attacks
- Strict schema validation for all entity types

### Threat Mitigation

| Threat | Countermeasure |
|--------|---|
| Prompt Injection | Input containment within structured delimiters, anti-jailbreak system prompts |
| Token Leakage | Client-side auth, Bearer header JWT, no sensitive data in server logs |
| API Quota Exhaustion | Per-user rate limiting (40 requests/minute), graceful fallback to lite models |
| Database Corruption | Undefined field stripping, defensive payload parsing |
| Data Leakage | Zero raw journal text in server logs, strict telemetry redaction |

---

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /api/gemini/reflect | Multi-turn AI reflection and insights |
| POST | /api/gemini/extract | Structured task and deadline extraction |
| POST | /api/gemini/search-context | Live search with web grounding |
| POST | /api/gemini/what-now | Next action recommendation |
| POST | /api/gemini/plan-day | Daily schedule generation |
| POST | /api/voice/session | Initialize voice session ticket |
| GET | /api/weather | Current weather data |
| GET | /api/google/calendar/events | Fetch Google Calendar events |
| POST | /api/google/calendar/events | Create calendar event |
| GET | /api/google/gmail/messages | Fetch recent Gmail messages |

---

## Database Schema

Firestore collections under `/users/{userId}`:

- **entries** - Journal reflections with mood, tags, and AI responses
- **tasks** - Action items with priority, due dates, and estimates
- **events** - Calendar events with start/end times and locations
- **plans** - Daily time-blocked schedules
- **focusSessions** - Logged focus work with duration
- **insights** - Morning briefs, evening reviews, weekly summaries
- **memories** - Semantic memory units with embeddings
- **notifications** - Scheduled reminders and alerts
- **preferences** - User settings and time preferences
- **integrations** - Google Workspace connection metadata

---

## Contributing

Contributions are welcome. Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Commit changes with clear messages
4. Push to your fork
5. Submit a pull request with description


---

## Support

- Issues: [GitHub Issues](https://github.com/SamanTarique/Gemini-Companion/issues)
- Discussions: [GitHub Discussions](https://github.com/SamanTarique/Gemini-Companion/discussions)

---

Built for the Google Cloud Run AI Challenge with Google Gemini, Firebase, and Cloud Run.
