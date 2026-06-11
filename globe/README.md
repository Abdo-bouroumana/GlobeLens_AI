# GlobeLens AI — Cross-Lingual Journalism Intelligence Pipeline

A multi-source, multilingual news analysis pipeline that ingests articles in any language, clusters them by event, deduplicates facts across sources, detects contradictions and bias, and synthesizes a structured journalistic report with per-sentence attribution.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.10 – 3.12 | 3.10 recommended |
| [Ollama](https://ollama.ai) | Latest | For LLM synthesis |
| CUDA (optional) | 11.8+ | GPU acceleration |

---

## 1 — Install Python Dependencies

```bash
pip install -r requirements.txt
python -m spacy download xx_sent_ud_sm
```

> **GPU users:** Install the CUDA build of PyTorch first:
> ```bash
> pip install torch --index-url https://download.pytorch.org/whl/cu118
> ```

---

## 2 — HuggingFace Model Layout

All models must be saved locally under a single root folder.  
**Your path:** `C:\Users\amine\OneDrive\Desktop\hugging-face`

Required sub-folders (exact names):

```
hugging-face/
├── saved_langdetect_model/     # XLM-RoBERTa language identification
├── nllb_model_local/           # NLLB-200 translation (facebook/nllb-200-distilled-600M)
├── saved_xlm_roberta_ner/      # XLM-RoBERTa-large NER
├── mdeberta_zero_shot/         # mDeBERTa-v3-base zero-shot classifier
├── bias_model_local/           # valurank/distilroberta-bias
├── bge_m3_local/               # BAAI/bge-m3 embeddings
└── qdrant_storage/             # Qdrant vector DB (auto-created)
```

---

## 3 — Set the HuggingFace Path

The pipeline reads the `HF_MODEL_DIR` environment variable.  
Set it to your folder **before** starting the server.

**Windows (PowerShell):**
```powershell
$env:HF_MODEL_DIR = "C:\Users\amine\OneDrive\Desktop\hugging-face"
```

**Windows (Command Prompt):**
```cmd
set HF_MODEL_DIR=C:\Users\amine\OneDrive\Desktop\hugging-face
```

**Linux / macOS:**
```bash
export HF_MODEL_DIR="/path/to/hugging-face"
```

> If `HF_MODEL_DIR` is not set, the pipeline defaults to a `hugging-face/` folder two levels above the `pipeline/` directory (i.e. sibling of the project root).

---

## 4 — Start Ollama

Pull the synthesis model and start the server:

```bash
ollama pull aya-expanse:8b
ollama serve
```

The API defaults to `http://localhost:11434`. Override with `ollama_url` in `JournalismPipeline(...)`.

---

## 5 — Run the API Server

From the `globe/` directory:

```bash
cd C:\Users\amine\OneDrive\Desktop\globe\globe

# Windows PowerShell
$env:HF_MODEL_DIR = "C:\Users\amine\OneDrive\Desktop\hugging-face"
uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```

The server starts at **http://localhost:8000**  
Interactive docs: **http://localhost:8000/docs**

---

## 6 — API Usage

### Ingest an article
```bash
curl -X POST http://localhost:8000/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Full article body text here...",
    "title": "Article headline",
    "url": "https://example.com/article",
    "source": "Example News",
    "published_at": "2024-11-20T10:00:00Z",
    "content_type": "article",
    "credibility": "outlet-level"
  }'
```

Response:
```json
{ "cluster_id": "uuid", "action": "new", "message": "Ingested and routed as 'new'" }
```

`action` values: `new` | `active` | `follow_up` | `duplicate`

### Trigger synthesis
Synthesis runs automatically in the background once 2+ sources join a cluster. To trigger manually:
```bash
curl -X POST http://localhost:8000/synthesize/<cluster_id>
```

### List clusters
```bash
curl http://localhost:8000/clusters
```

### Get synthesis output
```bash
curl http://localhost:8000/clusters/<cluster_id>
```

---

## 7 — Pipeline Architecture

```
Article Text
    │
    ▼
[1] Language Detection  (XLM-RoBERTa langid)
    │
    ▼
[2] Sentence Splitting  (spaCy xx_sent_ud_sm)
    │
    ▼
[3] NER — Native Text   (XLM-RoBERTa-large NER)
    │  is_valid_entity() guard filters hallucination artifacts
    ▼
[4] Translation → EN    (NLLB-200)
    │  Translated entities re-validated with is_valid_entity()
    ▼
[5] Fingerprint Extract → Cluster Match / Create
    │  Entity overlap + semantic similarity (BGE-M3)
    ▼
[6] Bias Detection      (distilroberta-bias, threshold=0.65)
    │  bias_score + bias_type (loaded_language / framing / institutional / nationalistic)
    ▼
[7] Embed               (BGE-M3)
    │
    ▼
[8] Vector Store        (Qdrant local)

── On synthesis trigger ──────────────────────────────────────────
[9]  Intra-source dedup  (cosine 0.92 / Jaccard 0.60)
[10] Cross-source dedup  → FactObjects with confirmation counts
[11] Coverage floor      → reinstate dropped numeric/geopolitical facts
[12] Contradiction detect → structured A-vs-B pairs
[13] Section classify    (mDeBERTa-v3 zero-shot, 13 labels)
[14] Bias aggregate      (cluster-level frequency map)
[15] LLM Synthesis       (Ollama aya-expanse:8b)
[16] Attribution Lock    (BGE-M3 sentence matching)
    │
    ▼
SynthesisOutput (sections + hover_payloads + bias_distribution)
```

---

## 8 — Fixes Applied (Change Log)

| # | Fix | Files |
|---|-----|-------|
| 1 | `is_valid_entity()` guard — blocks NLLB hallucination fragments from becoming cluster titles | `ner_extractor.py` |
| 2 | Fingerprint uses native-text entities only; translated entities re-validated | `ner_extractor.py`, `journalism_pipeline.py` |
| 3 | Intra-source dedup before cross-source comparison | `compressor.py` |
| 4 | Coverage floor — reinstated dropped numeric/geopolitical single-source facts with `flagged_single_source=True` | `compressor.py`, `data_models.py` |
| 5 | Structured A-vs-B contradiction pairs (replaces flat outlet/text dict) | `compressor.py` |
| 6 | Calibrated bias threshold (0.65) + differentiated `bias_type` field | `bias_detector.py`, `data_models.py` |
| 7 | `summarizer.py` contradiction parser handles both old and new formats | `summarizer.py` |
| 8 | LLM prompt — explicit rules to never omit single-source numeric/geopolitical facts | `summarizer.py` |
| 9 | `flagged_single_source` field added to `FactObject` | `data_models.py` |
| 10 | `HF_MODEL_DIR` env var replaces hardcoded relative path | `journalism_pipeline.py` |
| 11 | FastAPI `lifespan` replaces deprecated `@app.on_event("startup")` | `api.py` |

---

## 9 — Troubleshooting

**`FileNotFoundError` on model load:**  
Check `HF_MODEL_DIR` points to the right folder and all sub-folders exist.

**`sentencepiece` / `protobuf` errors:**  
```bash
pip install sentencepiece protobuf --upgrade
```

**Ollama timeout during synthesis:**  
Increase `timeout` in `Summarizer.__init__()` (default: 300 s) or use a smaller model.

**Qdrant fails to start:**  
Delete the `qdrant_storage/` folder and let it recreate.

**Empty cluster entities / Washington title bug:**  
Fixed by `is_valid_entity()` in `ner_extractor.py`. If it recurs, check NLLB is receiving full sentences, not fragments.