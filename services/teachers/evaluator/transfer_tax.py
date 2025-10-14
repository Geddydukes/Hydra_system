from typing import Dict, Any

def evaluate_transfer_tax(inputs: Dict[str, Any]) -> Dict[str, Any]:
    try:
        sale_price = float(inputs["sale_price"])
        rate_pct = float(inputs["rate_pct"])
    except Exception as e:
        raise ValueError(f"invalid inputs: {e}")

    rate = rate_pct / 100.0
    tax = sale_price * rate
    passed = tax >= 0.0  # trivial rule; fails only on negative values
    verdict = "PASS" if passed else "FAIL"

    trace = [{
        "rule_id": "TAX_NON_NEGATIVE",
        "passed": passed,
        "threshold": 0.0,
        "value": round(tax, 2),
        "explanation": "Transfer tax must not be negative."
    }]

    return {
        "verdict": verdict,
        "outputs": {
            "rate": round(rate, 6),
            "transfer_tax": round(tax, 2)
        },
        "trace": trace,
        "effective_version": "1.0.0"
    }
