import './App.css';


import React, { Component } from 'react';
import { modelDownloadInProgress, pii_inference } from './inference.js';
import { Box, LinearProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Typography, Button } from '@mui/material';
import { loadTokenizer } from './bert_tokenizer.ts';
import * as wasmFeatureDetect from 'wasm-feature-detect';
import mammoth from 'mammoth';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DescriptionIcon from '@mui/icons-material/Description';
import SecurityIcon from '@mui/icons-material/Security';
import DownloadIcon from '@mui/icons-material/Download';
import CircularProgress from '@mui/material/CircularProgress';



class TextInputArea extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      text: 'Enter text to classify emotion, model trained on English text.',
      latency: 0.0,
      downloading: modelDownloadInProgress(),
      fileResults: [], // Stores results of PII checks for each file
      analyzing: false, // New state variable to track analysis status
    };
  }

  componentDidMount() {
    this.timerID = setInterval(() => this.checkModelStatus(), 1000);
    this.loadMammothScript();
  }

  componentWillUnmount() {
    clearInterval(this.timerID);
  }

  checkModelStatus = () => {
    this.setState({
      downloading: modelDownloadInProgress(),
    });
    if (!this.state.downloading) {
      clearInterval(this.timerID);
    }
  };

  // Function to dynamically load Mammoth.js from CDN
  loadMammothScript = () => {
    if (!document.getElementById("mammothScript")) {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.4.2/mammoth.browser.min.js";
      script.id = "mammothScript";
      script.async = true;
      document.body.appendChild(script);
    }
  };
 
  

  handleFileChange = async (event) => {
    const files = Array.from(event.target.files);
    var fileResults = []; // Temporary storage for this batch of file results

    this.setState({ analyzing: true }); // Set analyzing to true when file upload starts
    
    const start = performance.now(); // Start measuring time
    for (const file of files) {
      if (file && file.name.endsWith(".docx")) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const arrayBuffer = e.target.result;

          if (window.mammoth) {
            try {
              const result = await window.mammoth.convertToHtml({ arrayBuffer });
              const containsPII = await this.checkForPII(result.value,file.name); // Check if the text has PII
              fileResults.push({ filename: file.name, hasPII: containsPII });
              this.setState({ fileResults: [...this.state.fileResults, ...fileResults] });
            } catch (error) {
              console.error(`Error reading ${file.name}:`, error);
              fileResults.push({ filename: file.name, hasPII: "Error" });
            }
          } else {
            console.error("Mammoth.js is not loaded.");
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        alert("Please upload a valid .docx file.");
      }
    }
    const end = performance.now(); // End measuring time
    const latency = (end - start).toFixed(1); // Calculate latency
    this.setState({ analyzing: false, latency }); // Set analyzing to false when file upload ends
  };

  // Placeholder for actual PII detection logic
  checkForPII = async (text,fn) => {
    const  resultData = await pii_inference(text,fn);
    return resultData.some((entry) => entry.includes(""));
  };
  render() {
    const { downloading, fileResults, latency,analyzing } = this.state;

    return (
      <div className="App" style={{ padding: '40px', backgroundColor: '#f4f4f4', minHeight: '100vh' }}>
        <Typography variant="h4" gutterBottom>
        <DescriptionIcon fontSize="large" style={{ verticalAlign: 'middle', marginRight: 8 }} />
        Document PII Classification
      </Typography>
      <Typography variant="subtitle1" color="textSecondary">
        Upload .docx files to scan for Personally Identifiable Information (PII).
      </Typography>

      <Box mb={4} textAlign="center">
        <Typography variant="body1" color="textSecondary">
          <SecurityIcon fontSize="small" style={{ verticalAlign: 'middle', marginRight: 4 }} />
          This program uses client-side execution of an encoder-only transformer to find and mask PII. 
          The data never leaves your device, ensuring your privacy. The model is trained to identify 86 types of PII.
        </Typography>
      </Box>

      {downloading && (
        <Box display="flex" flexDirection="column" alignItems="center" mb={4}>
          <Typography variant="body1" gutterBottom>
            <DownloadIcon fontSize="small" style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Downloading AI model to browser...
          </Typography>
          <LinearProgress style={{ width: '100%', maxWidth: '600px' }} />
        </Box>
      )}

      <Box display="flex" justifyContent="center" mb={4}>
        <Button
          variant="contained"
          component="label"
          size="large"
          color="primary"
          startIcon={<CloudUploadIcon />}
        >
          Upload Files
          <input
            type="file"
            multiple
            onChange={this.handleFileChange}
            accept=".docx"
            hidden
          />
        </Button>
      </Box>

      {analyzing && (
        <Box display="flex" justifyContent="center" mb={4}>
          <CircularProgress />
          <Typography variant="body1" color="textSecondary" style={{ marginLeft: '10px' }}>
            Analyzing files...
          </Typography>
        </Box>
      )}

        <TableContainer component={Paper} style={{ minwith:'1000px', maxWidth: '1400px', margin: '0 auto', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' }}>
          <Table id="resultsTable" aria-label="File PII Classification">
            <TableHead>
              <TableRow style={{ backgroundColor: '#1976d2' }}>
                <TableCell style={{ color: '#fff', fontWeight: 'bold' }}>File Name</TableCell>
                <TableCell align="center" style={{ color: '#fff', fontWeight: 'bold' }}>Contains PII</TableCell>
                <TableCell align="center" style={{ color: '#fff', fontWeight: 'bold' }}>Document Sanatized</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {fileResults.length > 0 ? (
                fileResults.map((file, index) => (
                  <TableRow key={index} hover>
                    <TableCell>{file.filename}</TableCell>
                    <TableCell align="center">{file.hasPII ? 'Yes' : 'No'}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} align="center">No files uploaded</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Box textAlign="center" mt={4}>
          <Typography variant="body2"><strong>Inference Latency:</strong> {latency} ms</Typography>
        </Box>
        
      </div>
    );
  }
}

export default TextInputArea;
