import React, { useState } from 'react';
import './App.css';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, LineElement, CategoryScale, LinearScale, PointElement, Title } from 'chart.js';

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Title);

function App() {
    const [file, setFile] = useState(null);
    const [columns, setColumns] = useState([]);
    const [selectedColumns, setSelectedColumns] = useState([]);
    const [data, setData] = useState([]);
    const [shape, setShape] = useState(null);
    const [normalizationMethod, setNormalizationMethod] = useState('minmax');
    const [error, setError] = useState(null);
    const [testSize, setTestSize] = useState(0.2);
    const [trainData, setTrainData] = useState([]);
    const [testData, setTestData] = useState([]);
    const [XTrain, setXTrain] = useState([]);
    const [yTrain, setYTrain] = useState([]);
    const [XTest, setXTest] = useState([]);
    const [yTest, setYTest] = useState([]);
    const [accuracy, setAccuracy] = useState(null);
    const [modelType, setModelType] = useState('classification');
    const [selectedModel, setSelectedModel] = useState('Logistic Regression');
    const [hyperparameters, setHyperparameters] = useState({ C: 1.0, maxDepth: 5, nEstimators: 100 });
    const classificationModels = ['Logistic Regression', 'Decision Trees', 'Random Forest', 'SVM'];
    const regressionModels = ['Linear Regression', 'Ridge', 'Lasso'];
    const [modelTrained, setModelTrained] = useState(false);
    const [evaluationComplete, setEvaluationComplete] = useState(false);
    // State for charts
    const [chartData, setChartData] = useState({
        labels: [],
        datasets: []
    });

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleUpload = async () => {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axios.post('http://127.0.0.1:5000/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            setColumns(response.data.columns);
            setData(response.data.data);
            setShape(response.data.shape);
            setSelectedColumns(response.data.columns); // Initially select all columns
            updateChart(response.data.data, response.data.columns); // Update chart data on upload
        } catch (error) {
            console.error("There was an error uploading the file!", error);
        }
    };

    const handleColumnChange = (e) => {
        const { value, checked } = e.target;
        setSelectedColumns((prevSelected) =>
            checked ? [...prevSelected, value] : prevSelected.filter((col) => col !== value)
        );
    };

    const handleFeatureSelection = async () => {
        try {
            const response = await axios.post('http://127.0.0.1:5000/select_features', {
                columns: selectedColumns,
                data: data
            });
            setColumns(response.data.columns);
            setData(response.data.data);
            updateChart(response.data.data, response.data.columns); // Update chart data after feature selection
        } catch (error) {
            console.error("Error selecting features", error);
        }
    };

 // Function to handle normalization method change
 const handleNormalizationChange = (event) => {
    setNormalizationMethod(event.target.value);
};
    const handleNormalizeData = async () => {
        try {
            const response = await axios.post('http://127.0.0.1:5000/normalize', {
                columns: selectedColumns,
                data: data,
                method: normalizationMethod
            });
            setColumns(response.data.columns);
            setData(response.data.data);
            setError(null); // Clear any previous error
            updateChart(response.data.data, response.data.columns); // Update chart data after normalization
        } catch (error) {
            console.error("Error normalizing data", error);
            setError("Error normalizing data: " + (error.response?.data?.error || error.message));
        }
    };

    const handleTestSizeChange = (e) => {
        setTestSize(e.target.value);
    };

    const handleSplitData = async () => {
        try {
            const response = await axios.post('http://127.0.0.1:5000/split', {
                data: data,
                test_size: parseFloat(testSize)
            });
        
            if (response.data) {
                // Convert arrays of data back into objects
                const convertToObjects = (dataArray, columns) => dataArray.map(row => {
                    let obj = {};
                    columns.forEach((col, index) => obj[col] = row[index]);
                    return obj;
                });
    
                // Extract data and update state
                setXTrain(response.data.X_train || []);
                setYTrain(response.data.y_train || []);
                setXTest(response.data.X_test || []);
                setYTest(response.data.y_test || []);
    
                setTrainData(convertToObjects(response.data.X_train, columns).map((row, index) => ({
                    ...row,
                    target: response.data.y_train[index]
                })));
                setTestData(convertToObjects(response.data.X_test, columns).map((row, index) => ({
                    ...row,
                    target: response.data.y_test[index]
                })));
    
                console.log("Split data:", {
                    XTrain: response.data.X_train,
                    yTrain: response.data.y_train,
                    XTest: response.data.X_test,
                    yTest: response.data.y_test
                });
            } else {
                console.error("No data returned from the server.");
            }
        } catch (error) {
            console.error("Error splitting data", error);
        }
    };
    
    // Label encoding function
const labelEncode = (labels) => {
    const uniqueLabels = [...new Set(labels)];
    const labelMap = new Map(uniqueLabels.map((label, index) => [label, index]));
    return labels.map(label => labelMap.get(label));
};


const handleTrainModel = async () => {
    console.log("Training data:", {
        XTrain,
        yTrain,
        modelType,
        selectedModel,
        hyperparameters
    });

    // Encode yTrain labels if the model type is classification
    const encodedYTrain = modelType === 'classification' ? labelEncode(yTrain) : yTrain;

    try {
        const response = await axios.post('http://127.0.0.1:5000/train', {
            X_train: XTrain, // Training features
            y_train: encodedYTrain, // Encoded training labels
            modelType,       // 'classification' or 'regression'
            selectedModel,   // Selected model name
            hyperparameters  // Hyperparameters object
        });

        console.log(response.data.message);
        setModelTrained(true); // Set model trained message
    } catch (error) {
        console.error('Error training model:', error.response ? error.response.data : error.message);
        setModelTrained(false);

    }
}; 

const handleEvaluateModel = async () => {
    try {
        const response = await axios.post('http://127.0.0.1:5000/evaluate', {
            X_test: XTest,
            y_test: yTest
        });

        const score = response.data.score;
        if (score !== undefined) {
            setAccuracy(score);
            setEvaluationComplete(true); // Set evaluation complete message
        } else {
            console.error("Score is undefined");
            setEvaluationComplete(false);
        }
    } catch (error) {
        console.error("Error evaluating model", error);
        setEvaluationComplete(false);
    }
};



    const updateChart = (data, columns) => {
        if (data.length === 0 || columns.length === 0) return;

        const labels = data.map((_, index) => index + 1);
        const datasets = columns.map((col, index) => ({
            label: col,
            data: data.map(row => row[col]),
            borderColor: `hsl(${(index * 360) / columns.length}, 70%, 50%)`,
            backgroundColor: `hsl(${(index * 360) / columns.length}, 70%, 90%)`,
            fill: false
        }));

        setChartData({ labels, datasets });
    };

    const handleSaveConfig = async () => {
        try {
            await axios.post('http://127.0.0.1:5000/save_config', {
                data: data,
                selectedColumns: selectedColumns,
                normalizationMethod: normalizationMethod,
                modelType,
                selectedModel,
                hyperparameters
                // Add other config details as needed
            });
            console.log("Configuration saved successfully");
        } catch (error) {
            console.error("Error saving configuration", error);
        }
    };

    const handleLoadConfig = async () => {
        try {
            const response = await axios.get('http://127.0.0.1:5000/load_config');
            const config = response.data;
            // Apply the configuration to your app state
            setData(config.data);
            setSelectedColumns(config.selectedColumns);
            setNormalizationMethod(config.normalizationMethod);
            setModelType(config.modelType);
            setSelectedModel(config.selectedModel);
            setHyperparameters(config.hyperparameters);
            // Handle other config details as needed
        } catch (error) {
            console.error("Error loading configuration", error);
        }
    };

    // Handle model type change
    const handleModelTypeChange = (e) => {
        const newModelType = e.target.value;
        setModelType(newModelType);
        setSelectedModel(newModelType === 'classification' ? classificationModels[0] : regressionModels[0]);
        setHyperparameters(newModelType === 'classification' ? { C: 1.0, maxDepth: 5, nEstimators: 100 } : { alpha: 1.0 });
    };

    // Handle model selection
    const handleModelSelection = (e) => {
        setSelectedModel(e.target.value);
    };

    // Handle hyperparameter change
    const handleHyperparameterChange = (e) => {
        const { name, value } = e.target;
        setHyperparameters(prev => ({
          ...prev,
          [name]: isNaN(value) ? prev[name] : parseFloat(value) // Ensure value is a number
        }));
      };
      
      return (
        <div className="App">
            <header>
                <h1>AI Playground</h1>
            </header>
            <main>
                <section className="upload-section">
                    <input type="file" onChange={handleFileChange} />
                    <button onClick={handleUpload}>Upload and Process</button>
                </section>

                {columns.length > 0 && (
                    <section className="feature-data-info">
                        <div className="feature-selection-section">
                            <h2>Select Features</h2>
                            <div className="feature-selection">
                                {columns.map((col, index) => (
                                    <label key={index} className="feature-checkbox">
                                        <input
                                            type="checkbox"
                                            value={col}
                                            checked={selectedColumns.includes(col)}
                                            onChange={handleColumnChange}
                                        />
                                        {col}
                                    </label>
                                ))}
                            </div>
                            <button onClick={handleFeatureSelection}>Select Features</button>
                        </div>

                        <div className="data-info-section">
                            <h2>Data Information</h2>
                            <p>{shape && `Shape: ${shape[0]} rows, ${shape[1]} columns`}</p>
                        </div>
                    </section>
                )}

                <div className="data-normalization-container">
                    <section className="data-preview-section">
                        <h2>Data Preview</h2>
                        <table>
                            <thead>
                                <tr>
                                    {columns.map((col, index) => (
                                        <th key={index}>{col}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((row, rowIndex) => (
                                    <tr key={rowIndex}>
                                        {columns.map((col, colIndex) => (
                                            <td key={colIndex}>{row[col]}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>

                    <section className="normalization-section">
                        <div className="normalization-controls">
                            <h3 htmlFor="normalizationMethod">Normalization Method:</h3>
                            <select
                                id="normalizationMethod"
                                value={normalizationMethod}
                                onChange={handleNormalizationChange}
                            >
                                <option value="minmax">Min-Max Scaling</option>
                                <option value="standard">Standard Scaling</option>
                                <option value="zscore">Z-Score Normalization</option>
                            </select>
                            <button onClick={handleNormalizeData}>Normalize Data</button>
                        </div>
                        {error && <p className="error">{error}</p>}
                    </section>
                </div>

                <section className="split-data-section">
                    <h2>Split Data</h2>
                    <label>
                        Test Size:
                        <input
                            type="number"
                            value={testSize}
                            step="0.01"
                            min="0"
                            max="1"
                            onChange={handleTestSizeChange}
                        />
                    </label>
                    <button onClick={handleSplitData}>Split Data</button>

                    <div className="split-data-tables">
                        <div className="data-table-container">
                            <h3>Train Data</h3>
                            <table>
                                <thead>
                                    <tr>
                                        {columns.map((col, index) => (
                                            <th key={index}>{col}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {trainData.map((row, rowIndex) => (
                                        <tr key={rowIndex}>
                                            {columns.map((col, colIndex) => (
                                                <td key={colIndex}>{row[col]}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="data-table-container">
                            <h3>Test Data</h3>
                            <table>
                                <thead>
                                    <tr>
                                        {columns.map((col, index) => (
                                            <th key={index}>{col}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {testData.map((row, rowIndex) => (
                                        <tr key={rowIndex}>
                                            {columns.map((col, colIndex) => (
                                                <td key={colIndex}>{row[col]}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                <div className="model-evaluation-container">
  <section className="model-selection-section">
    <h2>Model Selection</h2>
    <label>
      Model Type:
      <select value={modelType} onChange={handleModelTypeChange}>
        <option value="classification">Classification</option>
        <option value="regression">Regression</option>
      </select>
    </label>
    <label>
      Model:
      <select value={selectedModel} onChange={handleModelSelection}>
        {(modelType === 'classification' ? classificationModels : regressionModels).map((model, index) => (
          <option key={index} value={model}>
            {model}
          </option>
        ))}
      </select>
    </label>

    <h3>Hyperparameters</h3>
    {selectedModel === 'Logistic Regression' && modelType === 'classification' && (
      <label>
        C:
        <input
          type="number"
          name="C"
          value={hyperparameters.C}
          onChange={handleHyperparameterChange}
          step="0.1"
        />
      </label>
    )}
    {selectedModel === 'Decision Trees' && modelType === 'classification' && (
      <label>
        Max Depth:
        <input
          type="number"
          name="maxDepth"
          value={hyperparameters.maxDepth}
          onChange={handleHyperparameterChange}
          step="1"
        />
      </label>
    )}
    {selectedModel === 'Random Forest' && modelType === 'classification' && (
      <label>
        n_estimators:
        <input
          type="number"
          name="nEstimators"
          value={hyperparameters.nEstimators}
          onChange={handleHyperparameterChange}
          step="10"
        />
      </label>
    )}
    {selectedModel === 'Linear Regression' && modelType === 'regression' && (
      <label>
        Alpha:
        <input
          type="number"
          name="alpha"
          value={hyperparameters.alpha}
          onChange={handleHyperparameterChange}
          step="0.1"
        />
      </label>
    )}
    <button onClick={handleTrainModel}>Train Model</button>
    {modelTrained && <p>MODEL TRAINED</p>}
  </section>

  <section className="evaluation-section">
    <h2>Evaluate Model</h2>
    <button onClick={handleEvaluateModel}>Evaluate</button>
    {accuracy !== null && <p>Accuracy: {accuracy}</p>}
    {evaluationComplete !== null && evaluationComplete && <p>EVALUATION COMPLETE</p>}
    {evaluationComplete === false && <p>Evaluation failed. Check the console for more details.</p>}
  </section>
</div>


                    <div className="chart-container">
                        <Line data={chartData} />
                    </div>

                <section className="config-section">
                    <h2>Save/Load Configuration</h2>
                    <button onClick={handleSaveConfig}>Save Configuration</button>
                    <button onClick={handleLoadConfig}>Load Configuration</button>
                </section>
            </main>
        </div>
    );
}

export default App;