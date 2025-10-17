import os
import json
from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from prediction_service import get_prediction, get_symptoms_for_age
import mysql.connector
from datetime import datetime

app = Flask(__name__)
app.secret_key = "ee787a5c5480aba04c48fea22e78149447da048ef3fcc86f5be8b44604cceefc"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
remedies_file = os.path.join(BASE_DIR, "remedies and suggestions.json")

with open(remedies_file, "r") as f:
    remedies_data = json.load(f)

DB_CONFIG = {
    "host": "localhost",
    "user": "root",          
    "password": "",  
    "database": "project"    
}

def init_db():
    conn = mysql.connector.connect(**DB_CONFIG)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS details (
            id INT AUTO_INCREMENT PRIMARY KEY,
            patient_name VARCHAR(255) NOT NULL,
            age INT NOT NULL,
            disease_predicted VARCHAR(255) NOT NULL,
            severity VARCHAR(20) NOT NULL,
            predicted_at DATETIME NOT NULL
        )
    ''')
    conn.commit()
    c.close()
    conn.close()

init_db()

def log_prediction(patient_name, age, disease, severity):
    conn = mysql.connector.connect(**DB_CONFIG)
    c = conn.cursor()
    sql = '''
        INSERT INTO details (patient_name, age, disease_predicted, severity, predicted_at)
        VALUES (%s, %s, %s, %s, %s)
    '''
    c.execute(sql, (patient_name, age, disease, severity, datetime.now()))
    conn.commit()
    c.close()
    conn.close()

def severity_from_prob(prob):
    if prob >= 70:
        return "severe"
    elif prob >= 40:
        return "moderate"
    return "mild"

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        patient_name = request.form.get("patient_name", "").strip()
        if not patient_name:
            return render_template("login.html", error="Please enter your name.")
        
        session["patient_name"] = patient_name
        return redirect(url_for("index"))

    return render_template("login.html")

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))

@app.route("/")
def index():
    if "patient_name" not in session:
        return redirect(url_for("login"))
    return render_template("index.html", patient_name=session["patient_name"])

@app.route("/get_symptoms")
def get_symptoms():
    try:
        age = int(request.args.get("age", 0))
        symptoms = get_symptoms_for_age(age)
        return jsonify({"symptoms": symptoms})
    except Exception as e:
        return jsonify({"error": str(e)})

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()
        age = data.get("age")
        symptoms = data.get("symptoms", [])

        if age is None or not symptoms:
            return jsonify({"error": "Age and symptoms are required."})

        patient_name = data.get("patient_name") or session.get("patient_name", "Unknown")

        if age < 13:
            age_group = "Child"
        elif age < 60:
            age_group = "Adult"
        else:
            age_group = "Elder"

        results = get_prediction(symptoms, age_group)

        if "error" in results:
            return jsonify(results)

        def attach_meta(pred):
            if pred:
                prob = pred.get("probability", 0)
                sev = pred.get("severity", severity_from_prob(prob)).lower()
                pred["severity"] = sev
                pred["age_group"] = age_group

                from pathlib import Path
                remedies_path = Path(__file__).with_name("remedies and suggestions.json")
                import json
                with open(remedies_path) as f:
                    remedies_data = json.load(f)

                disease = pred.get("disease")
                group_data = remedies_data.get(age_group, {})
                disease_data = group_data.get(disease, {})
                severity_data = disease_data.get(sev, {})

                pred["remedies"] = severity_data.get("remedies", [])
                pred["suggestion"] = severity_data.get("suggestion", "")

            return pred

        top_prediction = attach_meta(results[0]) if results else None
        other_predictions = [attach_meta(o) for o in results[1:5]] if len(results) > 1 else []

        if top_prediction and session.get("patient_name"):
            log_prediction(session["patient_name"], age, top_prediction.get("disease", "Unknown"),top_prediction.get("severity", "mild").capitalize())

        return jsonify({
            "top_prediction": top_prediction,
            "other_predictions": other_predictions
        })

    except Exception as e:
        return jsonify({"error": str(e)})

@app.route("/get_recovery")
def get_recovery():
    try:
        recovery_file = os.path.join(BASE_DIR, "recovery dates.json")
        with open(recovery_file, "r") as f:
            data = json.load(f)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)})

if __name__ == "__main__":
    app.run(debug=True)