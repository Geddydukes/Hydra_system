"""Tests for LLM utilities, registries, and reinforcement learning helpers."""

from __future__ import annotations

from pathlib import Path

from hydra.llm import DeterministicLLM, HybridArbiter, PromptManager, PromptTemplate
from hydra.llm.registry import AutoUpdatePipeline, TeacherRegistry
from hydra.rl.trainer import PreferenceSample, PreferenceTrainer


def test_prompt_manager_and_deterministic_llm():
    manager = PromptManager()
    manager.register(PromptTemplate("greeting", "Hello {{person}}"))
    prompt = manager.render("greeting", person="Hydra")
    assert prompt == "Hello Hydra"

    engine = DeterministicLLM({prompt.lower(): "Hello Hydra"})
    assert engine.generate(prompt) == "Hello Hydra"
    fallback = engine.generate("Unknown prompt")
    assert fallback.startswith("LLM-FALLBACK:")


def test_hybrid_arbiter_prefers_symbolic_when_confident():
    def symbolic_executor(query: str, metadata):
        return {"success": True, "confidence": 0.9, "answer": "symbolic"}

    arbiter = HybridArbiter(symbolic_executor, DeterministicLLM({}), threshold=0.7)
    decision = arbiter.execute("Question")
    assert decision.route == "symbolic"
    assert decision.result["success"] is True

    def weak_symbolic(query: str, metadata):
        return {"success": True, "confidence": 0.2}

    arbiter = HybridArbiter(weak_symbolic, DeterministicLLM({"question": "fallback"}), threshold=0.7)
    decision = arbiter.execute("question")
    assert decision.route == "llm"
    assert "response" in decision.result["llm"]


def test_teacher_registry_loads_specs_and_auto_update():
    registry_root = Path("registry")
    schema_path = Path("schema/TeacherSpec.schema.json")
    registry = TeacherRegistry(registry_root, schema_path)
    teachers = registry.list_teachers()
    assert "loan_dscr_v1" in teachers
    spec = registry.resolve("loan_dscr_v1")
    assert spec.path.exists()

    pipeline = AutoUpdatePipeline(registry, interval=0.0)
    assert pipeline.tick() is True


def test_preference_trainer_learns_from_samples():
    trainer = PreferenceTrainer(learning_rate=0.5)
    trainer.add_sample(PreferenceSample(symbolic_score=0.9, llm_score=0.3, preferred="symbolic"))
    trainer.add_sample(PreferenceSample(symbolic_score=0.2, llm_score=0.8, preferred="llm"))
    trainer.train(epochs=100)
    prediction_symbolic = trainer.predict(0.9, 0.3)
    prediction_llm = trainer.predict(0.2, 0.8)
    assert prediction_symbolic in {"symbolic", "llm"}
    assert prediction_symbolic != prediction_llm
