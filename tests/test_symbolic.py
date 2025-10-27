"""Thorough tests for symbolic reasoning utilities."""

from __future__ import annotations

import math

import pytest

from hydra.symbolic import JSONLogicEngine, RuleComposer, RuleFragment, chain_rules, compile_yaml_rule
from hydra.symbolic.json_logic import JSONLogicError


def test_json_logic_engine_supports_core_operations_and_tracing():
    engine = JSONLogicEngine()
    rule = {
        "+": [
            {"var": "inputs.base"},
            {"max": [1, 2, 3, 10]},
            {"min": [5, 9, 12]},
        ]
    }
    result, trace = engine.evaluate(rule, {"inputs": {"base": 7}})
    assert result == 7 + max([1, 2, 3, 10]) + min([5, 9, 12])
    operations = [step.operation for step in trace]
    assert set(["+", "max", "min", "var"]).issubset(operations)


def test_json_logic_engine_handles_missing_and_merge_operations():
    engine = JSONLogicEngine()

    missing_rule = {"missing": ["foo", "bar"]}
    missing, _ = engine.evaluate(missing_rule, {"foo": 1})
    assert missing == ["bar"]

    merge_rule = {"merge": [[1, 2], [3], 4]}
    merged, _ = engine.evaluate(merge_rule, {})
    assert merged == [1, 2, 3, 4]

    cat_rule = {"cat": ["prefix-", {"var": "metadata.tag"}]}
    cat_result, _ = engine.evaluate(cat_rule, {"metadata": {"tag": "alpha"}})
    assert cat_result == "prefix-alpha"


def test_json_logic_engine_caches_compiled_rules_and_raises_errors():
    engine = JSONLogicEngine()
    rule = {"/": [10, 2]}
    first, _ = engine.evaluate(rule, {})
    second, _ = engine.evaluate(rule, {})
    assert first == 5 and second == 5
    with pytest.raises(JSONLogicError):
        engine.evaluate({"/": [1, 0]}, {})


def test_rule_composer_validates_dependencies_and_generates_fallback():
    composer = RuleComposer()
    composer.add_fragment(
        RuleFragment(
            name="router_match",
            condition={"in": ["dscr", {"var": "metadata.tags"}]},
            consequence={"var": "teacher.dscr"},
            priority=5,
        )
    )
    composer.add_fragment(
        RuleFragment(
            name="transfer",
            condition={"in": ["transfer", {"var": "metadata.tags"}]},
            consequence={"var": "teacher.transfer"},
            dependencies=["router_match"],
            priority=1,
        )
    )
    composer.set_fallback({"var": "default"})
    compiled = composer.compile()
    sequence = compiled["if"]
    assert sequence[0] == {"in": ["dscr", {"var": "metadata.tags"}]}
    assert sequence[1] == {"var": "teacher.dscr"}
    assert sequence[2] == {"in": ["transfer", {"var": "metadata.tags"}]}
    assert sequence[3] == {"var": "teacher.transfer"}
    assert sequence[-1] == {"var": "default"}


def test_rule_composer_rejects_unsatisfied_dependency():
    composer = RuleComposer()
    composer.add_fragment(
        RuleFragment(
            name="child",
            condition={"var": "foo"},
            consequence={"var": "bar"},
            dependencies=["missing"],
        )
    )
    with pytest.raises(ValueError):
        composer.compile()


def test_chain_rules_merges_multiple_fragments():
    merged = chain_rules({"var": "a"}, {"var": "b"}, {"var": "c"})
    assert merged == {"merge": [{"merge": [{"var": "a"}, {"var": "b"}]}, {"var": "c"}]}


def test_yaml_compiler_parses_without_yaml_dependency():
    source = """
name: detect
when:
  in:
    - dscr
    - { var: metadata.tags }
then:
  var: teacher
priority: 2
dependencies:
  - base
"""
    compiled = compile_yaml_rule(source)
    assert compiled.fragment.name == "detect"
    assert compiled.fragment.priority == 2
    assert compiled.fragment.dependencies == ["base"]
    assert compiled.fragment.consequence == {"var": "teacher"}
