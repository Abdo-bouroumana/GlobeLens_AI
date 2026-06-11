# GlobeLens AI — Journalism Summarization Pipeline

A fully **offline** 8-stage NLP pipeline that ingests raw news articles (any language),
enriches them with structured metadata, and stores them in a local vector database
for semantic search.

---

## Pipeline Architecture

```
Raw Article (any language)
        │
        ▼
┌──────────────────────────────────────────────────────────────────┐
│  Stage 1  │  Language Detection   │ XLM-RoBERTa (41 languages)  │
├──────────────────────────────────────────────────────────────────┤
│  Stage 2  │  Translation → EN     │ NLLB-200 (200+ languages)   │
│           │  (skipped if English) │                              │
├──────────────────────────────────────────────────────────────────┤
│  Stage 3  │  Named Entity Recog.  │ XLM-RoBERTa-large           │
│           │  PER · ORG · LOC · DATE                             │
├──────────────────────────────────────────────────────────────────┤
│  Stage 4  │  Topic Classification │ mDeBERTa-v3 zero-shot       │
│           │  14 journalism topics │ (NLI-based, no fine-tuning) │
├──────────────────────────────────────────────────────────────────┤
│  Stage 5  │  Bias Detection       │ DistilRoBERTa               │
│           │  BIASED / NEUTRAL     │ (valurank/distilroberta-bias)│
├──────────────────────────────────────────────────────────────────┤
│  Stage 6  │  LLM Summarization    │ Ollama: aya-expanse:8b      │
│           │  5W1H + sentiment     │ (or qwen2.5:7b-instruct)    │
├──────────────────────────────────────────────────────────────────┤
│  Stage 7  │  Embedding            │ BGE-M3 (1024-dim, cosine)   │
├──────────────────────────────────────────────────────────────────┤
│  Stage 8  │  Vector Storage       │ Qdrant (local file-based)   │
└──────────────────────────────────────────────────────────────────┘
        │
        ▼
 Rich Result Dict  +  Qdrant entry (semantic search ready)
```

---

## Output Schema

Every processed article produces a dict with these fields:

| Field               | Type          | Description                                 |
|---------------------|---------------|---------------------------------------------|
| `title`             | str           | Original headline                           |
| `url`               | str           | Article URL                                 |
| `source`            | str           | News outlet                                 |
| `published_at`      | str \| None   | Publication date                            |
| `detected_language` | str           | ISO language code (e.g. `fr`, `ar`)         |
| `language_confidence`| float        | Model confidence [0–1]                      |
| `was_translated`    | bool          | True if NLLB was used                       |
| `english_text`      | str           | English version of the article              |
| `entities`          | list[dict]    | `{text, label, score, start, end}`          |
| `persons`           | list[str]     | Extracted person names                      |
| `organizations`     | list[str]     | Extracted org names                         |
| `locations`         | list[str]     | Extracted location names                    |
| `topic`             | str           | Top predicted journalism topic              |
| `topic_confidence`  | float         | Classifier confidence                       |
| `ranked_topics`     | list[tuple]   | Top 3 topics with scores                    |
| `bias_label`        | str           | `BIASED` or `NEUTRAL`                       |
| `bias_score`        | float         | Confidence of bias label                    |
| `is_biased`         | bool          | Convenience flag                            |
| `summary`           | str           | 2–4 sentence objective summary              |
| `key_facts`         | list[str]     | Concrete facts extracted by LLM             |
| `who`               | list[str]     | Key people / organizations involved         |
| `what`              | str           | Main event in one sentence                  |
| `where`             | list[str]     | Locations of events                         |
| `when`              | str \| None   | Time frame or date                          |
| `why`               | str \| None   | Context / reasons                           |
| `how`               | str \| None   | How the event unfolded                      |
| `sentiment`         | str           | `positive` / `negative` / `neutral`         |
| `importance`        | str           | `high` / `medium` / `low`                  |
| `tags`              | list[str]     | Keyword tags from LLM                       |
| `processed_at`      | str           | UTC ISO timestamp                           |
| `processing_time_s` | float         | Wall-clock seconds for full pipeline        |
| `vector_id`         | str           | Qdrant point UUID                           |

