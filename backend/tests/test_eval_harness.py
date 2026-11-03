"""
Evaluation Harness Unit Test (Phase 10).

Runs the 25-case benchmark against the 5-Gate Evidence Verifier pipeline and asserts:
- Precision >= 0.85
- Recall >= 0.75
- F1 Score >= 0.80
- p95 Latency < 100 ms
"""

import pytest
from backend.eval.run_eval import run_evaluation


def test_evaluation_benchmark_precision_and_recall():
    metrics = run_evaluation()

    assert metrics["total_cases"] == 25, "Evaluation dataset must contain 25 benchmark cases"
    assert metrics["precision"] >= 0.85, f"Precision {metrics['precision']} fell below 0.85 SLA"
    assert metrics["recall"] >= 0.75, f"Recall {metrics['recall']} fell below 0.75 SLA"
    assert metrics["f1_score"] >= 0.80, f"F1 Score {metrics['f1_score']} fell below 0.80 target"
    assert metrics["latency_p95_ms"] < 100.0, f"p95 Latency {metrics['latency_p95_ms']}ms exceeded 100ms threshold"

    # Verify confusion matrix properties
    assert metrics["true_positives"] > 0
    assert metrics["true_negatives"] > 0
    assert metrics["false_positives"] == 0 or metrics["precision"] >= 0.85
