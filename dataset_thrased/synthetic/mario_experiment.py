"""
MARIO Experiment Runner — Full 50k Evaluation
===============================================
Loads mario_dataset.json and evaluates your PromptShield system.
Produces mario_results.json with all numbers for Sections V and VI.

HOW TO RUN:
  1. Place BOTH files in the ROOT of your PromptShield project:
       generate_dataset.py    <- run this first
       mario_experiment.py    <- run this second

  2. Run in order:
       python generate_dataset.py
       python mario_experiment.py

  3. Paste mario_results.json back to Claude.
"""

import os, sys, json, time, random

sys.path.insert(0, os.path.dirname(__file__))

DATASET_PATH = os.path.join(os.path.dirname(__file__), "mario_dataset.json")
print("Loading dataset...")
if not os.path.exists(DATASET_PATH):
    print("ERROR: mario_dataset.json not found. Run: python generate_dataset.py first.")
    sys.exit(1)

with open(DATASET_PATH, "r", encoding="utf-8") as f:
    full_dataset = json.load(f)

SAMPLE = None  # Set to 5000 for a quick test run
if SAMPLE:
    random.seed(42)
    benign = [d for d in full_dataset if d["label"] == 0]
    inject = [d for d in full_dataset if d["label"] == 1]
    half = SAMPLE // 2
    dataset = random.sample(benign, min(half, len(benign))) + random.sample(
        inject, min(half, len(inject))
    )
    random.shuffle(dataset)
    print(f"Sampled {len(dataset)} from {len(full_dataset)} total")
else:
    dataset = full_dataset
    print(f"Full dataset: {len(dataset):,} samples")

print(f"  Benign:    {sum(1 for d in dataset if d['label'] == 0):,}")
print(f"  Injection: {sum(1 for d in dataset if d['label'] == 1):,}")

print("\nLoading PromptShield model...")
try:
    from services.ml_service import InjectionDetector

    detector = InjectionDetector()
    detector.load()
    print("Model loaded.")
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)


def compute_metrics(results, threshold=0.50):
    tp = fp = tn = fn = 0
    for r in results:
        pred = 1 if r["risk_score"] >= threshold else 0
        truth = r["label"]
        if pred == 1 and truth == 1:
            tp += 1
        elif pred == 1 and truth == 0:
            fp += 1
        elif pred == 0 and truth == 0:
            tn += 1
        elif pred == 0 and truth == 1:
            fn += 1
    total = tp + fp + tn + fn
    acc = (tp + tn) / total if total else 0
    prec = tp / (tp + fp) if (tp + fp) else 0
    rec = tp / (tp + fn) if (tp + fn) else 0
    f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0
    fpr = fp / (fp + tn) if (fp + tn) else 0
    byp = fn / (fn + tp) if (fn + tp) else 0
    return {
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1": round(f1, 4),
        "fpr": round(fpr, 4),
        "bypass_rate": round(byp, 4),
        "tp": tp,
        "fp": fp,
        "tn": tn,
        "fn": fn,
    }


# ── Experiment 1 ─────────────────────────────────────────────────────────────
print("\n[1/4] Full MARIO evaluation...")
full_results = []
latencies = []
for i, sample in enumerate(dataset):
    t0 = time.perf_counter()
    result = detector.compute_risk_score(sample["text"])
    latencies.append((time.perf_counter() - t0) * 1000)
    full_results.append(
        {
            "text": sample["text"][:80],
            "label": sample["label"],
            "obfuscation": sample["obfuscation"],
            "risk_score": result["risk_score"],
            "components": result["components"],
        }
    )
    if (i + 1) % 5000 == 0:
        print(f"  {i + 1:,}/{len(dataset):,}...")

main_metrics = compute_metrics(full_results)
lat = {
    "mean_ms": round(sum(latencies) / len(latencies), 3),
    "min_ms": round(min(latencies), 3),
    "max_ms": round(max(latencies), 3),
    "p95_ms": round(sorted(latencies)[int(len(latencies) * 0.95)], 3),
    "p99_ms": round(sorted(latencies)[int(len(latencies) * 0.99)], 3),
}
print(
    f"  Acc={main_metrics['accuracy']:.4f} F1={main_metrics['f1']:.4f} "
    f"FPR={main_metrics['fpr']:.4f} Bypass={main_metrics['bypass_rate']:.4f}"
)
print(f"  Latency: mean={lat['mean_ms']}ms p99={lat['p99_ms']}ms")

# ── Experiment 2 — Ablation ───────────────────────────────────────────────────
print("\n[2/4] Ablation study...")


