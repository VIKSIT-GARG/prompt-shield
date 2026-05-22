"""
PromptShield Model Trainer
Trains a TF-IDF + LogisticRegression baseline and optionally a DistilBERT classifier.
"""

import os
import json
import pickle
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, classification_report, confusion_matrix
)
from sklearn.pipeline import Pipeline
import warnings
warnings.filterwarnings("ignore")

DATASET_PATH = os.path.join(os.path.dirname(__file__), "..", "dataset", "prompt_injection_dataset.json")
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")


def load_dataset(path: str):
    with open(path) as f:
        data = json.load(f)
    texts = [d["text"] for d in data]
    labels = [d["label"] for d in data]
    return texts, labels


def train_tfidf_lr(texts, labels):
    print("\n=== Training TF-IDF + Logistic Regression ===")

    X_train, X_test, y_train, y_test = train_test_split(
        texts, labels, test_size=0.2, random_state=42, stratify=labels
    )

    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(
            ngram_range=(1, 3),
            max_features=50000,
            sublinear_tf=True,
            min_df=2,
            analyzer="char_wb",
        )),
        ("clf", LogisticRegression(
            C=5.0,
            max_iter=1000,
            solver="lbfgs",
            class_weight="balanced",
        )),
    ])

    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)[:, 1]

    metrics = {
        "accuracy":  round(accuracy_score(y_test, y_pred), 4),
        "precision": round(precision_score(y_test, y_pred), 4),
        "recall":    round(recall_score(y_test, y_pred), 4),
        "f1_score":  round(f1_score(y_test, y_pred), 4),
        "roc_auc":   round(roc_auc_score(y_test, y_proba), 4),
    }

    print("\n── Evaluation Metrics ──────────────────────────")
    for k, v in metrics.items():
        status = "✓" if v >= 0.80 else "✗"
        print(f"  {status}  {k:<12} {v:.4f}")

    print("\n── Classification Report ───────────────────────")
    print(classification_report(y_test, y_pred, target_names=["Safe", "Injection"]))

    print("── Confusion Matrix ────────────────────────────")
    cm = confusion_matrix(y_test, y_pred)
    print(f"  TN={cm[0][0]}  FP={cm[0][1]}")
    print(f"  FN={cm[1][0]}  TP={cm[1][1]}")

    return pipeline, metrics


def save_model(pipeline, metrics):
    os.makedirs(MODEL_DIR, exist_ok=True)

    model_path = os.path.join(MODEL_DIR, "injection_detector.pkl")
    with open(model_path, "wb") as f:
        pickle.dump(pipeline, f)
    print(f"\nModel saved: {model_path}")

    meta = {
        "model_type": "TF-IDF + Logistic Regression",
        "metrics": metrics,
        "version": "1.0.0",
        "features": "char_wb ngrams (1,3), max_features=50000",
        "classes": {0: "safe", 1: "injection"},
    }
    meta_path = os.path.join(MODEL_DIR, "model_meta.json")
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)
    print(f"Metadata:   {meta_path}")

    return model_path


def run_training():
    print("PromptShield — Model Training Pipeline")
    print("=" * 50)

    # Step 1: Generate dataset if not present
    if not os.path.exists(DATASET_PATH):
        print("Dataset not found. Generating...")
        import sys
        sys.path.insert(0, os.path.dirname(__file__))
        from generate_dataset import generate_dataset
        generate_dataset(total_size=20000, output_dir=os.path.join(os.path.dirname(__file__), "..", "dataset"))
    else:
        print(f"Dataset found: {DATASET_PATH}")

    # Step 2: Load data
    texts, labels = load_dataset(DATASET_PATH)
    print(f"Loaded {len(texts)} samples  (safe={labels.count(0)}, injection={labels.count(1)})")

    # Step 3: Train
    pipeline, metrics = train_tfidf_lr(texts, labels)

    # Step 4: Save
    model_path = save_model(pipeline, metrics)

    # Step 5: Final summary
    print("\n" + "=" * 50)
    print("TRAINING COMPLETE")
    print(f"  Accuracy : {metrics['accuracy']:.2%}")
    print(f"  F1 Score : {metrics['f1_score']:.2%}")
    print(f"  ROC-AUC  : {metrics['roc_auc']:.2%}")
    target_met = metrics['accuracy'] >= 0.80
    print(f"  Target ≥80%: {'✓ PASSED' if target_met else '✗ NEEDS IMPROVEMENT'}")
    print("=" * 50)

    return metrics


if __name__ == "__main__":
    run_training()
