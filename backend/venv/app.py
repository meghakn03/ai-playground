from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
from sklearn.preprocessing import StandardScaler, MinMaxScaler

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

if __name__ == "__main__":
    app.run(debug=True)
