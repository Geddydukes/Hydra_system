from pathlib import Path

from hydra.llm import DeterministicLLM, HybridArbiter, PolicyWatcher, TeacherRegistry
from hydra.rl.trainer import PreferenceSample, PreferenceTrainer


def test_preference_trainer_prefers_symbolic_after_training():
    trainer = PreferenceTrainer(learning_rate=0.2)
    trainer.add_sample(PreferenceSample(1.0, 0.2, "symbolic"))
    trainer.add_sample(PreferenceSample(0.5, 1.0, "llm"))
    trainer.train(epochs=100)
    assert trainer.predict(1.0, 0.5) == "symbolic"


def test_teacher_registry_validates_specs():
    registry = TeacherRegistry(Path("registry"), Path("schema/TeacherSpec.schema.json"))
    registry.register_executor("loan_dscr_v1", lambda inputs: inputs)
    spec = registry.resolve("loan_dscr_v1")
    assert spec.teacher_id == "loan_dscr_v1"
    assert registry.get_executor("loan_dscr_v1")({"value": 1}) == {"value": 1}


def test_policy_watcher_detects_updates():
    source = {"policy": "initial"}
    watcher = PolicyWatcher(lambda: source.copy())
    assert watcher.poll() == ["new_policy:policy"]
    source["policy"] = "updated"
    assert "updated_policy:policy" in watcher.poll()


def test_hybrid_arbiter_uses_llm_when_confidence_low():
    def symbolic_executor(query: str, metadata):
        return {"success": True, "confidence": 0.1}

    arbiter = HybridArbiter(symbolic_executor, DeterministicLLM({"hi": "hello"}), threshold=0.8)
    decision = arbiter.execute("hi")
    assert decision.route == "llm"
    assert decision.result["llm"]["response"] == "hello"
