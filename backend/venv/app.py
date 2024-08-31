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
import pickle
import json
import os
import logging
import sklearn

logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
CORS(app)

# Global variables to manage dataset and normalization state
original_data = None
normalized_data = None
current_normalization_method = None

@app.route('/upload', methods=['POST'])
def upload_file():
    global original_data, normalized_data, current_normalization_method

    file = request.files['file']
    original_data = pd.read_csv(file)
    normalized_data = None
    current_normalization_method = None

    data_preview = original_data.head(10).to_dict(orient='records')
    
    return jsonify({
        "columns": original_data.columns.tolist(),
        "shape": original_data.shape,
        "data": data_preview
    })

@app.route('/select_features', methods=['POST'])
def select_features():
    global original_data, normalized_data

    data = request.json
    selected_columns = data.get('columns', [])
    df = original_data.copy()

    if selected_columns:
        df = df[selected_columns]
        
    data_preview = df.head(10).to_dict(orient='records')
    
    return jsonify({
        "columns": selected_columns,
        "data": data_preview
    })

@app.route('/normalize', methods=['POST'])
def normalize_data():
    global original_data, normalized_data, current_normalization_method

    try:
        # Parse request data
        data = request.json
        method = data.get('method', 'minmax')
        selected_columns = data.get('columns', [])

        if original_data is None:
            return jsonify({"error": "No data available. Please upload data first."}), 400

        if normalized_data is not None:
            return jsonify({"error": "Data is already normalized. Please upload new data or reset."}), 400

        df = original_data.copy()

        if selected_columns:
            df = df[selected_columns]

        # Encoding categorical columns
        categorical_cols = df.select_dtypes(include=['object']).columns
        if not categorical_cols.empty:
            encoder_params = {'drop': 'first', 'sparse_output': False} if sklearn.__version__ >= '1.0' else {'drop': 'first', 'sparse': False}
            encoder = OneHotEncoder(**encoder_params)
            encoded_array = encoder.fit_transform(df[categorical_cols])
            
            if hasattr(encoded_array, 'toarray'):
                encoded_array = encoded_array.toarray()
                
            encoded_df = pd.DataFrame(encoded_array, columns=encoder.get_feature_names_out(categorical_cols))
            df = df.drop(categorical_cols, axis=1)
            df = pd.concat([df, encoded_df], axis=1)

        numeric_df = df.select_dtypes(include=['float64', 'int64'])
        non_numeric_df = df.select_dtypes(exclude=['float64', 'int64'])

        if numeric_df.empty:
            return jsonify({"error": "No numeric columns to normalize"}), 400

        scaler = None

        if current_normalization_method:
            if current_normalization_method == 'minmax':
                # Revert MinMax scaling
                scaler = MinMaxScaler()
                scaler.fit(numeric_df)  # Refit the scaler with the current data
                numeric_df = scaler.inverse_transform(numeric_df)
            elif current_normalization_method == 'standard':
                # Revert Standard Scaling
                scaler = StandardScaler()
                scaler.fit(numeric_df)  # Refit the scaler with the current data
                numeric_df = scaler.inverse_transform(numeric_df)

        # Apply new normalization
        if method == 'minmax':
            scaler = MinMaxScaler()
        elif method == 'standard':
            scaler = StandardScaler()
        elif method == 'zscore':
            scaler = StandardScaler()  # StandardScaler is used for Z-Score normalization
        else:
            return jsonify({"error": "Invalid normalization method"}), 400

        # Apply normalization
        numeric_df[numeric_df.columns] = scaler.fit_transform(numeric_df)
        normalized_data = pd.concat([non_numeric_df, numeric_df], axis=1)
        current_normalization_method = method

        # Prepare preview data
        data_preview = normalized_data.head(10).to_dict(orient='records')

        return jsonify({
            "columns": normalized_data.columns.tolist(),
            "data": data_preview
        })
    
    except Exception as e:
        logging.error(f"Error normalizing data: {e}")
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

    required_fields = ['X_train', 'y_train', 'modelType', 'selectedModel', 'hyperparameters']
    if not all(field in data for field in required_fields):
        return jsonify({'error': 'Missing required parameters'}), 400

    try:
        # Convert lists to DataFrame and Series
        X_train = pd.DataFrame(data['X_train'])
        y_train = pd.Series(data['y_train'])
        
        print("X_train shape:", X_train.shape)
        print("y_train shape:", y_train.shape)

        # Check if the task is classification or regression
        model_type = data['modelType']
        selected_model = data['selectedModel']
        hyperparameters = data['hyperparameters']

        # Check if the target variable is continuous or categorical
        is_regression = y_train.apply(lambda x: isinstance(x, (int, float))).all()

        if model_type == 'classification':
            if not y_train.apply(lambda x: isinstance(x, (int, str))).any():
                return jsonify({'error': 'Target variable for classification should be categorical'}), 400

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
            if is_regression:
                if selected_model == 'Linear Regression':
                    model = LinearRegression()
                elif selected_model == 'Ridge':
                    model = Ridge(alpha=hyperparameters.get('alpha', 1.0))
                elif selected_model == 'Lasso':
                    model = Lasso(alpha=hyperparameters.get('alpha', 1.0))
                else:
                    return jsonify({'error': 'Invalid regression model'}), 400
            else:
                return jsonify({'error': 'Target variable for regression should be continuous'}), 400

        else:
            return jsonify({'error': 'Invalid model type'}), 400

        # Train the model
        model.fit(X_train, y_train)

        # Save the model
        with open('model.pkl', 'wb') as f:
            pickle.dump(model, f)

        return jsonify({'message': 'Model trained successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/evaluate', methods=['POST'])
def evaluate_model():
    data = request.json

    if 'X_test' not in data or 'y_test' not in data:
        return jsonify({'error': 'Missing required parameters'}), 400
    
    try:
        # Convert lists to DataFrame and Series
        X_test = pd.DataFrame(data['X_test'])
        y_test = pd.Series(data['y_test'])
        
        # Ensure y_test is integer type (for classification)
        if y_test.dtype != int:
            y_test = y_test.astype(int)
        
        # Load the model
        with open('model.pkl', 'rb') as f:
            model = pickle.load(f)
        
        # Predict and evaluate
        predictions = model.predict(X_test)
        print("Predictions:", predictions)  # Debugging

        if hasattr(model, 'score'):
            score = model.score(X_test, y_test)
            print("Score:", score)  # Debugging
            return jsonify({'message': 'Evaluation successful', 'score': score})
        else:
            return jsonify({'error': 'Model does not support scoring'}), 400

    except Exception as e:
        print("Error during evaluation:", str(e))  # More detailed debugging
        return jsonify({'error': 'Error during evaluation: ' + str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)
