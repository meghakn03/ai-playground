from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
import json
import os

app = Flask(__name__)
CORS(app)

@app.route('/upload', methods=['POST'])
def upload_file():
    file = request.files['file']
    df = pd.read_csv(file)
    
    # Convert the first 10 rows to JSON
    data_preview = df.head(10).to_dict(orient='records')
    
    return jsonify({
        "columns": df.columns.tolist(),
        "shape": df.shape,
        "data": data_preview
    })

@app.route('/select_features', methods=['POST'])
def select_features():
    data = request.json
    selected_columns = data.get('columns', [])
    df = pd.DataFrame(data.get('data', []))
    
    if selected_columns:
        df = df[selected_columns]

    # Return the first 10 rows of the selected features
    data_preview = df.head(10).to_dict(orient='records')
    
    return jsonify({
        "columns": selected_columns,
        "data": data_preview
    })

@app.route('/normalize', methods=['POST'])
def normalize_data():
    data = request.json
    method = data.get('method', 'minmax')
    selected_columns = data.get('columns', [])
    df = pd.DataFrame(data.get('data', []))
    
    if selected_columns:
        df = df[selected_columns]

    # Separate numeric and non-numeric data
    numeric_df = df.select_dtypes(include=['float64', 'int64'])
    non_numeric_df = df.select_dtypes(exclude=['float64', 'int64'])

    if numeric_df.empty:
        return jsonify({"error": "No numeric columns to normalize"}), 400

    # Apply normalization
    if method == 'minmax':
        scaler = MinMaxScaler()
    elif method == 'standard':
        scaler = StandardScaler()
    else:
        return jsonify({"error": "Invalid normalization method"}), 400

    numeric_df[numeric_df.columns] = scaler.fit_transform(numeric_df)
    
    # Combine numeric and non-numeric data
    df_normalized = pd.concat([non_numeric_df, numeric_df], axis=1)
    
    # Ensure columns are in the correct order
    df_normalized = df_normalized[df.columns]

    data_preview = df_normalized.head(10).to_dict(orient='records')
    
    return jsonify({
        "columns": df_normalized.columns.tolist(),
        "data": data_preview
    })

@app.route('/split', methods=['POST'])
def split_data():
    data = request.json
    test_size = data.get('test_size', 0.2)  # Default to 20% test size
    df = pd.DataFrame(data.get('data', []))
    
    train_df, test_df = train_test_split(df, test_size=test_size)
    
    # Convert the first 10 rows of both train and test sets to JSON
    train_preview = train_df.head(10).to_dict(orient='records')
    test_preview = test_df.head(10).to_dict(orient='records')
    
    return jsonify({
        "train_data": train_preview,
        "test_data": test_preview
    })

@app.route('/train', methods=['POST'])
def train_model():
    data = request.json
    X_train = pd.DataFrame(data.get('X_train', []))
    y_train = pd.Series(data.get('y_train', []))
    
    model = LogisticRegression()
    model.fit(X_train, y_train)
    
    # Save the model if needed (using pickle, joblib, etc.)
    
    return jsonify({"status": "Model trained successfully"})

@app.route('/evaluate', methods=['POST'])
def evaluate_model():
    data = request.json
    X_test = pd.DataFrame(data.get('X_test', []))
    y_test = pd.Series(data.get('y_test', []))
    
    # Load the model if needed
    
    model = LogisticRegression()  # Placeholder for actual model loading
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    
    return jsonify({"accuracy": accuracy})

@app.route('/save_config', methods=['POST'])
def save_config():
    data = request.json
    with open('config.json', 'w') as f:
        json.dump(data, f)
    return jsonify({"status": "Configuration saved successfully"})

@app.route('/load_config', methods=['GET'])
def load_config():
    if os.path.exists('config.json'):
        with open('config.json', 'r') as f:
            config = json.load(f)
        return jsonify(config)
    else:
        return jsonify({"error": "No configuration found"}), 404

if __name__ == "__main__":
    app.run(debug=True)
