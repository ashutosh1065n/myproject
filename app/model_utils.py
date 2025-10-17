import os
import joblib

BASE_DIR = os.path.dirname(__file__)
MODELS_DIR = os.path.join(BASE_DIR, "../models")

def load_model(age_group):
    model_filename = os.path.join(MODELS_DIR, f"{age_group}_model.pkl")
    if not os.path.exists(model_filename):
        raise FileNotFoundError(f"Model not found: {model_filename}")
    model = joblib.load(model_filename)
    return model

def model_prediction(age_group):
    return load_model(age_group)
