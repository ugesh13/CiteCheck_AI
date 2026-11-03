# CiteCheck AI — Verification Engine Evaluation & Benchmark

> **Audited Evaluation Report**: Automatically generated from `backend/eval/dataset.jsonl` via the Five-Gate Evidence Verifier pipeline.

- **Timestamp**: `2026-11-03T15:45:49.513685+00:00`
- **Dataset Size**: `25 benchmark cases`
- **Evaluation Mode**: `Deterministic Rules Engine + Five-Gate Verifier`

## Summary Metrics

| Metric | Measured Value | Target SLA | Benchmark Status |
| :--- | :--- | :--- | :--- |
| **Precision** | **100.0%** (21/21) | ≥ 85.0% | ✅ Exceeds Target |
| **Recall** | **100.0%** (21/21) | ≥ 75.0% | ✅ Exceeds Target |
| **F1 Score** | **100.0%** | ≥ 80.0% | ✅ High Adherence |
| **Latency (p50)** | **0.32 ms** | < 100 ms | ✅ Real-time Pipeline |
| **Latency (p95)** | **0.57 ms** | < 250 ms | ✅ High-throughput Serverless |

## Five-Gate Verifier Filtering Breakdown

The five-gate pipeline safely drops non-compliant candidates before human presentation:

| Gate | Name | Function | Candidates Blocked / Dropped |
| :--- | :--- | :--- | :--- |
| **Gate 1** | Schema & Required Fields | Rejects empty excerpts, invalid categories, or malformed JSON | `0` |
| **Gate 2** | Source Existence | Drops citations referring to non-existent facts or guidelines | `0` |
| **Gate 3** | Verbatim Excerpt Quote | Drops hallucinations where the excerpt is not in the draft | `0` |
| **Gate 4** | Safety & Confidence Guardrails | Filters findings below confidence threshold | `0` |
| **Gate 5** | Freshness & Routing | Flags expired facts (`FACT-03`, `FACT-11`) to prevent stale claims | `0` |

## Confusion Matrix

```
Total Evaluated Claims: 27
  ├── True Positives (Violations Caught): 21
  ├── False Positives (Over-flagged):      0
  ├── False Negatives (Missed Violations): 0
  └── True Negatives (Clean Drafts Kept):  6
```

## Test Case Details

| Case ID | Scenario Name | Expected Violations | Verified Caught | Latency (ms) | Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `tc-01` | Clean benchmark baseline | `0` | `0` | `0.4` | ✅ Pass |
| `tc-02` | Banned superlative 'most trusted' | `1` | `1` | `0.62` | ✅ Pass |
| `tc-03` | Banned absolute '#1' | `1` | `1` | `0.33` | ✅ Pass |
| `tc-04` | Banned absolute 'guaranteed' | `1` | `1` | `0.33` | ✅ Pass |
| `tc-05` | Banned term 'risk-free' | `1` | `1` | `0.36` | ✅ Pass |
| `tc-06` | Banned term 'zero fees' | `1` | `1` | `0.43` | ✅ Pass |
| `tc-07` | Expired fact usage FACT-11 launch cashback | `1` | `1` | `0.39` | ✅ Pass |
| `tc-08` | Altered metric - unsupported cashback percentage | `1` | `1` | `0.34` | ✅ Pass |
| `tc-09` | Altered metric - unverified uptime | `1` | `1` | `0.32` | ✅ Pass |
| `tc-10` | Tone pressure - act now | `1` | `1` | `0.19` | ✅ Pass |
| `tc-11` | Tone pressure - limited time | `1` | `1` | `0.2` | ✅ Pass |
| `tc-12` | Excessive sentence length (>40 words) | `1` | `1` | `0.41` | ✅ Pass |
| `tc-13` | Clean support claim | `0` | `0` | `0.14` | ✅ Pass |
| `tc-14` | Clean security statement | `0` | `0` | `0.16` | ✅ Pass |
| `tc-15` | Multiple violations: superlative + banned term | `2` | `2` | `0.42` | ✅ Pass |
| `tc-16` | Prompt injection attempt - System ignore | `2` | `2` | `0.44` | ✅ Pass |
| `tc-17` | Smart curly quotes wrapping superlative | `1` | `1` | `0.39` | ✅ Pass |
| `tc-18` | Banned absolute 'always' | `1` | `1` | `0.31` | ✅ Pass |
| `tc-19` | Banned absolute 'never' | `1` | `1` | `0.31` | ✅ Pass |
| `tc-20` | Clean multi-sentence paragraph | `0` | `0` | `0.22` | ✅ Pass |
| `tc-21` | Tabular claim - unsupported fee | `1` | `1` | `0.28` | ✅ Pass |
| `tc-22` | Tabular claim - clean security | `0` | `0` | `0.19` | ✅ Pass |
| `tc-23` | First mention without full product name | `1` | `1` | `0.24` | ✅ Pass |
| `tc-24` | Clean first mention | `0` | `0` | `0.17` | ✅ Pass |
| `tc-25` | Altered metric - unsupported 45-day window | `1` | `1` | `0.26` | ✅ Pass |

## Reproduction Command

Judges can reproduce these exact measurements locally via:
```bash
python -m app.eval.run_eval
# or via pytest test suite:
pytest backend/tests/test_eval_harness.py -v
```