---

## CLI Usage

```powershell
# Run 3-article multilingual demo (EN · FR · ES)
python run_pipeline.py --mode demo

# Process a single article from JSON
python run_pipeline.py --mode single --input article.json --output result.json

# Semantic search
python run_pipeline.py --mode search --query "climate change summit"
python run_pipeline.py --mode search --query "technology AI" --filter-topic "science and technology"
python run_pipeline.py --mode search --query "guerre conflit" --filter-language fr

# Database stats
python run_pipeline.py --mode stats

# Use qwen model for faster summarization
python run_pipeline.py --mode demo --ollama-model qwen2.5:7b-instruct-q4_K_M
```

### Input JSON format (single mode)

```json
{
  "title":        "Article Headline Here",
  "url":          "https://source.com/article-slug",
  "source":       "BBC News",
  "published_at": "2026-06-03",
  "text":         "Full article body text goes here..."
}
```

---

## Python API

```python
from pipeline import JournalismPipeline

pipeline = JournalismPipeline(
    ollama_model="aya-expanse:8b",   # or "qwen2.5:7b-instruct-q4_K_M"
    use_local_qdrant=True,            # no Qdrant server needed
)

# Process one article
result = pipeline.process(
    text="Full article body...",
    title="Headline",
    url="https://...",
    source="Reuters",
    published_at="2026-06-03",
)

# Process a batch
results = pipeline.process_batch([
    {"text": "...", "title": "...", "url": "...", "source": "..."},
    {"text": "...", "title": "...", "url": "...", "source": "..."},
])

# Semantic search
hits = pipeline.search("climate change agreement", top_k=5)
hits = pipeline.search("election results", topic="politics and government")
hits = pipeline.search("économie", language="fr")

# Stats
print(pipeline.get_stats())
```

---

## Local Models Used

| Model                     | Purpose                    | Size    |
|---------------------------|----------------------------|---------|
| `saved_langdetect_model`  | Language detection         | ~1.1 GB |
| `nllb_model_local`        | Translation (200 languages)| ~5.5 GB |
| `saved_xlm_roberta_ner`   | Named entity recognition   | ~2.2 GB |
| `mdeberta_zero_shot`      | Topic classification       | ~558 MB |
| `bias_model_local`        | Bias detection             | ~328 MB |
| `bge_m3_local`            | Semantic embeddings        | ~2.3 GB |
| **Ollama** (aya-expanse:8b)| LLM summarization         | ~5.0 GB |
| **Qdrant** (local files)  | Vector storage             | —       |

> All models are fully offline. No internet connection required at runtime.

---

## File Structure

```
globelens-scraper/
├── pipeline/
│   ├── __init__.py              # Package exports
│   ├── language_detector.py     # Stage 1 — XLM-RoBERTa lang detection
│   ├── translator.py            # Stage 2 — NLLB-200 translation
│   ├── ner_extractor.py         # Stage 3 — XLM-RoBERTa-large NER
│   ├── topic_classifier.py      # Stage 4 — mDeBERTa zero-shot topics
│   ├── bias_detector.py         # Stage 5 — DistilRoBERTa bias
│   ├── summarizer.py            # Stage 6 — Ollama LLM (5W1H JSON)
│   ├── embedder.py              # Stage 7 — BGE-M3 embeddings
│   ├── vector_store.py          # Stage 8 — Qdrant local storage
│   └── journalism_pipeline.py   # Orchestrator (main class)
├── run_pipeline.py              # CLI entry point
├── hugging-face/                # All downloaded model weights
│   ├── saved_langdetect_model/
│   ├── nllb_model_local/
│   ├── saved_xlm_roberta_ner/
│   ├── mdeberta_zero_shot/
│   ├── bias_model_local/
│   ├── bge_m3_local/
│   └── qdrant_storage/          # Qdrant vector DB files
└── README_pipeline.md           # This file
```
