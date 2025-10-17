import pandas as pd
import pickle
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import os

def train_model(csv_path, model_path, encoder_path, symptom_order_path):
    print(f"\nTraining model for dataset: {csv_path}")
    
    df = pd.read_csv(csv_path)

    possible_labels = [col for col in df.columns if col.strip().lower() == "disease"]
    if possible_labels:
        label_col = possible_labels[0]
    else:
        label_col = df.columns[-1]  

    X = df.drop(columns=[label_col])
    y = df[label_col]

    X = X.select_dtypes(include=["number"])

    with open(symptom_order_path, "wb") as f:
        pickle.dump(list(X.columns), f)

    encoder = LabelEncoder()
    y_encoded = encoder.fit_transform(y)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
    )

    model = RandomForestClassifier(random_state=42)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)

    acc = accuracy_score(y_test, y_pred)
    print(f"Accuracy: {acc:.4f}")
    print("\nClassification Report:\n", classification_report(y_test, y_pred))

    with open(model_path, "wb") as f:
        pickle.dump(model, f)

    with open(encoder_path, "wb") as f:
        pickle.dump(encoder, f)

    print(f"Model saved as {model_path}")
    print(f"Label encoder saved as {encoder_path}")
    print(f"Symptom order saved as {symptom_order_path}")

if __name__ == "__main__":
    os.makedirs("models", exist_ok=True)

    train_model(
        "data/Child Dataset.csv",
        "models/child_model.pkl",
        "models/child_model_encoder.pkl",
        "models/symptom_order_child.pkl"
    )

    train_model(
        "data/Adult Dataset.csv",
        "models/adult_model.pkl",
        "models/adult_model_encoder.pkl",
        "models/symptom_order_adult.pkl"
    )

    train_model(
        "data/Elder Dataset.csv",
        "models/elder_model.pkl",
        "models/elder_model_encoder.pkl",
        "models/symptom_order_elder.pkl"
    )