# 🩺 DrDoc - Clinical Note Generation Platform

Welcome to the **DrDoc** documentation. DrDoc is an AI-powered, highly robust clinical scribe platform designed to automatically generate structured medical notes from raw consultation transcripts. It employs an advanced multi-agent workflow powered by **LangGraph**, **LangChain**, **Groq**, and **Google GenAI** to ensure privacy, clinical accuracy, safety, and continuous learning from physician feedback.

---

## 📑 Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Database Architecture](#database-architecture)
4. [Agentic Workflow (LangGraph)](#agentic-workflow-langgraph)
5. [Prompts & AI Rules](#prompts--ai-rules)
6. [Getting Started](#getting-started)
7. [Future Enhancements](#future-enhancements)

---

## 🚀 Project Overview

DrDoc aims to minimize the administrative burden on healthcare professionals. A doctor can record or provide a transcript of a patient consultation in any language (including regional languages like Hindi or Urdu). The system processes this transcript to:
- **Redact** Personally Identifiable Information (PII) to maintain HIPAA compliance.
- **Translate** the transcript into English.
- **Retrieve** the specific doctor's clinical profile (preferences, common medicines).
- **Generate** a structured clinical note (e.g., SOAP format).
- **Enforce Safety** by checking for correct prescription formats (dosage, route, duration).
- **Allow Human-in-the-Loop (HITL)** reviews, where doctors can reject and provide feedback.
- **Auto-correct and Re-generate** based on the feedback.

---

## 🛠️ Tech Stack

- **Frontend / Framework:** Next.js (App Router, v16), React 19, Tailwind CSS v4
- **Database:** PostgreSQL with Prisma ORM
- **AI / LLM Orchestration:** LangGraph, LangChain
- **Models:** 
  - Google Gemini (via `@langchain/google-genai`) - *Fast, high-volume tasks like PII redaction.*
  - Groq (`@langchain/groq`) - *High-speed reasoning tasks like note generation, guardrails, and root cause analysis.*
- **Authentication / Security:** `bcryptjs` for password hashing.
- **Styling / UI:** TailwindCSS, React Markdown

---

## 🗄️ Database Architecture

The database is modeled using **Prisma** (PostgreSQL) and consists of three core tables:

1. **`User` (`users`)**
   - Handles authentication and roles (`DOCTOR`, `PATIENT`).
   - Links to `ClinicalProfile` and `GeneratedNote`.

2. **`ClinicalProfile` (`clinical_profiles`)**
   - Acts as the Knowledge Base / RAG input for the specific doctor.
   - **`specialties`**: Field of medicine (e.g., General Practice).
   - **`commonMedicines`**: Frequently prescribed drugs.
   - **`notePreferences`**: Free-text instructions defining note structure (e.g., SOAP) and prescribing protocols.

3. **`GeneratedNote` (`generated_notes`)**
   - Stores the final, approved clinical notes.
   - **`patientInfo`**: JSON structure containing extracted non-PII details.
   - **`noteContent`**: The approved final clinical text.
   - **`originalTranscript`**: Optional backup of the raw input.

---

## 🤖 Agentic Workflow (LangGraph)

The core intelligence of DrDoc is driven by a state machine built with **LangGraph**. It utilizes a continuous learning and safety loop.

### State Definition (`DrDocState`)
The graph maintains the following global state across nodes:
- `originalTranscript`, `patientInfo`, `redactedTranscript`
- `doctorPreferences` (RAG data)
- `draftNote`
- `guardrailStatus`, `guardrailError`
- `humanReviewStatus`, `humanFeedbackText`
- `rootCause`

### The Nodes (AI Agents)

1. **`redact_pii` (Gemini)** 
   - Takes raw transcript, extracts patient info, redacts sensitive PII, and translates to English if necessary.
2. **`retrieve_knowledge`**
   - Fetches the doctor's `ClinicalProfile` from the Prisma database to inform the generation process.
3. **`generate_note` (Groq)**
   - Generates the structured clinical note based on the redacted transcript and the doctor's protocols.
4. **`safety_guardrail` (Groq)**
   - An automated QA step that rigorously checks if prescribed medicines include dosage, route, and duration.
5. **`auto_correct` (Groq)**
   - Triggered if the guardrail fails. Fixes the exact safety violation without destroying the rest of the draft.
6. **`human_handoff`**
   - **Interrupt Node**: Freezes the graph state and waits for human (physician) approval or rejection.
7. **`feedback_integrator` (Groq)**
   - If rejected, this node translates the doctor's angry/raw feedback into strict instructions for the `generate_note` node to try again.
8. **`root_cause_analyzer` (Groq)**
   - Runs in parallel to feedback integration to deduce if the feedback is a one-off correction (`TRANSCRIPT_ERROR`) or a fundamental rule change (`PREFERENCE_ERROR`). *(Currently defaults to transcript error for safety).*
9. **`update_database` (Groq)**
   - If a `PREFERENCE_ERROR` is detected, this agent rewrites the doctor's saved protocols in the database to ensure the system learns permanently.

### Workflow Diagram

```mermaid
graph TD
    START((START)) --> redact_pii
    redact_pii --> retrieve_knowledge
    retrieve_knowledge --> generate_note
    generate_note --> safety_guardrail
    
    safety_guardrail -- "FAIL" --> auto_correct
    auto_correct --> safety_guardrail
    
    safety_guardrail -- "PASS" --> human_handoff
    
    human_handoff -- "APPROVED" --> END((END))
    human_handoff -- "REJECTED" --> feedback_integrator
    human_handoff -- "REJECTED" --> root_cause_analyzer
    
    feedback_integrator --> generate_note
    
    root_cause_analyzer -- "PREFERENCE_ERROR" --> update_database
    root_cause_analyzer -- "TRANSCRIPT_ERROR" --> END
    update_database --> END
```

---

## 📜 Prompts & AI Rules

DrDoc relies on highly specialized system prompts located in `app/lib/agent/prompts.ts`.

- **PII Redaction Prompt:** Enforces strict HIPAA compliance. Demands that output must be in English JSON format, stripping names, contacts, and exact addresses.
- **Generate Note Prompt:** Enforces the doctor's specific protocols (e.g., SOAP format, specific antibiotic preferences for penicillin allergies). Includes feedback context if looping back from a rejection.
- **Safety Guardrail Prompt:** Acts as a ruthless evaluator looking for missing `Dosage`, `Route`, or `Duration` in the 'Plan' section.
- **Feedback Integrator Prompt:** Translates messy, human feedback into surgical bullet points for the next generation cycle.

---

## 💻 Getting Started

### Prerequisites
- Node.js (v20+)
- PostgreSQL Database
- API Keys for Google Gemini (`GOOGLE_GENAI_API_KEY`) and Groq (`GROQ_API_KEY`)

### Installation & Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/drdoc?schema=public"
   GOOGLE_GENAI_API_KEY="your_gemini_key"
   GROQ_API_KEY="your_groq_key"
   ```

3. **Database Setup**
   Run Prisma migrations to set up the schema:
   ```bash
   npx prisma generate
   npx prisma db push
   ```
   *(Optional)* Run the seed script to populate a test profile:
   ```bash
   npx ts-node prisma/seed-profile.ts
   ```

4. **Run the Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 🔮 Future Enhancements

1. **Enable Continuous Database Learning:** Currently, the `root_cause_analyzer` is hardcoded to return `TRANSCRIPT_ERROR` to prevent accidental database overwrites. Implementing a safe UI verification step to allow `PREFERENCE_ERROR` to rewrite Prisma `notePreferences` will create a truly self-learning system.
2. **Multi-Doctor Session Handling:** Enhancing the LangGraph state initialization to strictly partition context based on the logged-in user's Session ID.
3. **Voice-to-Text Integration:** Integrating Whisper API or a similar model directly into the frontend to capture consultations live without manually pasting transcripts.
4. **EHR Integrations:** Exporting the final `GeneratedNote` via HL7/FHIR standards to established Electronic Health Record systems.
