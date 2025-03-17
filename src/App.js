import './App.css';
import React, { Component } from 'react';
import { modelDownloadInProgress, pii_inference, removeNoFilesUploadedRow, convertHtmlToMarkdown, exportHTML } from './inference.js';
import { 
  Box, 
  LinearProgress, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  Typography, 
  Button, 
  Chip,
  Container,
  Card,
  CardContent,
  Grid,
  Divider,
  Alert,
  Fade,
  CircularProgress,
  ButtonGroup,
  Menu,
  MenuItem
} from '@mui/material';
import { Download as DownloadIcon, ContentCopy as ContentCopyIcon, ArrowDropDown as ArrowDropDownIcon } from '@mui/icons-material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DescriptionIcon from '@mui/icons-material/Description';
import SecurityIcon from '@mui/icons-material/Security';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import { PDFDocument } from 'pdf-lib';

class TextInputArea extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      text: 'Enter text to classify PII, model trained on English text.',
      latency: 0.0,
      downloading: modelDownloadInProgress(),
      fileResults: [], // Stores results of PII checks for each file
      analyzing: false, // Track analysis status
      pendingRequests: {}, // Store pending requests by requestId
      receivedInput: false, // Track if a user_input message was received
      showTextPopup: false, // Track if the text popup is visible
      userInputText: '', // Store the user input text
      sanitizedText: '', // Store the sanitized text
      menuAnchor: null // Anchor element for the dropdown menu
    };
  }

  componentDidMount() {
    this._isMounted = true;
    this.timerID = setInterval(() => this.checkModelStatus(), 1000);
    this.loadMammothScript();
    
    // Add event listener for messages from window.postMessage
    window.addEventListener('message', this.handleMessage);
    
    // Notify that the analysis service is ready
    this.notifyServiceReady();
    
    console.log('Event listener added and service ready notification sent');
  }

  componentWillUnmount() {
    this._isMounted = false;
    clearInterval(this.timerID);
    // Remove event listener for messages
    window.removeEventListener('message', this.handleMessage);
  }

  notifyServiceReady = () => {
    // Send a ready message to the extension
    window.postMessage({ 
      type: 'ready'
    }, '*');
    
    console.log('Analysis service ready notification sent');
  }

  handleMessage = async (event) => {
    // For security, verify the origin when in production
    // if (event.origin !== 'chrome-extension://your-extension-id') return;

    console.log('Received message:', event.data);

    // Handle different message types
    if (event.data.type === 'USER_INPUT') {
      const { text, requestId } = event.data;
      
      this.setState({ 
        analyzing: true,
        receivedInput: true // Mark that we've received input
      });

      // Remove the "No files uploaded" row
      removeNoFilesUploadedRow();

      // Post message to the sender saying that the message is received
      window.postMessage({
        type: 'RECEIVED_USER_INPUT',
        requestId: requestId
      }, '*');
      
      try {
        const start = performance.now();
        const result = await this.analyzeText(text, requestId);
        const end = performance.now();
        const latency = (end - start).toFixed(1);
        
        this.setState({ analyzing: false, latency });
        
        // Send the result back to the extension
        window.postMessage({
          type: 'PII_RESULT',
          isPII: result.containsPII,
          sanitizedText: result.sanitizedText,
          requestId: requestId
        }, '*');
        
      } catch (error) {
        console.error('Error analyzing text:', error);
        this.setState({ analyzing: false });
        
        // Send error response back to extension
        window.postMessage({
          type: 'PII_RESULT',
          error: 'Analysis failed',
          requestId: requestId
        }, '*');
      }
    }
  };

  checkModelStatus = () => {
    this.setState({
      downloading: modelDownloadInProgress(),
    });
    
    if (!this.state.downloading) {
      clearInterval(this.timerID);
      this.notifyServiceReady();
    }
  };

  // Function to load Mammoth.js from CDN
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
    let newFileResults = [...this.state.fileResults];

    this.setState({ 
      analyzing: true,
      receivedInput: true // Mark that we've received input
    });

    removeNoFilesUploadedRow(); // Ensure the "No files uploaded yet" row is removed

    const start = performance.now();

    for (const file of files) {
      if (file && file.name.endsWith(".docx")) {
        try {
          const result = await this.processDocxFile(file);
          newFileResults.push({ 
            filename: file.name, 
            hasPII: result.containsPII ? true : false,
            sanitized: 'Yes',// Assuming sanitization is successful if PII is found , if not its already clean
            substituionText: result.substituionText,
            ProcessWordsArray: result.ProcessWordsArray,
            MaskedText: result.resultData ,// Store the raw result data for further processing if needed
            html: result.htmlData // Store the HTML data for further processing if needed
        
          });
        } catch (error) {
          console.error(`Error processing ${file.name}:`, error);
          newFileResults.push({ 
            filename: file.name, 
            hasPII: "Error",
            sanitized: 'No',
            substituionText: "Error",
            ProcessWordsArray: "Error",
            MaskedText: "Error" ,
            html: "Error" // Store the HTML data for further processing if needed
          });
        }
      } else if (file && file.name.endsWith(".pdf")) {
        try {
          const result = await this.processPdfFile(file);
          newFileResults.push({ 
            filename: file.name, 
            hasPII: result.containsPII ? true : false,
            sanitized: 'Yes', // Assuming sanitization is successful if PII is found , if not its already clean
            substituionText: result.substituionText,
            ProcessWordsArray: result.ProcessWordsArray,
            MaskedText: result.resultData ,
            html: result.htmlData // Store the HTML data for further processing if needed
          });
        } catch (error) {
          console.error(`Error processing ${file.name}:`, error);
          newFileResults.push({ 
            filename: file.name, 
            hasPII: "Error",
            sanitized: 'No',
            substituionText: "Error",
            ProcessWordsArray: "Error",
            MaskedText: "Error" ,
            html: "Error" // Store the HTML data for further processing if needed
          });
        }
      } else if (file && file.name.endsWith(".txt")) {
        try {
          const result = await this.processTxtFile(file);
          newFileResults.push({ 
            filename: file.name, 
            hasPII: result.containsPII ? true : false,
            sanitized: 'Yes', // Assuming sanitization is successful if PII is found , if not its already clean
            substituionText: result.substituionText,
            ProcessWordsArray: result.ProcessWordsArray,
            MaskedText: result.resultData ,
            html: result.htmlData // Store the HTML data for further processing if needed
          });
        } catch (error) {
          console.error(`Error processing ${file.name}:`, error);
          newFileResults.push({ 
            filename: file.name, 
            hasPII: "Error",
            sanitized: 'No',
            substituionText: "Error",
            ProcessWordsArray: "Error",
            MaskedText: "Error" ,
            html: "Error" // Store the HTML data for further processing if needed
          });
        }
      } else {
        console.warn("Invalid file format:", file.name);
        alert("Please upload a valid .docx, .pdf, or .txt file.");
      }
    }

    const end = performance.now();
    const latency = (end - start).toFixed(1);

    // Ensure the component is still mounted before updating the state
    if (this._isMounted) {
      this.setState({ 
        analyzing: false, 
        latency,
        fileResults: newFileResults
      });
    }
  };

  processDocxFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        const arrayBuffer = e.target.result;

        if (window.mammoth) {
          try {
            const result = await window.mammoth.convertToHtml({ arrayBuffer });
            const analysisResult = await this.analyzeText(result.value, file.name);
            resolve(analysisResult);
          } catch (error) {
            reject(error);
          }
        } else {
          reject(new Error("Mammoth.js is not loaded."));
        }
      };
      
      reader.onerror = () => reject(new Error("File reading failed"));
      reader.readAsArrayBuffer(file);
    });
  };

  processPdfFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        const arrayBuffer = e.target.result;

        try {
          const pdfDoc = await PDFDocument.load(arrayBuffer);
          const pages = pdfDoc.getPages();
          let textContent = '';

          for (const page of pages) {
            const text = await page.getTextContent();
            textContent += text.items.map(item => item.str).join(' ');
          }

          const analysisResult = await this.analyzeText(textContent, file.name);
          resolve(analysisResult);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error("File reading failed"));
      reader.readAsArrayBuffer(file);
    });
  };

  processTxtFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        const textContent = e.target.result;

        try {
          const analysisResult = await this.analyzeText(textContent, file.name);
          resolve(analysisResult);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error("File reading failed"));
      reader.readAsText(file);
    });
  };

  // Analyze text for PII and return a structured result
  analyzeText = async (text, source) => {
    try {
      // Run the PII inference
      var  resultData  = await pii_inference(text, source);

      
      // Check if PII is detected
      const containsPII = this.checkForPII(resultData.pt);
      //wrap the resultData.st // in a promise to ensure it is resolved before proceeding
      // do not call sanitize text just wrpa in promise 
      const substituionText = new Promise((resolve) => {
        resolve(resultData.st);
      });

      // Process the words array for further analysis
      const ProcessWordsArray = new Promise((resolve) => {
        resolve(resultData.pw);
      });
      //process the htmlData for further analysis
      const htmlData = new Promise((resolve) => {
        resolve(resultData.html);
      });
      //process the substitution HTML
      const substitutionHTML = new Promise((resolve) => {
        resolve(resultData.subHTML);
      });
  
      return {
        containsPII,
        resultData, // Return the raw result data for further processing if needed
        source,
        substituionText,
        ProcessWordsArray,
        htmlData,
        substitutionHTML
      };
    } catch (error) {
      console.log('PII analysis error:', error);
      throw error;
    }
  };

  // Sanitize text by replacing PII entities with placeholders
  sanitizeText = (text, resultData) => {
    // This is a simple placeholder. In a real implementation,
    // you would parse resultData to identify the exact PII entities
    // and replace them with appropriate placeholders while preserving
    // the rest of the text structure.
    
    let sanitized = text;
    
    // Example sanitization logic (very simplified)
    resultData.forEach((entry) => {
      if (entry.includes("[B-") || entry.includes("[I-")) {
        //replatce all  '[B-' and '[I' char [ so as to not confuse with html tags wit [B- and [I-
        var re = new RegExp('\\[B-', 'g');
        var re2 = new RegExp('\\[I-', 'g');
        sanitized = sanitized.replace(re, '[');
        sanitized = sanitized.replace(re2, '[');
      }
    });
    
    return sanitized;
  };

  // Check if the result data contains any PII markers
  checkForPII = (resultData) => {
    //split into arry of words then check if any of the words contain PII markers
    var newRetuned = resultData.split(' ')
    return newRetuned.some((entry) => entry.includes("[B-") || entry.includes("[I-"));
  };

  // Function to handle the sanitization of user input text
  handleSanitizeText = async () => {
    this.setState({ analyzing: true });
    try {
      if (!this.state.userInputText.trim()) {
        alert("Please enter some text to sanitize.");
        this.setState({ analyzing: false });
        return;
      }
      const requestId = `userInput-${Date.now()}`;
      const fileNameKey = `User_Input_${requestId}.txt`;

      this.setState((prevState) => ({
        fileResults: [...prevState.fileResults, { filename: fileNameKey, hasPII: 'Pending', sanitized: false }]
      }));

      this.toggleTextPopup();

      const result = await this.analyzeText(this.state.userInputText, fileNameKey);
      const updatedFileResults = this.state.fileResults.map((file) => {
        if (file.filename === fileNameKey) {
          return {
            ...file,
            hasPII: result.containsPII ? 'Yes' : 'No',
            sanitized: result.containsPII && result.sanitizedText ? 'Yes' : 'No'
          };
        }
        return file;
      });

      this.setState({ sanitizedText: result.sanitizedText, analyzing: false, fileResults: updatedFileResults });
    } catch (error) {
      console.error('Error sanitizing text:', error);
      this.setState({ analyzing: false });
    }
  };

  // Function to toggle the text popup visibility
  toggleTextPopup = () => {
    this.setState((prevState) => ({ showTextPopup: !prevState.showTextPopup }));
  };

  // Function to handle text input change
  handleTextInputChange = (event) => {
    this.setState({ userInputText: event.target.value });
  };

  // Function to handle opening the dropdown menu
  setMenuAnchor = (event) => {
    this.setState({ menuAnchor: event.currentTarget });
  };

  // Function to handle closing the dropdown menu
  handleMenuClose = () => {
    this.setState({ menuAnchor: null });
  };

  render() {
    const { downloading, fileResults, latency, analyzing, receivedInput, showTextPopup, userInputText, sanitizedText, menuAnchor } = this.state;

    return (
      <Box sx={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(145deg, #f9f9f9 0%, #f0f0f0 100%)',
        py: 4
      }}>
        <Container maxWidth="lg">
          <Card 
            elevation={3} 
            sx={{ 
              borderRadius: 2, 
              overflow: 'hidden', 
              mb: 4
            }}
          >
            <Box 
              sx={{ 
                p: 3, 
                backgroundColor: '#1976d2',
                color: 'white',
                textAlign: 'center' // Center the title
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
                <DescriptionIcon fontSize="large" />
                <Typography variant="h4" fontWeight="500">
                  Document PII Classification
                </Typography>
              </Box>
              <Typography variant="subtitle1" sx={{ opacity: 0.9, mt: 1 }}>
                Scan documents for Personally Identifiable Information
              </Typography>
            </Box>

            <CardContent sx={{ p: 4 }}>
              <Grid container spacing={4}>
                <Grid item xs={12}>
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2,
                      py: 2,
                      px: 3,
                      backgroundColor: 'rgba(25, 118, 210, 0.08)',
                      borderRadius: 2,
                      border: '1px solid rgba(25, 118, 210, 0.2)'
                    }}
                  >
                    <SecurityIcon color="primary" />
                    <Typography variant="body1">
                      This application uses client-side processing to scan for 40 types of PII.
                      Your data never leaves your device, ensuring complete privacy and security.
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              {downloading && (
                <Fade in={downloading}>
                  <Box mt={4}>
                    <Alert 
                      severity="info" 
                      icon={<DownloadIcon />}
                      sx={{ mb: 2, alignItems: 'center' }}
                    >
                      Downloading AI model to browser...
                    </Alert>
                    <LinearProgress
                      variant="indeterminate"
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>
                </Fade>
              )}

              <Box 
                sx={{ 
                  mt: 4, 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2
                }}
              >
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="contained"
                    component="label"
                    size="large"
                    color="primary"
                    startIcon={<CloudUploadIcon />}
                    disabled={downloading || analyzing}
                    sx={{ 
                      px: 4,
                      py: 1.5,
                      borderRadius: 2,
                      fontWeight: 'bold',
                      boxShadow: '0 4px 12px rgba(25, 118, 210, 0.2)'
                    }}
                  >
                    Sanitize File
                    <input
                      type="file"
                      multiple
                      onChange={this.handleFileChange}
                      accept=".docx"
                      hidden
                    />
                  </Button>

                  <Button
                    variant="contained"
                    size="large"
                    color="primary"
                    onClick={this.toggleTextPopup}
                    startIcon={<SecurityIcon />}
                    disabled={downloading || analyzing}
                    sx={{ 
                      px: 4,
                      py: 1.5,
                      borderRadius: 2,
                      fontWeight: 'bold',
                      boxShadow: '0 4px 12px rgba(25, 118, 210, 0.2)'
                    }}
                  >
                    Sanitize Text
                  </Button>
                </Box>

                {analyzing && (
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2,
                      mt: 2
                    }}
                  >
                    <CircularProgress size={24} />
                    <Typography variant="body1" color="text.secondary">
                      Analyzing documents...
                    </Typography>
                  </Box>
                )}
              </Box>

              <Divider sx={{ my: 4 }} />

              <Card 
                variant="outlined" 
                sx={{ 
                  borderRadius: 2,
                  overflow: 'hidden'
                }}
              >
                <TableContainer>
                  <Table id="resultsTable" aria-label="File PII Classification">
                    <TableHead>
                      <TableRow sx={{ backgroundColor: 'rgba(25, 118, 210, 0.08)' }}>
                        <TableCell sx={{ fontWeight: 'bold', py: 2 }}>
                          File Name
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold', py: 2 }}>
                          Contains PII
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold', py: 2 }}>
                          Document Sanitized
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold', py: 2 }}>
                          Sanitization Actions
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {fileResults.length > 0 ? (
                        fileResults.map((file, index) => (
                          <TableRow 
                            key={index} 
                            hover
                            sx={{ 
                              '&:last-child td, &:last-child th': { border: 0 },
                              backgroundColor: index % 2 === 0 ? 'white' : 'rgba(0, 0, 0, 0.02)'
                            }}
                          >
                            <TableCell sx={{ py: 2 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <DescriptionIcon color="action" fontSize="small" />
                                <Typography variant="body2">{file.filename}</Typography>
                              </Box>
                            </TableCell>
                            <TableCell align="center" sx={{ py: 2 }}>
                              {typeof file.hasPII === 'boolean' ? (
                                <Chip
                                  icon={file.hasPII ? <ErrorIcon /> : <CheckCircleIcon />}
                                  label={file.hasPII ? 'Yes' : 'No'}
                                  color={file.hasPII ? 'error' : 'success'}
                                  size="small"
                                  variant="outlined"
                                />
                              ) : (
                                <Chip
                                  icon={<InfoIcon />}
                                  label={file.hasPII}
                                  color="warning"
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                            </TableCell>
                            <TableCell align="center" sx={{ py: 2 }}>
                              <Chip
                                label={file.sanitized ? 'Yes' : 'No'}
                                color={file.sanitized ? 'success' : 'default'}
                                size="small"
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell align="center" sx={{ py: 2 }}>
                            <ButtonGroup variant="contained" color="primary">
                              <Button
                                variant="contained"
                                color="primary"
                                size="small"
                                onClick={async () => {
                                  var content = await convertHtmlToMarkdown(file);
                                  navigator.clipboard.writeText(content);
                                  if (navigator.clipboard) {
                                    navigator.clipboard.writeText(content).then(() => {
                                      console.log('Text copied to clipboard');
                                    }).catch(err => {
                                      console.error('Could not copy text: ', err);
                                    });
                                  } else {
                                    alert('Clipboard API not supported');
                                  }
                                   this.handleMenuClose();
                                }}
                              >
                                Copy Markdown
                              </Button>
                              <Button 
                                color="secondary"
                                size="primary"
                                onClick={this.setMenuAnchor}
                                sx={{ padding: '4px 8px' }}
                              >
                                <ArrowDropDownIcon />
                              </Button>

                              {/* Dropdown Menu */}
                              <Menu 
                                anchorEl={menuAnchor} 
                                open={Boolean(menuAnchor)} 
                                onClose={this.handleMenuClose}
                              >
                                <MenuItem onClick={async () => { 
                                  var content = await convertHtmlToMarkdown(file);
                                  navigator.clipboard.writeText(content);
                                  if (navigator.clipboard) {
                                    navigator.clipboard.writeText(content).then(() => {
                                      console.log('Text copied to clipboard');
                                    }).catch(err => {
                                      console.error('Could not copy text: ', err);
                                    });
                                  } else {
                                    alert('Clipboard API not supported');
                                  }
                                   this.handleMenuClose(); }}>
                                  <ContentCopyIcon sx={{ mr: 1 }} /> Copy Markdown
                                </MenuItem>
                                <MenuItem onClick={ async() => { 
                                  var content = await exportHTML(file);
                                  // Create a Blob with the HTML content
                                  const blob = new Blob([content], { type: 'text/html' });
                                  
                                  // Create a URL for the blob
                                  const url = URL.createObjectURL(blob);
                                  
                                  // Create a temporary anchor element
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `${file.name || 'document'}.html`;
                                  
                                  // Append to the document, click it, and remove it
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  
                                  // Clean up the URL object
                                  URL.revokeObjectURL(url);
                                  
                                  this.handleMenuClose(); 
                                 }}
                                  >
                                  <DownloadIcon sx={{ mr: 1 }} /> Download as HTML
                                </MenuItem>
                                <MenuItem onClick={async () => { 
                                  var content = await convertHtmlToMarkdown(file);
                                  // Create a Blob with the Markdown content
                                  const blob = new Blob([content], { type: 'text/markdown' });
                                  // Create a URL for the blob
                                  const url = URL.createObjectURL(blob);
                                  // Create a temporary anchor element
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `${file.name || 'document'}.md`;
                                  // Append to the document, click it, and remove it
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  // Clean up the URL object
                                  URL.revokeObjectURL(url);
                                  // Close the menu after download
                                   this.handleMenuClose(); 
                                  }}>
                                  <DownloadIcon sx={{ mr: 1 }} /> Download as Markdown
                                </MenuItem>
                                <MenuItem onClick={async() => { /* Your substitution markdown logic */
                                    var content = await convertHtmlToMarkdown(file,true);
                                   navigator.clipboard.writeText(content);
                                   if (navigator.clipboard) {
                                     navigator.clipboard.writeText(content).then(() => {
                                       console.log('Text copied to clipboard');
                                     }).catch(err => {
                                       console.error('Could not copy text: ', err);
                                     });
                                   } else {
                                     alert('Clipboard API not supported');
                                   } 
                                  this.handleMenuClose(); }}>
                                  <ContentCopyIcon sx={{ mr: 1 }} /> Copy as Substitution Markdown
                                </MenuItem>
                                <MenuItem onClick={async() => {
                                  //option to donwload the substitution markdown
                                  var content = await convertHtmlToMarkdown(file,true);
                                  navigator.clipboard.writeText(content);
                                  //download the content to a file
                                  const blob = new Blob([content], { type: 'text/markdown' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `${file.name || 'document'}.md`;
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  URL.revokeObjectURL(url);
                                  this.handleMenuClose();
                                }}>
                                  <DownloadIcon sx={{ mr: 1 }} /> Download Substitution Markdown

                                   
                                </MenuItem>
                              </Menu>
                            </ButtonGroup>
                             
                            </TableCell>
                          </TableRow>
                        ))
                      ) : !receivedInput ? ( // Only show "No files uploaded" if no input has been received
                        <TableRow>
                          <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                            <Box 
                              sx={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                alignItems: 'center',
                                gap: 2,
                                color: 'text.secondary',
                                p: 3
                              }}
                            >
                              <InfoIcon fontSize="large" />
                              <Typography variant="body1">
                                No files uploaded yet
                              </Typography>
                              <Typography variant="body2">
                                Upload .docx files to begin scanning for PII
                              </Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} sx={{ height: '100px' }} /> 
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Card>

              {latency > 0 && (
                <Box 
                  sx={{ 
                    mt: 3, 
                    display: 'flex',
                    justifyContent: 'flex-end'
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    <strong>Inference Latency:</strong> {latency} ms
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
          
          <Box sx={{ textAlign: 'center', mt: 4, color: 'text.secondary' }}>
            <Typography variant="body2">
              © 2025 PII Classification Tool | Privacy-Preserving Document Analysis
            </Typography>
          </Box>
        </Container>

        {showTextPopup && (
          <Box 
            sx={{ 
              position: 'fixed', 
              top: 0, 
              left: 0, 
              width: '100%', 
              height: '100%', 
              backgroundColor: 'rgba(0, 0, 0, 0.5)', 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center' 
            }}
          >
            <Card sx={{ width: '80%', maxWidth: '600px', p: 4 }}>
              <Typography variant="h6" gutterBottom>
                Sanitize Text
              </Typography>
              <textarea
                value={userInputText}
                onChange={this.handleTextInputChange}
                rows="10"
                style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
                <Button variant="contained" color="primary" onClick={this.handleSanitizeText}>
                  Sanitize Text
                </Button>
                <Button variant="outlined" color="secondary" onClick={this.toggleTextPopup}>
                  Close
                </Button>
              </Box>
              {sanitizedText && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle1">Sanitized Text:</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', backgroundColor: '#f9f9f9', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}>
                    {sanitizedText}
                  </Typography>
                </Box>
              )}
            </Card>
          </Box>
        )}
      </Box>
    );
  }
}

export default TextInputArea;
