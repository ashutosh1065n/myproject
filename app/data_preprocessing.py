import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

def preprocess_data(file_path):
    data = pd.read_csv(file_path)
    
    X = data.drop(columns=['Diagnosis'])
    y = data['Diagnosis']
    
    label_encoder = LabelEncoder()
    y_encoded = label_encoder.fit_transform(y)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y_encoded, test_size=0.2, random_state=42
    )
    
    return X_train, X_test, y_train, y_test