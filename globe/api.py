"""
GlobeLens AI — FastAPI Application
====================================
Serves the pipeline as a REST API.

Endpoints:
  • POST /ingest   — Ingest an article and route to a cluster
  • POST /synthesize/{cluster_id} — Trigger synthesis for a cluster
  • GET  /clusters — List all clusters
  • GET  /clusters/{cluster_id} — Get full synthesis output for a cluster
"""

import json
import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel

from pipeline.journalism_pipeline import JournalismPipeline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global pipeline instance
pipeline: JournalismPipeline | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load models on startup, clean up on shutdown."""
    global pipeline
    logger.info("Starting up FastAPI server, loading models...")
    pipeline = JournalismPipeline(use_local_qdrant=True)
    logger.info("Models loaded.")
    yield
    # Shutdown: nothing to explicitly free (models GC'd naturally)
    logger.info("Shutting down GlobeLens AI.")


app = FastAPI(title="GlobeLens AI Journalism Pipeline", lifespan=lifespan)


# ─── API Models ──────────────────────────────────────────────────────────────

class IngestRequest(BaseModel):
    text: str
    title: str
    url: str
    source: str
    published_at: str | None = None
    content_type: str = "article"
    credibility: str = "outlet-level"

class IngestResponse(BaseModel):
    cluster_id: str
    action: str
    message: str


# ─── Endpoints ───────────────────────────────────────────────────────────────

@app.post("/ingest", response_model=IngestResponse)
def ingest_article(req: IngestRequest, background_tasks: BackgroundTasks):
    """Ingest a single piece of content and route it to an event cluster."""
    if not pipeline:
        raise HTTPException(503, "Pipeline not ready")

    try:
        cluster_id, action = pipeline.ingest(
            text=req.text,
            title=req.title,
            url=req.url,
            source=req.source,
            published_at=req.published_at,
            content_type=req.content_type,
            credibility=req.credibility
        )

        # Auto-trigger synthesis in background if conditions met
        cluster = pipeline.cluster_manager.get_cluster(cluster_id)
        if cluster and cluster.synthesis_ready:
            if action in ("new", "active", "duplicate"):
                logger.info(f"Queueing background synthesis for cluster {cluster_id}")
                background_tasks.add_task(pipeline.synthesize, cluster_id)

        return IngestResponse(
            cluster_id=cluster_id,
            action=action,
            message=f"Ingested and routed as '{action}'"
        )
    except Exception as exc:
        logger.error(f"Ingest failed: {exc}")
        raise HTTPException(500, str(exc))


@app.post("/synthesize/{cluster_id}")
def trigger_synthesis(cluster_id: str):
    """Manually trigger synthesis for a cluster."""
    if not pipeline:
        raise HTTPException(503, "Pipeline not ready")
        
    try:
        output = pipeline.synthesize(cluster_id)
        if not output:
            raise HTTPException(404, "Cluster not found or no sentences available")
        return {"status": "success", "cluster_id": cluster_id}
    except Exception as exc:
        logger.error(f"Synthesis failed: {exc}")
        raise HTTPException(500, str(exc))


@app.get("/clusters")
def list_clusters():
    """List all known event clusters."""
    if not pipeline:
        raise HTTPException(503, "Pipeline not ready")
        
    clusters = pipeline.cluster_manager.get_all_clusters()
    return [{
        "cluster_id": c.cluster_id,
        "topic": c.fingerprint.primary_entities,
        "action": c.fingerprint.event_action,
        "source_count": c.source_count,
        "status": c.status,
        "has_synthesis": bool(c.synthesis_text),
        "last_updated": c.last_updated
    } for c in clusters]


@app.get("/clusters/{cluster_id}")
def get_cluster_synthesis(cluster_id: str):
    """Get the full synthesis output and hover payloads for a cluster."""
    if not pipeline:
        raise HTTPException(503, "Pipeline not ready")
        
    cluster = pipeline.cluster_manager.get_cluster(cluster_id)
    if not cluster:
        raise HTTPException(404, "Cluster not found")
        
    if not cluster.synthesis_text:
        return {"status": "pending", "message": "Synthesis not yet generated (needs 2+ sources)"}
        
    # Build output from stored state
    # A full implementation would persist the SynthesisOutput object
    return {
        "cluster_id": cluster.cluster_id,
        "synthesis": json.loads(cluster.synthesis_text),
        # Assuming the UI will hit a specific endpoint for hover, 
        # but returning it all here for simplicity in this demo.
        "source_count": cluster.source_count,
        "outlets": cluster.outlets
    }