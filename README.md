# <p align="center">Minutely</p>

Minutely is an advanced, AI-powered meeting intelligence and video conferencing platform. It empowers users with state-of-the-art video quality, real-time transcription, and automated meeting insights.

<hr />

<p align="center">
<img src="images/minutely-logo.png" width="900" alt="Minutely Logo" />
</p>

<hr />

## Core Features

Minutely offers a comprehensive suite of features for modern teams:

* **HD Audio & Video**: Crystal clear communication via WebRTC.
* **Real-time Transcription**: Live captions and transcript synchronization.
* **AI Meeting Intelligence**:
    * **Executive Summaries**: Automatic generation of meeting recaps.
    * **Action Item Extraction**: Zero-shot classification of tasks and assignments.
    * **Topic Clustering**: Semantic grouping of discussion points.
* **Collaboration Suite**:
    * **Team Spaces**: Persistent channels and team-based meeting management.
    * **Real-time Chat**: Integrated messaging with read markers.
    * **Scheduled Meetings**: Unified calendar and invitation system.
* **Cross-Platform**: Support for all modern browsers and native mobile applications (iOS/Android).

---

## Tech Stack

### Frontend
- **Framework**: React with TypeScript.
- **State Management**: Redux with a registry-based modular pattern.
- **Styling**: SCSS (compiled via Sass), Vanilla CSS, and Tailwind CSS.
- **Build System**: Webpack 5 with Hot Module Replacement (HMR).
- **Core Library**: `lib-jitsi-meet` for low-level WebRTC orchestration.

### Backend (Go API)
- **Runtime**: Go 1.21+.
- **Routing**: `chi` router for high-performance HTTP services.
- **Real-time**: Custom WebSocket Hub for live transcript and state synchronization.
- **Database**: Supabase (PostgreSQL) for persistence and Auth.
- **Architecture**: Clean Architecture with repository and adapter patterns.

### AI Service (Python)
- **Framework**: FastAPI for asynchronous inference endpoints.
- **Models**:
    * **Summarization**: `facebook/bart-large-cnn`.
    * **Action Items**: `facebook/bart-large-mnli` (Zero-shot classification).
    * **Embeddings**: `sentence-transformers/all-MiniLM-L6-v2` (Topic clustering).
- **Processing**: Scikit-learn for K-Means clustering and NLP pipeline.

---

## Prerequisites

Ensure you have the following installed on your development machine:

- **Node.js** (v16+) and **npm**.
- **Go** (v1.21+).
- **Python** (v3.9+) with `pip`.
- **Supabase CLI** (optional, for local DB development).
- **Git** for version control.

---

## Setup & Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/MinutelyAI/minutely.git
   cd minutely
   ```

2. **Install Dependencies**
   ```bash
   # Install Frontend & Build tools
   npm install

   # Install AI Service requirements
   pip install -r ai-service/requirements.txt
   ```

3. **Environment Configuration**
   Create a `.env` file in the `minutely-api` directory with your Supabase and AI service credentials:
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_key
   MODAL_AI_ENDPOINT=http://localhost:8000
   DEEPGRAM_KEY=your_deepgram_api_key
   ```

---

## Running the Application

Minutely provides a unified, cross-platform dev launcher that starts the entire stack (Frontend, API, and AI Service) simultaneously.

### The Easy Way (One Command)
```bash
npm run dev
```
This command triggers `start-dev.js`, which:
1. Compiles SCSS to CSS.
2. Copies required WebRTC and WASM assets to the `libs/` directory.
3. Starts the **Frontend** at `https://localhost:8080`.
4. Starts the **Go API** at `http://localhost:8081`.
5. Starts the **AI Service** at `http://localhost:8000`.

### Individual Components
If you need to run components separately:
- **Frontend**: `npx webpack serve --mode development`
- **Go API**: `cd minutely-api && go run cmd/api/main.go`
- **AI Service**: `cd ai-service && python app.py`

---

## Project Structure

```
minutely/
├── react/features/          # Core React components and Redux logic
├── minutely-api/            # Go Backend (Core API)
│   ├── cmd/api/             # Entry point
│   ├── internal/            # Business logic and adapters
│   └── supabase/            # Database migrations and seed scripts
├── ai-service/              # Python AI Insights service
├── libs/                    # Prepared third-party assets (WASM, UMD)
├── css/                     # Global SCSS styles
├── android/ & ios/          # Native mobile application code
└── start-dev.js             # Cross-platform orchestration script
```

---

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for more information on our code of conduct and the process for submitting pull requests.

<footer>
<p align="center" style="font-size: smaller;">
Built with ❤️ by the Minutely team.
</p>
</footer>
