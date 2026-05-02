from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import numpy as np
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer
from transformers import pipeline, AutoModelForSeq2SeqLM, AutoTokenizer
import uvicorn
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Minutely AI Insights Service")

# ---------------------------------------------------------------------------
# ML Models Initialization
# ---------------------------------------------------------------------------
logger.info("Loading Sentence Embeddings pipeline...")
embedder = pipeline("feature-extraction", model="sentence-transformers/all-MiniLM-L6-v2")

logger.info("Loading Zero-Shot Classifier for Tasks...")
classifier = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")

logger.info("Loading Sequence-to-Sequence Summarizer (BART)...")
summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

# ---------------------------------------------------------------------------
# API Schemas
# ---------------------------------------------------------------------------
class TranscriptSegment(BaseModel):
    speaker_name: str
    text: str
    start_secs: float
    end_secs: float

class AIEvent(BaseModel):
    meeting_id: str
    transcript_id: str
    segments: List[TranscriptSegment]
    full_text: str
    participants: List[str]
    duration_secs: float
    source: str

# ---------------------------------------------------------------------------
# Core AI Pipeline Methods
# ---------------------------------------------------------------------------

def extract_embeddings(texts: List[str]) -> np.ndarray:
    """Generate dense vector embeddings for clustering."""
    embeddings = []
    for text in texts:
        # Extract the pooled sentence embedding
        output = embedder(text, return_tensors=False)
        # Average pooling over tokens to get a single vector per sentence
        vec = np.mean(output[0], axis=0)
        embeddings.append(vec)
    return np.array(embeddings)

def extract_topics_kmeans(segments: List[TranscriptSegment]) -> List[Dict[str, Any]]:
    """Use K-Means clustering to group transcript segments into discussion topics."""
    if len(segments) < 3:
        return []
        
    texts = [seg.text for seg in segments]
    
    # 1. Vectorization (NLP Preprocessing)
    X = extract_embeddings(texts)
    
    # 2. Determine K (roughly 1 topic per 10 segments, min 2, max 5)
    num_clusters = max(2, min(5, len(segments) // 10))
    
    # 3. K-Means Clustering (Unsupervised ML)
    kmeans = KMeans(n_clusters=num_clusters, random_state=42, n_init=10)
    labels = kmeans.fit_predict(X)
    
    topics = []
    for i in range(num_clusters):
        cluster_texts = [texts[j] for j, label in enumerate(labels) if label == i]
        cluster_full_text = " ".join(cluster_texts)
        
        # 4. TF-IDF Keyword Extraction for Topic Labeling
        vectorizer = TfidfVectorizer(stop_words='english', max_features=3)
        try:
            tfidf_matrix = vectorizer.fit_transform([cluster_full_text])
            keywords = vectorizer.get_feature_names_out().tolist()
        except ValueError:
            keywords = ["General Discussion"]
            
        # 5. Summarize the cluster (Seq2Seq Model)
        summary = ""
        if len(cluster_full_text.split()) > 30:
            try:
                res = summarizer(cluster_full_text, max_length=50, min_length=10, do_sample=False)
                summary = res[0]['summary_text']
            except Exception as e:
                logger.error(f"Summarizer error: {e}")
                summary = cluster_full_text[:100] + "..."
        else:
            summary = cluster_full_text
            
        topics.append({
            "title": " / ".join(keywords).title() if keywords else "Topic",
            "keywords": keywords,
            "summary": summary
        })
        
    return topics

def extract_action_items(segments: List[TranscriptSegment]) -> List[Dict[str, str]]:
    """Use Zero-Shot Classification to detect tasks and extract intent."""
    tasks = []
    candidate_labels = ["action item or task", "casual conversation", "information sharing"]
    
    for seg in segments:
        # 1. Rule-based pre-filter (heuristic to save compute)
        lower_text = seg.text.lower()
        if "will" in lower_text or "need to" in lower_text or "can you" in lower_text or "task" in lower_text:
            
            # 2. Perceptron/Classifier confidence check
            res = classifier(seg.text, candidate_labels)
            top_label = res['labels'][0]
            confidence = res['scores'][0]
            
            if top_label == "action item or task" and confidence > 0.6:
                tasks.append({
                    "task": seg.text,
                    "assignee": seg.speaker_name,
                    "deadline": "Pending" # Could use NER (Named Entity Recognition) to extract dates here
                })
    return tasks

# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------

@app.post("/process")
def process_transcript(event: AIEvent):
    logger.info(f"Processing meeting {event.meeting_id} with {len(event.segments)} segments")
    
    if not event.segments:
        return {"executive_summary": "No discussion occurred.", "topics": [], "action_items": []}

    try:
        # Phase 1: Topic Clustering & Summarization
        logger.info("Running K-Means Clustering...")
        topics = extract_topics_kmeans(event.segments)
        
        # Phase 2: Action Item Classification
        logger.info("Running Action Item Classification...")
        action_items = extract_action_items(event.segments)
        
        # Phase 3: Overall Executive Summary
        logger.info("Generating Executive Summary...")
        full_text = event.full_text
        if len(full_text.split()) > 40:
            # Chunking to avoid exceeding max_length of BART
            chunk = " ".join(full_text.split()[:500])
            exec_summary = summarizer(chunk, max_length=100, min_length=30, do_sample=False)[0]['summary_text']
        else:
            exec_summary = full_text

        # Combine into structured JSON output
        result = {
            "executive_summary": exec_summary,
            "topics": topics,
            "action_items": action_items
        }
        
        logger.info("AI Processing Complete.")
        return result
        
    except Exception as e:
        logger.error(f"Error in processing: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
