import os
import json
import joblib
import numpy as np
import pandas as pd

BASE_DIR = os.path.dirname(__file__)
MODELS_DIR = os.path.join(BASE_DIR, "../models")
DATA_DIR = os.path.join(BASE_DIR, "../data")
JSON_PATH = os.path.join(BASE_DIR, "disease_descriptions.json")

with open(JSON_PATH, "r", encoding="utf-8") as f:
    DISEASE_DESCRIPTIONS = json.load(f)

def load_artifacts(age_group):
    """Load model, encoder, and symptom order for the given age group."""
    model_path = os.path.join(MODELS_DIR, f"{age_group}_model.pkl")
    encoder_path = os.path.join(MODELS_DIR, f"{age_group}_model_encoder.pkl")
    order_path = os.path.join(MODELS_DIR, f"symptom_order_{age_group}.pkl")

    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model not found: {model_path}")
    if not os.path.exists(encoder_path):
        raise FileNotFoundError(f"Encoder not found: {encoder_path}")
    if not os.path.exists(order_path):
        raise FileNotFoundError(f"Symptom order file not found: {order_path}")

    model = joblib.load(model_path)
    encoder = joblib.load(encoder_path)
    symptom_order = joblib.load(order_path)

    return model, encoder, symptom_order

def vectorize_symptoms(symptoms, symptom_order):
    """Convert selected symptoms into a binary vector matching training order."""
    vector = [1 if s in symptoms else 0 for s in symptom_order]
    return np.array(vector).reshape(1, -1)

def get_prediction(symptoms, age_group):
    try:
        model, encoder, symptom_order = load_artifacts(age_group)

        print("Symptoms received from UI:", symptoms[:10], "... total:", len(symptoms))
        print("First 10 symptoms in model order:", symptom_order[:10])

        X = vectorize_symptoms(symptoms, symptom_order)
        print("Vector sum (number of 1s):", X.sum())  # should be >0 if symptoms match

        probs = model.predict_proba(X)[0]
        classes = encoder.classes_

        top_indices = np.argsort(probs)[::-1][:5]
        results = []
        for idx in top_indices:
            disease = classes[idx]
            prob = probs[idx] * 100
            results.append({
                "disease": disease,
                "probability": float(prob),
                "description": DISEASE_DESCRIPTIONS.get(disease, "No description found.")
            })

        return results

    except Exception as e:
        return {"error": str(e)}

def get_symptoms_for_age(age):
    """Return list of symptoms based on age group (baby/adult/elder)."""
    if age < 13:
        csv_path = os.path.join(DATA_DIR, "Child Dataset.csv")
    elif age < 60:
        csv_path = os.path.join(DATA_DIR, "Adult Dataset.csv")
    else:
        csv_path = os.path.join(DATA_DIR, "Elder Dataset.csv")

    if not os.path.exists(csv_path):
        return []

    df = pd.read_csv(csv_path)

    symptoms = [col for col in df.columns if col.lower() != "diagnosis"]
    return symptoms