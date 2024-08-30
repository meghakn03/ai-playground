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

if __name__ == "__main__":
    app.run(debug=True)