def ablation_run(disable=None):
    out = []
    for r in full_results:
        c = r["components"]
        ml = 0.0 if disable == "ml" else c["ml_prediction"]
        sem = 0.0 if disable == "sem" else c["semantic_similarity"]
        kw = 0.0 if disable == "kw" else c["keyword_anomaly"]
        chain = 0.0 if disable == "chain" else c["instruction_chaining"]
        ent = 0.0 if disable == "ent" else c["entropy_anomaly"]
        score = (
            c["ml_prediction"]
            if disable == "ml_only"
            else min(
                0.45 * ml + 0.25 * sem + 0.15 * kw + 0.10 * chain + 0.05 * ent, 1.0
            )
        )
        out.append(
            {
                "label": r["label"],
                "risk_score": round(score, 4),
                "obfuscation": r["obfuscation"],
            }
        )
    return out


configs = [
    ("Full MARIO (all 5 signals)", None),
    ("Without entropy anomaly", "ent"),
    ("Without instruction chaining", "chain"),
    ("Without keyword anomaly", "kw"),
    ("Without semantic similarity", "sem"),
    ("ML prediction only (baseline)", "ml_only"),
]
ablation_results = {}
for name, disable in configs:
    m = compute_metrics(ablation_run(disable))
    ablation_results[name] = m
    print(
        f"  {name:<42} Acc={m['accuracy']:.4f} F1={m['f1']:.4f} Bypass={m['bypass_rate']:.4f}"
    )

# ── Experiment 3 — Obfuscation benchmark ─────────────────────────────────────
print("\n[3/4] Obfuscation benchmark...")
obf_classes = [
    "O1_direct",
    "O1_leetspeak",
    "O2_unicode",
    "O3_fragmentation",
    "O4_embedded",
    "O5_paraphrase",
]
obf_benchmark = {}
for obf in obf_classes:
    s = [r for r in full_results if r["obfuscation"] == obf]
    if not s:
        continue

    def dr(fn):
        return round(sum(1 for r in s if fn(r) >= 0.5) / len(s), 4)

    mario = dr(lambda r: r["risk_score"])
    ml = dr(lambda r: r["components"]["ml_prediction"])
    kw = dr(lambda r: r["components"]["keyword_anomaly"])
    sem = dr(lambda r: r["components"]["semantic_similarity"])
    ent = dr(lambda r: r["components"]["entropy_anomaly"])
    obf_benchmark[obf] = {
        "n_samples": len(s),
        "mario_detection": mario,
        "ml_only": ml,
        "keyword_only": kw,
        "semantic_only": sem,
        "entropy_only": ent,
        "mario_bypass": round(1 - mario, 4),
        "ml_bypass": round(1 - ml, 4),
    }
    print(
        f"  {obf:<25} MARIO={mario:.2%} ML={ml:.2%} KW={kw:.2%} Sem={sem:.2%} Ent={ent:.2%}"
    )

# ── Experiment 4 — FP analysis ───────────────────────────────────────────────
print("\n[4/4] False positive analysis...")
benign_r = [r for r in full_results if r["label"] == 0]
fp_blocked = [r for r in benign_r if r["risk_score"] >= 0.5]
fp_flagged = [r for r in benign_r if 0.25 <= r["risk_score"] < 0.5]
fpr_val = round(len(fp_blocked) / len(benign_r), 4) if benign_r else 0
print(
    f"  Benign: {len(benign_r):,}  Blocked: {len(fp_blocked):,} (FPR={fpr_val:.4f})  Flagged: {len(fp_flagged):,}"
)
worst_fp = sorted(fp_blocked, key=lambda r: r["risk_score"], reverse=True)[:10]

# ── Save ──────────────────────────────────────────────────────────────────────
output = {
    "experiment_info": {
        "dataset_size": len(dataset),
        "n_benign": sum(1 for d in dataset if d["label"] == 0),
        "n_injection": sum(1 for d in dataset if d["label"] == 1),
        "obfuscation_classes": obf_classes,
        "detection_threshold": 0.50,
    },
    "main_results": main_metrics,
    "latency": lat,
    "ablation": ablation_results,
    "obfuscation_benchmark": obf_benchmark,
    "false_positive_analysis": {
        "n_benign": len(benign_r),
        "n_false_positive": len(fp_blocked),
        "n_flagged": len(fp_flagged),
        "fpr": fpr_val,
        "worst_fp_examples": worst_fp,
    },
}

out_path = os.path.join(os.path.dirname(__file__), "mario_results.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(output, f, indent=2)

print(f"\n{'=' * 55}")
print(f"DONE — mario_results.json saved")
print(f"{'=' * 55}")
print(f"  Accuracy:     {main_metrics['accuracy']:.4f}")
print(f"  Precision:    {main_metrics['precision']:.4f}")
print(f"  Recall:       {main_metrics['recall']:.4f}")
print(f"  F1 Score:     {main_metrics['f1']:.4f}")
print(f"  FP Rate:      {main_metrics['fpr']:.4f}")
print(f"  Bypass Rate:  {main_metrics['bypass_rate']:.4f}")
print(f"  Mean Latency: {lat['mean_ms']} ms")
print(f"  p99 Latency:  {lat['p99_ms']} ms")
print(f"\nPaste mario_results.json back to Claude.")
