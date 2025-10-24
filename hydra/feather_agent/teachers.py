"""Teacher execution utilities for the Python feather-agent runtime shim."""

from __future__ import annotations

from typing import Any, Dict, Protocol


class TeacherExecutor(Protocol):
    def __call__(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a deterministic teacher."""


def evaluate_dscr(inputs: Dict[str, Any]) -> Dict[str, Any]:
    try:
        noi = float(inputs["noi"])
        ads = float(inputs["annual_debt_service"])
    except Exception as exc:  # pragma: no cover - validation handled upstream
        raise ValueError(f"invalid inputs: {exc}") from exc

    dscr = float("inf") if ads == 0 else noi / ads
    threshold = 1.20
    passed = dscr >= threshold
    verdict = "PASS" if passed else "FAIL"

    trace = [
        {
            "rule_id": "DSCR_MIN_1_20",
            "passed": passed,
            "threshold": threshold,
            "value": round(dscr, 4),
            "explanation": "Debt service coverage must be ≥ threshold.",
        }
    ]

    return {
        "verdict": verdict,
        "outputs": {"dscr": round(dscr, 4)},
        "trace": trace,
        "effective_version": "1.0.0",
    }


def evaluate_transfer_tax(inputs: Dict[str, Any]) -> Dict[str, Any]:
    try:
        sale_price = float(inputs["sale_price"])
        rate_pct = float(inputs["rate_pct"])
    except Exception as exc:  # pragma: no cover - validation handled upstream
        raise ValueError(f"invalid inputs: {exc}") from exc

    rate = rate_pct / 100.0
    tax = sale_price * rate
    passed = tax >= 0.0
    verdict = "PASS" if passed else "FAIL"

    trace = [
        {
            "rule_id": "TAX_NON_NEGATIVE",
            "passed": passed,
            "threshold": 0.0,
            "value": round(tax, 2),
            "explanation": "Transfer tax must not be negative.",
        }
    ]

    return {
        "verdict": verdict,
        "outputs": {"rate": round(rate, 6), "transfer_tax": round(tax, 2)},
        "trace": trace,
        "effective_version": "1.0.0",
    }


TEACHER_EXECUTORS: Dict[str, TeacherExecutor] = {
    "loan_dscr_v1": evaluate_dscr,
    "transfer_tax_v1": evaluate_transfer_tax,
}
