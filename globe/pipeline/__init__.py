"""
GlobeLens AI — Journalism Summarization Pipeline
"""
from pipeline.journalism_pipeline import JournalismPipeline
from pipeline.data_models import SynthesisOutput, ClusterState, FactObject, SentenceMapping

__all__ = [
    "JournalismPipeline",
    "SynthesisOutput",
    "ClusterState", 
    "FactObject",
    "SentenceMapping"
]
__version__ = "2.0.0"
