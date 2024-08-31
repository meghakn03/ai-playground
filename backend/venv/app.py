from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
from sklearn.preprocessing import StandardScaler, MinMaxScaler, OneHotEncoder
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression, Ridge, Lasso, LinearRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from sklearn.metrics import accuracy_score
import json
import os
import pickle

app = Flask(__name__)
CORS(app)

# Global variable to hold the trained model
model = None

# Check scikit-learn version
import sklearn
print(f"Scikit-learn version: {sklearn.__version__}")

@app.route('/upload', methods=['POST'])
def upload_file():
    file = request.files['file']
    df = pd.read_csv(file)
    
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

    data_preview = df.head(10).to_dict(orient='records')
    
    return jsonify({
        "columns": selected_columns,
        "data": data_preview
    })

@app.route('/normalize', methods=['POST'])
def normalize_data():
    try:
        # Parse request data
        data = request.json
        method = data.get('method', 'minmax')
        selected_columns = data.get('columns', [])
        df = pd.DataFrame(data.get('data', []))
        
        if selected_columns:
            df = df[selected_columns]

        # Encoding categorical columns
        categorical_cols = df.select_dtypes(include=['object']).columns
        if not categorical_cols.empty:
            # Use the appropriate parameter based on the scikit-learn version
            encoder_params = {'drop': 'first', 'sparse_output': False} if sklearn.__version__ >= '1.0' else {'drop': 'first', 'sparse': False}
            encoder = OneHotEncoder(**encoder_params)
            encoded_array = encoder.fit_transform(df[categorical_cols])
            
            # Check if the output is a sparse matrix or dense array
            if hasattr(encoded_array, 'toarray'):
                encoded_array = encoded_array.toarray()
                
            encoded_df = pd.DataFrame(encoded_array, columns=encoder.get_feature_names_out(categorical_cols))
            df = df.drop(categorical_cols, axis=1)
            df = pd.concat([df, encoded_df], axis=1)

        numeric_df = df.select_dtypes(include=['float64', 'int64'])
        non_numeric_df = df.select_dtypes(exclude=['float64', 'int64'])

        if numeric_df.empty:
            return jsonify({"error": "No numeric columns to normalize"}), 400

        # Normalization
        if method == 'minmax':
            scaler = MinMaxScaler()
        elif method == 'standard':
            scaler = StandardScaler()
        else:
            return jsonify({"error": "Invalid normalization method"}), 400

        numeric_df[numeric_df.columns] = scaler.fit_transform(numeric_df)
        
        # Reassemble the DataFrame
        df_normalized = pd.concat([non_numeric_df, numeric_df], axis=1)

        # Reorder columns to match the original DataFrame
        df_normalized = df_normalized[df.columns]

        # Prepare preview data
        data_preview = df_normalized.head(10).to_dict(orient='records')
        
        return jsonify({
            "columns": df_normalized.columns.tolist(),
            "data": data_preview
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/split', methods=['POST'])
def split_data():
    try:
        data = request.json
        dataset = data.get('data')
        test_size = data.get('test_size', 0.2)
        
        if dataset is None:
            return jsonify({'error': 'No dataset provided'}), 400

        df = pd.DataFrame(dataset)
        
        X = df.iloc[:, :-1]
        y = df.iloc[:, -1]
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size)
        
        response = {
            'X_train': X_train.to_dict(orient='split')['data'],
            'y_train': y_train.tolist(),
            'X_test': X_test.to_dict(orient='split')['data'],
            'y_test': y_test.tolist()
        }
        
        return jsonify(response)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

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

@app.route('/train', methods=['POST'])
def train_model():
    global model
    data = request.json

    print("Received data:", data)
    
    if 'X_train' not in data or 'y_train' not in data or 'modelType' not in data or 'selectedModel' not in data or 'hyperparameters' not in data:
        return jsonify({'error': 'Missing required parameters'}), 400
    
    try:
        X_train = pd.DataFrame(data['X_train'])
        y_train = pd.Series(data['y_train'])
        
        print("X_train shape:", X_train.shape)
        print("y_train shape:", y_train.shape)
        
        categorical_cols = X_train.select_dtypes(include=['object']).columns
        if not categorical_cols.empty:
            encoder = OneHotEncoder(drop='first', sparse_output=False)
            encoded_X_train = pd.DataFrame(encoder.fit_transform(X_train[categorical_cols]).toarray(), columns=encoder.get_feature_names_out(categorical_cols))
            X_train = X_train.drop(categorical_cols, axis=1)
            X_train = pd.concat([X_train, encoded_X_train], axis=1)
        
        model_type = data['modelType']
        selected_model = data['selectedModel']
        hyperparameters = data['hyperparameters']
        
        if model_type == 'classification':
            if selected_model == 'Logistic Regression':
                model = LogisticRegression(C=hyperparameters.get('C', 1.0))
            elif selected_model == 'Decision Trees':
                model = DecisionTreeClassifier(max_depth=hyperparameters.get('maxDepth', None))
            elif selected_model == 'Random Forest':
                model = RandomForestClassifier(n_estimators=hyperparameters.get('nEstimators', 100))
            elif selected_model == 'SVM':
                model = SVC(C=hyperparameters.get('C', 1.0))
            else:
                return jsonify({'error': 'Invalid classification model'}), 400
        elif model_type == 'regression':
            if selected_model == 'Linear Regression':
                model = LinearRegression()
            elif selected_model == 'Ridge':
                model = Ridge(alpha=hyperparameters.get('alpha', 1.0))
            elif selected_model == 'Lasso':
                model = Lasso(alpha=hyperparameters.get('alpha', 1.0))
            else:
                return jsonify({'error': 'Invalid regression model'}), 400
        else:
            return jsonify({'error': 'Invalid model type'}), 400
        
        model.fit(X_train, y_train)
        
        with open('model.pkl', 'wb') as f:
            pickle.dump(model, f)
        
        return jsonify({'message': 'Model trained successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/evaluate', methods=['POST'])
def evaluate_model():
    data = request.json
    X_test = pd.DataFrame(data['X_test'])
    y_test = pd.Series(data['y_test'])
    
    if not os.path.exists('model.pkl'):
        return jsonify({'error': 'No model found to evaluate'}), 404
    
    with open('model.pkl', 'rb') as f:
        model = pickle.load(f)
    
    try:
        predictions = model.predict(X_test)
        accuracy = accuracy_score(y_test, predictions)
        return jsonify({'accuracy': accuracy})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)
