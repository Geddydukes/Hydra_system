"""Pure Python JSONLogic evaluator with deterministic tracing."""

from __future__ import annotations

import math
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Callable, Dict, Iterable, List, Tuple

JsonLogic = Dict[str, Any]


@dataclass(slots=True)
class EvaluationTrace:
    operation: str
    arguments: List[Any]
    result: Any


class JSONLogicError(Exception):
    """Raised when the engine encounters an invalid rule."""


class JSONLogicEngine:
    def __init__(self) -> None:
        self._operations: Dict[str, Callable[[List[Any], Dict[str, Any]], Any]] = {}
        self._register_default_operations()

    # ------------------------------------------------------------------
    def add_operation(
        self, name: str, handler: Callable[[List[Any], Dict[str, Any]], Any]
    ) -> None:
        if not callable(handler):  # pragma: no cover - defensive guard
            raise TypeError("handler must be callable")
        self._operations[name] = handler

    # ------------------------------------------------------------------
    def evaluate(self, rule: JsonLogic, data: Dict[str, Any]) -> Tuple[Any, List[EvaluationTrace]]:
        import json

        compiled = self._compile_rule(json.dumps(rule, sort_keys=True))
        trace: List[EvaluationTrace] = []
        result = compiled(data, trace)
        return result, trace

    # ------------------------------------------------------------------
    @lru_cache(maxsize=512)
    def _compile_rule(self, rule_json: str) -> Callable[[Dict[str, Any], List[EvaluationTrace]], Any]:
        import json

        rule = json.loads(rule_json)

        def _eval(node: Any) -> Callable[[Dict[str, Any], List[EvaluationTrace]], Any]:
            if not isinstance(node, dict):
                return lambda _data, _trace: node

            if len(node) != 1:
                raise JSONLogicError(f"Invalid JSONLogic node: {node}")

            op, args = next(iter(node.items()))
            if not isinstance(args, list):
                args = [args]

            compiled_args = [_eval(arg) for arg in args]

            if op not in self._operations:
                raise JSONLogicError(f"Unknown operation: {op}")

            operation = self._operations[op]

            def evaluator(data: Dict[str, Any], trace: List[EvaluationTrace]) -> Any:
                evaluated_args = [arg(data, trace) for arg in compiled_args]
                result = operation(evaluated_args, data)
                trace.append(EvaluationTrace(op, evaluated_args, result))
                return result

            return evaluator

        return _eval(rule)

    # ------------------------------------------------------------------
    def _register_default_operations(self) -> None:
        self.add_operation("var", self._op_var)
        self.add_operation("if", self._op_if)
        self.add_operation("and", self._make_reduce(lambda acc, cur: acc and cur, True))
        self.add_operation("or", self._make_reduce(lambda acc, cur: acc or cur, False))
        self.add_operation("!",(lambda args, _data: not args[0]))
        self.add_operation("==", lambda args, _data: args[0] == args[1])
        self.add_operation("!=", lambda args, _data: args[0] != args[1])
        self.add_operation(">", lambda args, _data: _compare(args, lambda a, b: a > b))
        self.add_operation(">=", lambda args, _data: _compare(args, lambda a, b: a >= b))
        self.add_operation("<", lambda args, _data: _compare(args, lambda a, b: a < b))
        self.add_operation("<=", lambda args, _data: _compare(args, lambda a, b: a <= b))
        self.add_operation("+", self._op_arithmetic(lambda a, b: a + b, 0.0))
        self.add_operation("-", self._op_arithmetic(lambda a, b: a - b, 0.0))
        self.add_operation("*", self._op_arithmetic(lambda a, b: a * b, 1.0))
        self.add_operation("/", self._op_divide)
        self.add_operation("min", lambda args, _data: min(args))
        self.add_operation("max", lambda args, _data: max(args))
        self.add_operation("abs", lambda args, _data: abs(args[0]))
        self.add_operation("missing", self._op_missing)
        self.add_operation("merge", self._op_merge)
        self.add_operation("map", self._op_map)
        self.add_operation("filter", self._op_filter)
        self.add_operation("reduce", self._op_reduce)
        self.add_operation("cat", lambda args, _data: "".join(str(arg) for arg in args))
        self.add_operation("in", lambda args, _data: args[0] in args[1])

    # Operation implementations -----------------------------------------
    def _op_var(self, args: List[Any], data: Dict[str, Any]) -> Any:
        if not args:
            raise JSONLogicError("var operation requires an argument")
        path = args[0]
        default = args[1] if len(args) > 1 else None
        if isinstance(path, str):
            value = data
            for key in path.split('.'):
                if isinstance(value, dict) and key in value:
                    value = value[key]
                else:
                    return default
            return value
        if isinstance(path, int):
            return data.get(path, default)
        raise JSONLogicError(f"Invalid var path: {path}")

    def _op_if(self, args: List[Any], data: Dict[str, Any]) -> Any:
        for i in range(0, len(args) - 1, 2):
            condition = args[i]
            consequence = args[i + 1]
            if condition:
                return consequence
        return args[-1] if len(args) % 2 == 1 else None

    def _make_reduce(self, reducer: Callable[[Any, Any], Any], initial: Any) -> Callable[[List[Any], Dict[str, Any]], Any]:
        def operation(args: List[Any], _data: Dict[str, Any]) -> Any:
            value = initial
            for arg in args:
                value = reducer(value, arg)
            return value

        return operation

    def _op_arithmetic(self, func: Callable[[float, float], float], initial: float) -> Callable[[List[Any], Dict[str, Any]], float]:
        def operation(args: List[Any], _data: Dict[str, Any]) -> float:
            value = initial
            for index, arg in enumerate(args):
                number = float(arg)
                if index == 0 and initial != 0.0:
                    value = number
                else:
                    value = func(value, number)
            return value

        return operation

    def _op_divide(self, args: List[Any], _data: Dict[str, Any]) -> float:
        numerator = float(args[0])
        denominator = float(args[1])
        if math.isclose(denominator, 0.0):
            raise JSONLogicError("division by zero")
        return numerator / denominator

    def _op_missing(self, args: List[Any], data: Dict[str, Any]) -> List[str]:
        missing: List[str] = []
        for key in args:
            if isinstance(key, str):
                value = data
                for part in key.split('.'):
                    if isinstance(value, dict) and part in value:
                        value = value[part]
                    else:
                        missing.append(key)
                        break
        return missing

    def _op_merge(self, args: List[Any], _data: Dict[str, Any]) -> List[Any]:
        merged: List[Any] = []
        for arg in args:
            if isinstance(arg, list):
                merged.extend(arg)
            else:
                merged.append(arg)
        return merged

    def _op_map(self, args: List[Any], data: Dict[str, Any]) -> List[Any]:
        array, rule = args
        if not isinstance(array, list):
            raise JSONLogicError("map requires an array")
        result = []
        for element in array:
            sub_data = data.copy()
            sub_data["current"] = element
            result.append(self.evaluate(rule, sub_data)[0])
        return result

    def _op_filter(self, args: List[Any], data: Dict[str, Any]) -> List[Any]:
        array, rule = args
        if not isinstance(array, list):
            raise JSONLogicError("filter requires an array")
        result = []
        for element in array:
            sub_data = data.copy()
            sub_data["current"] = element
            if self.evaluate(rule, sub_data)[0]:
                result.append(element)
        return result

    def _op_reduce(self, args: List[Any], data: Dict[str, Any]) -> Any:
        array, rule, initial = args
        if not isinstance(array, list):
            raise JSONLogicError("reduce requires an array")
        accumulator = initial
        for element in array:
            sub_data = data.copy()
            sub_data["current"] = element
            sub_data["accumulator"] = accumulator
            accumulator = self.evaluate(rule, sub_data)[0]
        return accumulator


def _compare(args: Iterable[Any], comparator: Callable[[Any, Any], bool]) -> bool:
    iterator = iter(args)
    try:
        previous = next(iterator)
    except StopIteration:
        return True
    for current in iterator:
        if not comparator(previous, current):
            return False
        previous = current
    return True
