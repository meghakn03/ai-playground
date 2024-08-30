import React, { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
    const [file, setFile] = useState(null);
    const [columns, setColumns] = useState([]);
    const [selectedColumns, setSelectedColumns] = useState([]);
    const [data, setData] = useState([]);
    const [shape, setShape] = useState(null);

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
            setSelectedColumns(response.data.columns);  // Initially select all columns
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
        } catch (error) {
            console.error("Error selecting features", error);
        }
    };

    return (
        <div className="App">
            <h1>AI Playground</h1>
            <input type="file" onChange={handleFileChange} />
            <button onClick={handleUpload}>Upload and Process</button>

            {columns.length > 0 && (
                <div>
                    <h2>Select Features</h2>
                    <div>
                        {columns.map((col, index) => (
                            <label key={index}>
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
                </div>
            )}

            {data.length > 0 && (
                <div>
                    <h2>Data Preview</h2>
                    <p>Shape: {shape ? `${shape[0]} rows, ${shape[1]} columns` : ''}</p>
                    <table border="1">
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
                </div>
            )}
        </div>
    );
}

export default App;
