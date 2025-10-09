from typing import Dict, Any

def evaluate_dscr(inputs: Dict[str, Any]) -> Dict[str, Any]:
    """
    Deterministic DSCR evaluator with trace.
    Assumes inputs validated by router normalization against TeacherSpec.inputs_schema.
    """
    try:
        noi = float(inputs["noi"])
        ads = float(inputs["annual_debt_service"])
    except Exception as e:
        raise ValueError(f"invalid inputs: {e}")

    if ads == 0:
        dscr = float("inf")
    else:
        dscr = noi / ads

    threshold = 1.20
    passed = dscr >= threshold
    verdict = "PASS" if passed else "FAIL"

    trace = [{
        "rule_id": "DSCR_MIN_1_20",
        "passed": passed,
        "threshold": threshold,
        "value": round(dscr, 4),
        "explanation": "Debt service coverage must be ≥ threshold."
    }]

    return {
        "verdict": verdict,
        "outputs": {"dscr": round(dscr, 4)},
        "trace": trace,
        "effective_version": "1.0.0"
    }
