# AuraJournal — Private AI Journaling & Cognitive Reflection

A production-grade, privacy-first personal journaling and reflection application built with **Google Sign-In (Firebase Auth)**, **Cloud Firestore** for user-isolated persistence, and the **Gemini 3.8 Flash API** for multi-turn cognitive reflections, brainstorming, and structured schedule extraction.

---

## 🌟 Key Capabilities & Architectural Highlights

- **Federated Authentication**: Secure Google Sign-In with Firebase Auth. No plaintext passwords or sensitive credentials stored in app code.
- **Strict User Isolation**: Cloud Firestore Security Rules enforce zero cross-user visibility. Every document path is anchored to `request.auth.uid == userId`.
- **Multi-Turn AI Reflections**: Conversational exploration powered by Gemini with automatic multi-tier fallback resilience (`gemini-2.5-flash` → `gemini-2.5-flash-lite` → dynamic alias → `gemini-3.7-flash`).
- **Structured Schedule Extraction**: Converts stream-of-consciousness journaling into structured tasks, deadlines, and calendar events normalized to local IANA timezones.
- **Obsidian-Style Linked Notes**: Cross-references past entries sharing tags and themes with timeline search and Markdown export (.md).
- **Voice Dictation & Text-to-Speech**: Speech-to-text journaling and audio playback using the browser's native Web Speech API without sending raw audio to external servers.
- **Zero-Crash Payload Hygiene**: Strict undefined-value stripping on Firestore writes and defensive payload parsing across all backend endpoints.
- **User Data Sovereignty**: One-click complete account and journal data purge action with double-confirmation.

---

## 🛡️ Agentic Threat Model & OWASP LLM Mitigations

| Threat Zone | Identified Risk | Countermeasure & Mitigation |
| :--- | :--- | :--- |
| **1. Input Surfaces** | Malicious payload injection, buffer overrun, prompt tampering | Strict 15,000 char length limits, schema validation, and null-safe payload parsing. |
| **2. Planning & Reasoning** | Indirect prompt injection in user reflection content | Strict input containment within `<user_reflection>` delimiter tags and anti-jailbreak system prompts. |
| **3. Tool Execution** | Gemini API quota exhaustion, DoS, upstream outages | Per-user rate limiting (40 req/min), 4-tier model fallback ladder, and server-side secret management. |
| **4. Memory & State** | Cross-user journal leaks, DB crashes from undefined fields | Owner-bound Firestore security rules (`request.auth.uid == userId`) and undefined payload sanitization. |
| **5. Inter-System / Telemetry**| Journal text leakage in server logs, token exposure | Bearer header JWT auth, strict telemetry logging (zero raw user journal text in logs), and client-side audio. |

---

## 📋 Prerequisites & Local Setup

### 1. Enable Google Cloud APIs
Ensure the following APIs are enabled in your Google Cloud Project:
```bash
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  aiplatform.googleapis.com
```

### 2. Environment Variables (.env)
Create a `.env` file in the project root:
```env
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
APP_URL="http://localhost:3000"
```

### 3. Install Dependencies & Start Dev Server
```bash
npm install
npm run dev
```

---

## 🔒 Firestore Security Rules (`firestore.rules`)

Deploy the following security rules to your Firebase Firestore project:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /interactions/{interactionId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /entries/{entryId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /schedules/{scheduleId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /{allSubcollections=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

To deploy via Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

---

## 🔑 Secret Manager Setup

Create and configure operational secrets for Cloud Run:

```bash
# 1. Create Secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"

# 2. Add API Key Payload
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 3. Grant Secret Accessor to Cloud Run Service Account
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 🚀 Google Cloud Run Deployment Flow

### 1. Build and Deploy Container
```bash
gcloud run deploy aurajournal \
  --source . \
  --region asia-east1 \
  --platform managed \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --set-env-vars NODE_ENV=production
```

### 2. Apply Mandatory Campaign Challenge Label
```bash
gcloud run services update aurajournal \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=asia-east1
```

---

## 🧪 Functional Walkthrough & Verification Steps

1. **Google Sign-In Authentication**:
   - Navigate to the landing page and click **Sign In with Google**.
   - Authenticate via Google popup; verify user avatar, display name, and local IANA timezone display in the navigation bar.

2. **Journal Writing & Voice Dictation**:
   - Enter an introspective journal title and reflection text.
   - Click the **Dictate** button to test speech recognition (Web Speech API).
   - Select a mindset/mood pill (e.g. *Reflective*, *Energized*, *Calm*).

3. **Multi-Turn Gemini Dialogue**:
   - Click **Reflect & Inquire** or **Brainstorm Actions**. Verify Gemini generates a personalized, empathetic response with tags and emotional reframing.
   - Use the audio **Speaker** button to hear the reflection read aloud via Speech Synthesis.
   - Type a follow-up question in the ongoing dialogue input to continue the multi-turn session.

4. **Schedule & Task Extraction**:
   - Click **Extract Tasks & Schedule**. Verify tasks, events, and deadlines are parsed into the structured schedule card with toggleable checkboxes.

5. **Persistence & User Isolation**:
   - Click **Save** or allow autosave. Refresh the page or log out and log back in; verify all reflections and chat turns are restored from Firestore.
   - Check the **Archive** timeline or toggle **Linked Notes** to explore connected themes.

6. **AI Live Search & Grounding**:
   - Open the **Search** tab.
   - Enter a query (e.g., upcoming conference dates or local events).
   - Verify grounded search answers with source links are returned, and review suggested tasks/events.
   - Click **Approve & Add** to verify the action is created in Tasks or Calendar with deduplication.

7. **Google Workspace Sync & Gmail Commitments**:
   - Open **Settings** → **Google Workspace**.
   - Connect Calendar and Gmail via Google OAuth popup.
   - Click **Sync Calendar** to import upcoming events into the calendar.
   - Click **Detect Commitments** from recent emails and approve extracted tasks/events into your schedule.

8. **Markdown Export & Data Purge**:
   - Click **Export .MD** in the navbar to download all entries as Markdown.
   - Click **Delete Data**, type `DELETE`, and confirm all user records are purged from `/users/{uid}`.
