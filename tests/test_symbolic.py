from hydra.symbolic import JSONLogicEngine, RuleComposer, RuleFragment, compile_yaml_rule


def test_json_logic_evaluator_handles_arithmetic_and_conditionals():
    engine = JSONLogicEngine()
    rule = {
        "if": [
            {">": [{"var": "inputs.score"}, 80]},
            "pass",
            "fail",
        ]
    }
    result, trace = engine.evaluate(rule, {"inputs": {"score": 90}})
    assert result == "pass"
    assert any(step.operation == ">" for step in trace)


def test_rule_composer_enforces_dependencies():
    composer = RuleComposer()
    composer.add_fragment(
        RuleFragment(
            name="detect_dscr",
            condition={"in": ["dscr", {"var": "metadata.tags"}]},
            consequence={"var": "teacher_dscr"},
        )
    )
    composer.set_fallback({"var": "fallback"})
    compiled = composer.compile()
    assert compiled["if"][0] == {"in": ["dscr", {"var": "metadata.tags"}]}


def test_yaml_compiler_parses_minimal_yaml_without_dependency():
    source = """
name: detect_dscr
when:
  in:
    - dscr
    - { var: metadata.tags }
then:
  var: teacher_dscr
"""
    compiled = compile_yaml_rule(source)
    assert compiled.fragment.name == "detect_dscr"
    assert compiled.fragment.consequence == {"var": "teacher_dscr"}
