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

    const handleNormalizationChange = (e) => {
        setNormalizationMethod(e.target.value);
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

            // Debugging: Check the response data structure
            console.log("Split Data Response:", response.data);

            setTrainData(response.data.train_data || []);
            setTestData(response.data.test_data || []);
            setXTrain(response.data.X_train || []);
            setYTrain(response.data.y_train || []);
            setXTest(response.data.X_test || []);
            setYTest(response.data.y_test || []);
        } catch (error) {
            console.error("Error splitting data", error);
        }
    };

    const handleTrainModel = async () => {
        try {
            await axios.post('http://127.0.0.1:5000/train', {
                X_train: XTrain,
                y_train: yTrain
            });
            console.log("Model trained successfully");
        } catch (error) {
            console.error("Error training model", error);
        }
    };

    const handleEvaluateModel = async () => {
        try {
            const response = await axios.post('http://127.0.0.1:5000/evaluate', {
                X_test: XTest,
                y_test: yTest
            });
            setAccuracy(response.data.accuracy);
        } catch (error) {
            console.error("Error evaluating model", error);
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
            // Handle other config details as needed
        } catch (error) {
            console.error("Error loading configuration", error);
        }
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
                    <section className="feature-selection-section">
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
                        <button onClick={handleFeatureSelection}>Apply Feature Selection</button>

                        <h2>Normalization/Standardization</h2>
                        <div className="normalization">
                            <select value={normalizationMethod} onChange={handleNormalizationChange}>
                                <option value="minmax">Min-Max Normalization</option>
                                <option value="standard">Standardization</option>
                            </select>
                            <button onClick={handleNormalizeData}>Apply Normalization</button>
                        </div>
                        {error && <p className="error">{error}</p>}
                    </section>
                )}

                {data.length > 0 && (
                    <section className="data-preview-section">
                        <h2>Data Preview</h2>
                        <p>Shape: {shape ? `${shape[0]} rows, ${shape[1]} columns` : ''}</p>
                        <table>
                            <thead>
                                <tr>
                                    {columns.map((col, index) => (
                                        <th key={index}>{col}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((row, index) => (
                                    <tr key={index}>
                                        {columns.map((col, idx) => (
                                            <td key={idx}>{row[col]}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                )}

                {chartData.labels.length > 0 && (
                    <section className="chart-section">
                        <h2>Data Visualization</h2>
                        <Line data={chartData} options={{ responsive: true, plugins: { legend: { position: 'top' } } }} />
                    </section>
                )}

                {data.length > 0 && (
                    <section className="data-splitting-section">
                        <h2>Data Splitting</h2>
                        <label>
                            Test Size:
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="1"
                                value={testSize}
                                onChange={handleTestSizeChange}
                            />
                        </label>
                        <button onClick={handleSplitData}>Split Data</button>

                        {trainData.length > 0 && (
                            <div className="train-data-preview">
                                <h2>Training Data Preview</h2>
                                <table>
                                    <thead>
                                        <tr>
                                            {columns.map((col, index) => (
                                                <th key={index}>{col}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {trainData.map((row, index) => (
                                            <tr key={index}>
                                                {columns.map((col, idx) => (
                                                    <td key={idx}>{row[col]}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {testData.length > 0 && (
                            <div className="test-data-preview">
                                <h2>Testing Data Preview</h2>
                                <table>
                                    <thead>
                                        <tr>
                                            {columns.map((col, index) => (
                                                <th key={index}>{col}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {testData.map((row, index) => (
                                            <tr key={index}>
                                                {columns.map((col, idx) => (
                                                    <td key={idx}>{row[col]}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                )}

                {XTrain.length > 0 && (
                    <section className="model-training-section">
                        <h2>Model Training</h2>
                        <button onClick={handleTrainModel}>Train Model</button>
                    </section>
                )}

                {XTest.length > 0 && (
                    <section className="model-evaluation-section">
                        <h2>Model Evaluation</h2>
                        <button onClick={handleEvaluateModel}>Evaluate Model</button>
                        {accuracy !== null && <p>Model Accuracy: {accuracy}</p>}
                    </section>
                )}

                <section className="config-section">
                    <button onClick={handleSaveConfig}>Save Configuration</button>
                    <button onClick={handleLoadConfig}>Load Configuration</button>
                </section>
            </main>
        </div>
    );
}

export default App;