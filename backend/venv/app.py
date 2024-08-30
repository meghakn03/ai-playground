from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd

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


if __name__ == "__main__":
    app.run(debug=True)
