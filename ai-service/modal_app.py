import modal
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import numpy as np
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Modal Setup & Image Definition
# ---------------------------------------------------------------------------
# We define the python dependencies and download the ML models during build time
# so they are cached in the container image.

def download_models():
    """Run during container build to cache models."""
    from transformers import pipeline
    print("Downloading Sentence Embeddings pipeline...")
    pipeline("feature-extraction", model="sentence-transformers/all-MiniLM-L6-v2")
    print("Downloading Zero-Shot Classifier for Tasks...")
    pipeline("zero-shot-classification", model="facebook/bart-large-mnli")
    print("Downloading Sequence-to-Sequence Summarizer (BART)...")
    pipeline("summarization", model="facebook/bart-large-cnn")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "fastapi==0.104.1",
        "pydantic==2.5.2",
        "scikit-learn==1.3.2",
        "transformers==4.35.2",
        "torch==2.1.1",
        "numpy==1.26.2"
    )
    .run_function(download_models)
)

app = modal.App("minutely-ai-insights", image=image)

# ---------------------------------------------------------------------------
# API Schemas
# ---------------------------------------------------------------------------
class TranscriptSegment(BaseModel):
    speaker_name: Optional[str] = "Unknown"
    text: str
    start_secs: Optional[float] = 0.0
    end_secs: Optional[float] = 0.0

    class Config:
        extra = "ignore"

class AIEvent(BaseModel):
    meeting_id: str
    transcript_id: str
    segments: List[TranscriptSegment]
    full_text: Optional[str] = ""
    participants: Optional[List[str]] = []
    duration_secs: Optional[float] = 0.0
    source: Optional[str] = "unknown"

    class Config:
        extra = "ignore"

# ---------------------------------------------------------------------------
# Core AI Pipeline Class
# ---------------------------------------------------------------------------
# We use @app.cls so the models are loaded into memory once per container lifecycle.

@app.cls(cpu=2.0, memory=4096)
class MeetingAnalyzer:
    @modal.enter()
    def load_models(self):
        """Load cached models into memory when the container starts."""
        from transformers import pipeline
        print("Loading models into memory...")
        self.embedder = pipeline("feature-extraction", model="sentence-transformers/all-MiniLM-L6-v2")
        self.classifier = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")
        self.summarizer = pipeline("summarization", model="facebook/bart-large-cnn")
        print("Models loaded successfully.")

    @modal.method()
    def process_transcript(self, event: AIEvent) -> Dict[str, Any]:
        print(f"Processing meeting {event.meeting_id} with {len(event.segments)} segments")
        if not event.segments:
            return {"executive_summary": "No discussion occurred.", "topics": [], "action_items": []}

        try:
            topics = self._extract_topics_kmeans(event.segments)
            action_items = self._extract_action_items(event.segments)
            
            full_text = event.full_text
            if not full_text and event.segments:
                full_text = " ".join([seg.text for seg in event.segments])
            
            if len(full_text.split()) > 40:
                chunk = " ".join(full_text.split()[:500])
                exec_summary = self.summarizer(chunk, max_length=100, min_length=30, do_sample=False)[0]['summary_text']
            else:
                exec_summary = full_text

            return {
                "executive_summary": exec_summary,
                "topics": topics,
                "action_items": action_items
            }
        except Exception as e:
            print(f"Error: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    def _extract_embeddings(self, texts: List[str]) -> np.ndarray:
        embeddings = []
        for text in texts:
            output = self.embedder(text, return_tensors=False)
            vec = np.mean(output[0], axis=0)
            embeddings.append(vec)
        return np.array(embeddings)

    def _extract_topics_kmeans(self, segments: List[TranscriptSegment]) -> List[Dict[str, Any]]:
        if len(segments) < 3:
            return []
            
        from sklearn.cluster import KMeans
        from sklearn.feature_extraction.text import TfidfVectorizer
        
        texts = [seg.text for seg in segments]
        X = self._extract_embeddings(texts)
        num_clusters = max(2, min(5, len(segments) // 10))
        
        kmeans = KMeans(n_clusters=num_clusters, random_state=42, n_init=10)
        labels = kmeans.fit_predict(X)
        
        topics = []
        for i in range(num_clusters):
            cluster_texts = [texts[j] for j, label in enumerate(labels) if label == i]
            cluster_full_text = " ".join(cluster_texts)
            
            vectorizer = TfidfVectorizer(stop_words='english', max_features=3)
            try:
                tfidf_matrix = vectorizer.fit_transform([cluster_full_text])
                keywords = vectorizer.get_feature_names_out().tolist()
            except ValueError:
                keywords = ["General Discussion"]
                
            summary = ""
            if len(cluster_full_text.split()) > 30:
                try:
                    res = self.summarizer(cluster_full_text, max_length=50, min_length=10, do_sample=False)
                    summary = res[0]['summary_text']
                except Exception as e:
                    summary = cluster_full_text[:100] + "..."
            else:
                summary = cluster_full_text
                
            topics.append({
                "title": " / ".join(keywords).title() if keywords else "Topic",
                "keywords": keywords,
                "summary": summary
            })
            
        return topics

    def _extract_action_items(self, segments: List[TranscriptSegment]) -> List[Dict[str, str]]:
        tasks = []
        candidate_labels = ["action item or task", "casual conversation", "information sharing"]
        
        for seg in segments:
            lower_text = seg.text.lower()
            if "will" in lower_text or "need to" in lower_text or "can you" in lower_text or "task" in lower_text:
                res = self.classifier(seg.text, candidate_labels)
                top_label = res['labels'][0]
                confidence = res['scores'][0]
                
                if top_label == "action item or task" and confidence > 0.6:
                    tasks.append({
                        "task": seg.text,
                        "assignee": seg.speaker_name,
                        "deadline": "Pending"
                    })
        return tasks

# ---------------------------------------------------------------------------
# FastAPI Endpoint
# ---------------------------------------------------------------------------
fastapi_app = FastAPI()

@fastapi_app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    exc_str = f'{exc}'.replace('\n', ' ').replace('   ', ' ')
    logger.error(f"{request}: {exc_str}")
    content = {'status_code': 10422, 'message': exc_str, 'data': None}
    return JSONResponse(content=content, status_code=422)

@fastapi_app.post("/process")
def process_endpoint(event: AIEvent):
    analyzer = MeetingAnalyzer()
    return analyzer.process_transcript.remote(event)

@app.function()
@modal.asgi_app()
def serve():
    return fastapi_app
