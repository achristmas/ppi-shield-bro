import './App.css';
import React, { Component } from 'react';
import { modelDownloadInProgress, pii_inference, removeNoFilesUploadedRow, convertHtmlToMarkdown, exportHTML } from './inference.js';
import { getPiiCategory, getHighRiskCount, getLowRiskCount,getModerateRiskCount,getLabelCount } from './piiananlytics.js';
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
  MenuItem,
  Collapse,
  IconButton ,
  ListItemIcon
} from '@mui/material';
import { Download as DownloadIcon, ContentCopy as ContentCopyIcon, ArrowDropDown as ArrowDropDownIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DescriptionIcon from '@mui/icons-material/Description';
import SecurityIcon from '@mui/icons-material/Security';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import { PDFDocument } from 'pdf-lib';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import CloseIcon from '@mui/icons-material/Close';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LockIcon from '@mui/icons-material/Lock';
import { Settings as SettingsIcon, Logout, Person } from '@mui/icons-material';
import DeleteIcon from '@mui/icons-material/Delete';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

class TextInputArea extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      text: 'Enter text to classify PII, model trained on English text.',
      latency: 0.0,
      downloading: modelDownloadInProgress(),
      fileResults: JSON.parse(localStorage.getItem('fileResults')) || [], 
      analyzing: false, // Track analysis status
      pendingRequests: {}, // Store pending requests by requestId
      receivedInput: false, // Track if a user_input message was received
      showTextPopup: false, // Track if the text popup is visible
      userInputText: '', // Store the user input text
      sanitizedText: '', // Store the sanitized text
      menuAnchor: null, // Anchor element for the dropdown menu
      expandedRow: null // Track the expanded row
    };

    // Bind functions to the component's context
    this.onSettings = this.onSettings.bind(this);
    this.onClose = this.onClose.bind(this);
    this.setMenuAnchor = this.setMenuAnchor.bind(this); // Bind setMenuAnchor
    this.handleMenuClose = this.handleMenuClose.bind(this); // Bind handleMenuClose
  }

  // Define the onSettings function
  onSettings() {
    console.log('Settings button clicked');
    // Add your settings logic here
  }

   // Define the onClose function
   onClose() {
    console.log('Close button clicked');
    // Add your close logic here
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

  componentDidUpdate(prevProps, prevState) {
    if (prevState.fileResults !== this.state.fileResults) {
      localStorage.setItem('fileResults', JSON.stringify(this.state.fileResults));
    }
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
  //function to santatize arbitrary text and add it to the table with the inputed name;  the function will be called when 
  //a message is received from the extension ; the displayed file name should include the domain of the origin of the messaage ; it will be in
  // passed as input to the functionalong with the request data
  // the requestId will be used to identify the message and update the table with the result of the analysis
  // the requestId will be passed to the analyzeText function to identify the source of the text
  // the requestId will be used to update the table with the result of the analysis
  extensionProcessiong = async (requestId, text) => {
    const fileNameKey = `Input_${requestId}.txt`; 
    this.setState((prevState) => ({
      fileResults: [...prevState.fileResults, { filename: fileNameKey, hasPII: 'Pending', sanitized: false }]
    }));
  
    // Call the analyzeText function to process the text and update the table with the result
    const result = await this.analyzeText(text, fileNameKey);
    //add results to  newFileResults array 
    let newFileResults = [...this.state.fileResults];
    // Update the fileResults { 
          //   filename: file.name, 
          //   hasPII: "Error",
          //   sanitized: 'No',
          //   substituionText: "Error",
          //   ProcessWordsArray: "Error",
          //   MaskedText: "Error" ,
          //   html: "Error", // Store the HTML data for further processing if needed
          //   analytics: "Error" ,// Store the analytics results for further processing if needed
          //   unalteratedText: "Error" // Store the unaltered text for reference
          // }
    newFileResults = newFileResults.map((file) => {
      if (file.filename === fileNameKey) {
        return {
          ...file,
          hasPII: result.containsPII ? 'Yes' : 'No',
          sanitized: result.containsPII && result.sanitizedText ? 'Yes' : 'No',
          substituionText: result.substituionText,
          ProcessWordsArray: result.ProcessWordsArray,
          MaskedText: result.resultData,
          html: result.htmlData,
          analytics: result.analytics,
          unalteratedText: result.unalteratedText
        };
      }
      return file;
    });

    
  };

  handleMessage = async (event) => {
    // For security, verify the origin when in production
    // if (event.origin !== 'chrome-extension://your-extension-id') return;

    console.log('Received message:', event.data);

    // Handle different message types
   
      var text = '';
      if (event.data.type == 'user_input') {
        
      var mySource =event.data.source_domain
      //strip https:// and www. from the source domain or http://
      mySource = mySource.replace(/https?:\/\//, '').replace(/www\./, '');
      mySource = mySource.replace(/http?:\/\//, ''); //replace / with _ to avoid issues with file names
      //create a requestid from the domain of the origin of the message and the current time
      const requestId = `${mySource}-${Date.now()}`;
        // If the message type is 'user_input', get the text from the event data

        console.log('User input message received:', event.data);

        text = event.data.text;     

        //call processExtensionData promies and pass the request id and text
        const result = await this.processExtensionData(requestId,text);

        var myStuff = await result.analytics;
        var otherStuffHigh = await myStuff.highRiskCount;
        var otherStuffLow = await myStuff.lowRiskCount;
        var otherStuffModerate = await myStuff.moderateRiskCount;
        var otherStuffLabel = await myStuff.labelCount;
        //construct an analytics object to store the results
        var updatedmyStuff = {
          highRiskCount: otherStuffHigh,
          lowRiskCount: otherStuffLow,
          moderateRiskCount: otherStuffModerate,
          labelCount: otherStuffLabel,

        }
        
        let newFileResults = [...this.state.fileResults];
        
        newFileResults.push({ 
          filename: requestId, 
          hasPII: result.containsPII ? true : false,
          sanitized: 'Yes',// Assuming sanitization is successful if PII is found , if not its already clean
          substituionText: result.substituionText,
          ProcessWordsArray: result.ProcessWordsArray,
          MaskedText: result.resultData ,// Store the raw result data for further processing if needed
          html: result.htmlData, // Store the HTML data for further processing if needed
          analytics: updatedmyStuff ,// Store the analytics results for further processing if needed
          unalteratedText: result.unalteratedText // Store the unaltered text for reference
      
        });
         // Ensure the component is still mounted before updating the state
        if (this._isMounted) {
          this.setState({ 
            analyzing: false, 
            fileResults: newFileResults
          });
        }
            // Post a message to the parent iframe
          const message = {
            type: 'analysis_complete',
            requestId: requestId,
            result: {
              containsPII: result.containsPII,
              analytics: updatedmyStuff,
              sanitizedText: await result.substituionText,
            },
          };
          window.parent.postMessage(message, '*');

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

    //removeNoFilesUploadedRow(); // Ensure the "No files uploaded yet" row is removed

    const start = performance.now();

    for (const file of files) {
      if (file && file.name.endsWith(".docx")) {
        try {
          const result = await this.processDocxFile(file);

          var myStuff = await result.analytics;
          var otherStuffHigh = await myStuff.highRiskCount;
          var otherStuffLow = await myStuff.lowRiskCount;
          var otherStuffModerate = await myStuff.moderateRiskCount;
          var otherStuffLabel = await myStuff.labelCount;
          //construct an analytics object to store the results
          var updatedmyStuff = {
            highRiskCount: otherStuffHigh,
            lowRiskCount: otherStuffLow,
            moderateRiskCount: otherStuffModerate,
            labelCount: otherStuffLabel
          }
          
          
          newFileResults.push({ 
            filename: file.name, 
            hasPII: result.containsPII ? true : false,
            sanitized: 'Yes',// Assuming sanitization is successful if PII is found , if not its already clean
            substituionText: result.substituionText,
            ProcessWordsArray: result.ProcessWordsArray,
            MaskedText: result.resultData ,// Store the raw result data for further processing if needed
            html: result.htmlData, // Store the HTML data for further processing if needed
            analytics: updatedmyStuff ,// Store the analytics results for further processing if needed
            unalteratedText: result.unalteratedText // Store the unaltered text for reference
        
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
            html: "Error", // Store the HTML data for further processing if needed
            analytics: "Error", // Store the analytics results for further processing if needed
            unalteratedText: "Error" // Store the unaltered text for reference

          });
        }
      } else if (file && file.name.endsWith(".pdf")) {
        try {
          const result = await this.processPdfFile(file);
          var myStuffpd = await result.analytics;
          newFileResults.push({ 
            filename: file.name, 
            hasPII: result.containsPII ? true : false,
            sanitized: 'Yes', // Assuming sanitization is successful if PII is found , if not its already clean
            substituionText: result.substituionText,
            ProcessWordsArray: result.ProcessWordsArray,
            MaskedText: result.resultData ,
            html: result.htmlData, // Store the HTML data for further processing if needed
            analytics: myStuffpd ,// Store the analytics data for further processing if needed
            unalteratedText: result.unalteratedText // Store the unaltered text for reference
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
            html: "Error", // Store the HTML data for further processing if needed
            analytics: "Error" ,// Store the analytics results for further processing if needed
            unalteratedText: "Error" // Store the unaltered text for reference
          });
        }
      } else if (file && file.name.endsWith(".txt")) {
        try {
          const result = await this.processTxtFile(file);
          var myStufftx = await result.analytics;
          newFileResults.push({ 
            filename: file.name, 
            hasPII: result.containsPII ? true : false,
            sanitized: 'Yes', // Assuming sanitization is successful if PII is found , if not its already clean
            substituionText: result.substituionText,
            ProcessWordsArray: result.ProcessWordsArray,
            MaskedText: result.resultData ,
            html: result.htmlData, // Store the HTML data for further processing if needed
            analytics: myStufftx, // Store the analytics results for further processing if needed
            unalteratedText: result.unalteratedText // Store the unaltered text for reference
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
            html: "Error", // Store the HTML data for further processing if needed
            analytics: "Error" ,// Store the analytics results for further processing if needed
            unalteratedText: "Error" // Store the unaltered text for reference
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

  processExtensionData = async (requestId, text) => {
    return new Promise((resolve, reject) => {
      if (!text || !requestId) {
        console.error('Invalid request data:', { requestId, text });
        reject(new Error('Invalid request data'));
      } else {
          try {
          // Call the extensionProcessing function to handle the text analysis
          const result = this.analyzeText(text, requestId);
          resolve(result);
        } catch (error) {
          console.error('Error processing extension data:', error);
          reject(error);
        }
      }
     
    });
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
        resolve(resultData.sr);
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
      //peforma analytics on the resultData
      const analytics = new Promise((resolve) => {
        resolve({
          highRiskCount: getHighRiskCount(resultData.pt),
          lowRiskCount: getLowRiskCount(resultData.pt),
          moderateRiskCount: getModerateRiskCount(resultData.pt),
          labelCount: getLabelCount(resultData.pt) // Assuming getPiiCategory returns a count object
        });
      }
      );
      //unalterated text
      const unalteratedText = text;

       // Log the analytics object for debugging
      analytics.then(data => console.log('Analytics:', data));
      return {
        containsPII,
        resultData, // Return the raw result data for further processing if needed
        source,
        substituionText,
        ProcessWordsArray,
        htmlData,
        substitutionHTML,
        analytics,// Return the analytics results for further processing if needed
        unalteratedText // Return the unaltered text for reference
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
  setMenuAnchor(event) {
    this.setState({ menuAnchor: event.currentTarget });
  }

  

  // Function to handle row expansion
  handleRowExpand = (index) => {
    this.setState((prevState) => ({
      // Toggle the expanded row state
      expandedRow: prevState.expandedRow === index ? null : index
    }));
  };

  handleMenuOpen = (event) => {
    this.setState({ menuAnchor: event.currentTarget });
  };

  handleMenuClose() {
    this.setState({ menuAnchor: null });
  }
  handleClearStorage = () => {
    localStorage.clear();
    // completed storage delete notification to the use
    
    const completionNotification = document.createElement('div');
    completionNotification.className = 'notification';
    completionNotification.textContent = 'Local storage cleared';
   
    Object.assign(completionNotification.style, {
      backgroundColor: 'green',
      padding: '10px 20px',
      borderRadius: '8px',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
      zIndex: '1000',
      fontFamily: 'Arial, sans-serif',
      marginTop: '20px',
      position: 'fixed',
      top: '10px',
      right: '10px'
    });
    
    const existingNotifications = document.getElementsByClassName('notification');
    for (let i = 0; i < existingNotifications.length; i++) {
      try {
        document.body.removeChild(existingNotifications[i]);
      }
      catch (e) {
        console.log("Error removing existing notification: ", e);
      }
     
    }
    document.body.appendChild(completionNotification);
    setTimeout(() => {
      document.body.removeChild(completionNotification);
    }, 5000);
    //Update the state to reflect the changes 
    this.setState({ fileResults: [] });

    this.handleMenuClose();
  };

  render() {
    const { downloading, fileResults, latency, analyzing, receivedInput, showTextPopup, userInputText, sanitizedText, menuAnchor, expandedRow,onClose, onSettings, setMenuAnchor, onProfile} = this.state;

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
        p: 4, 
        background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
        color: 'white',
        textAlign: 'left',
        borderRadius: 2,
        boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: 3
      }}
    >
      {/* Logo */}
      <img 
        src="/static/piishieldlogo3.png" 
        alt="PII Shield Logo" 
        style={{ 
          width: 80, 
          height: 80, 
          objectFit: 'contain',
          filter: 'drop-shadow(0px 2px 6px rgba(0,0,0,0.2))'
        }} 
      />

      {/* Text Content */}
      <Box>
        <Typography 
          variant="h4" 
          fontWeight="700" 
          sx={{ 
            textTransform: 'uppercase', 
            letterSpacing: '1px', 
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Box 
            component="span" 
            sx={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '2px',
              transform: 'scale(1.2)',
              transformOrigin: 'left center',
            }}
          >
            <Box
              sx={{
                position: 'relative',
                width: '1.3em',
                height: '1.5em',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                clipPath: 'polygon(50% 0%, 100% 0, 100% 70%, 50% 100%, 0 70%, 0 0)',
                background: 'linear-gradient(135deg, #4285F4, #0F52BA)',
                boxShadow: '0 3px 6px rgba(0,0,0,0.16)',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              <Typography
                component="span"
                variant="h4"
                fontWeight="900"
                sx={{
                  position: 'absolute',
                  top: '0.05em',
                  color: '#ffffff',
                  textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                  fontSize: '1.1em',
                }}
              >
                V
              </Typography>
            </Box>
          </Box>
          
          <Box 
            component="span" 
            sx={{ 
              background: 'linear-gradient(90deg, #ffffff, #fbbc04)', 
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              paddingLeft: '7px',
              paddingRight: '7px',
            }}
          >
            iKelaAI
          </Box>
        </Typography>
        
        <Typography variant="subtitle1" sx={{ opacity: 0.9, mt: 1 }}>
          Sensitive Data Scanning, Sanitization, and Risk Analysis  
        </Typography>
      </Box>

      {/* Settings Button */}
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          flexGrow: 1, 
          pr: 2
        }}
      >
        <IconButton
          aria-label="settings"
          onClick={this.handleMenuOpen}
          sx={{ 
            color: 'white', 
            transition: '0.2s ease-in-out',
            '&:hover': { color: '#fbbc04' }
          }}
        >
          <SettingsIcon fontSize="large" />
        </IconButton>

        {/* Dropdown Menu */}
        <Menu
          anchorEl={this.state.menuAnchor}
          open={Boolean(this.state.menuAnchor)}
          onClose={this.handleMenuClose}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          sx={{
            '& .MuiPaper-root': {
              background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
              color: 'white',
              borderRadius: 2,
              boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.2)',
              minWidth: 180,
              mt: 1
            }
          }}
        >
          {/* <MenuItem onClick={onProfile} sx={{ '&:hover': { backgroundColor: '#1976d2' } }}>
            <ListItemIcon><Person sx={{ color: 'white' }} /></ListItemIcon>
            <Typography variant="body1">Profile</Typography>
          </MenuItem>

          <MenuItem onClick={onSettings} sx={{ '&:hover': { backgroundColor: '#1976d2' } }}>
            <ListItemIcon><SettingsIcon sx={{ color: 'white' }} /></ListItemIcon>
            <Typography variant="body1">Settings</Typography>
          </MenuItem>

          <Divider sx={{ bgcolor: 'rgba(255,255,255,0.2)' }} /> */}

          <MenuItem onClick={this.handleClearStorage} sx={{ '&:hover': { backgroundColor: '#fbbc04' } }}>
            <ListItemIcon><DeleteIcon sx={{ color: 'white' }} /></ListItemIcon>
            <Typography variant="body1">Clear Local Storage</Typography>
          </MenuItem>

          {/* <MenuItem onClick={onClose} sx={{ '&:hover': { backgroundColor: '#d32f2f' } }}>
            <ListItemIcon><Logout sx={{ color: 'white' }} /></ListItemIcon>
            <Typography variant="body1">Logout</Typography>
          </MenuItem> */}
        </Menu>
      </Box>
    </Box>

            <CardContent sx={{ p: 4 }}>
            

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
                        <TableCell align="center" sx={{ fontWeight: 'bold', py: 2 }}>
                          Risk Detail
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {fileResults.length > 0 ? (
                        fileResults.map((file, index) => (
                          <React.Fragment key={index}>
                            <TableRow 
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
                                     
                                      if (navigator.clipboard) {
                                        navigator.clipboard.writeText(content).then(() => {
                                          console.log('Text copied to clipboard');
                                        }).catch(err => {
                                        //post a clipboard mesage to the iframe parent 
                                          console.error('Could not copy text: ', err);
                                          //postMessage to parent to copy message to clipboard
                                          const message = {
                                            type: 'clipboard_copy',
                                            content: content
                                          };
                                          window.parent.postMessage(message, '*');
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
                                    color="primary"
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
                                     
                                      if (navigator.clipboard) {
                                        navigator.clipboard.writeText(content).then(() => {
                                          console.log('Text copied to clipboard');
                                        }).catch(err => {
                                         //post a clipboard mesage to the iframe parent 
                                         console.error('Could not copy text: ', err);
                                         //postMessage to parent to copy message to clipboard
                                         const message = {
                                           type: 'clipboard_copy',
                                           content: content
                                         };
                                         window.parent.postMessage(message, '*');
                                        });
                                      } else {
                                        alert('Clipboard API not supported');
                                      }
                                      this.handleMenuClose(); }}>
                                      <ContentCopyIcon sx={{ mr: 1 }} /> Copy as Markdown
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
                                      var myfNameTouse = await file.filename;
                                      a.download = `${myfNameTouse || 'document'}.html`;
                                      
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
                                      var fileNameTU = await file.filename;
                                      a.download = `${fileNameTU || 'document'}.md`;
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
                                     
                                      if (navigator.clipboard) {
                                        navigator.clipboard.writeText(content).then(() => {
                                          console.log('Text copied to clipboard');
                                        }).catch(err => {
                                          //post a clipboard mesage to the iframe parent 
                                          console.error('Could not copy text: ', err);
                                          //postMessage to parent to copy message to clipboard
                                          const message = {
                                            type: 'clipboard_copy',
                                            content: content
                                          };
                                          window.parent.postMessage(message, '*');
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
                                      var fileNameTUos = await file.filename;
                                      a.download = `${fileNameTUos || 'document'}.md`;
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
                              <TableCell align="center" sx={{ py: 2 }}>
                                <IconButton
                                  onClick={() => {
                                   
                                    this.handleRowExpand(index);
                                  }}
                                  aria-expanded={expandedRow === index}
                                  aria-label="show more"
                                >
                                  <ExpandMoreIcon />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                            <TableRow className="analytics-row">
                              <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
                                <Collapse in={expandedRow === index} timeout="auto" unmountOnExit>
                                  <Box 
                                    sx={{ 
                                      margin: 3, 
                                      borderRadius: 2, 
                                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                      backgroundColor: 'white',
                                      padding: 3,
                                      border: '1px solid rgba(0,0,0,0.08)'
                                    }}
                                  >
                                    <Box display="flex" alignItems="center" mb={2}>
                                      <Typography 
                                        variant="h6" 
                                        component="div" 
                                        sx={{ 
                                          fontWeight: 600, 
                                          color: '#2C3E50',
                                          flexGrow: 1
                                        }}
                                      >
                                        Document Risk Analysis
                                      </Typography>
                                      
                                      <Chip 
                                        label={
                                          file.analytics?.highRiskCount > 0 ? "High Risk" : 
                                          file.analytics?.moderateRiskCount > 0 ? "Moderate Risk" : "Low Risk"
                                        }
                                        color={
                                          file.analytics?.highRiskCount > 0 ? "error" : 
                                          file.analytics?.moderateRiskCount > 0 ? "warning" : "success"
                                        }
                                        size="small"
                                        sx={{ fontWeight: 500 }}
                                      />
                                    </Box>
                                    
                                    <Divider sx={{ mb: 3 }} />
                                    
                                    <Box sx={{ mb: 4, backgroundColor: '#F8F9FA', p: 2, borderRadius: 1 }}>
                                      <Typography variant="body2" sx={{ color: '#495057', mb: 1, fontWeight: 500 }}>
                                        NIST 800-122 Risk Classification
                                      </Typography>
                                      
                                      <Grid container spacing={2} sx={{ mt: 0.5 }}>
                                        <Grid item xs={12} sm={4}>
                                          <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                                            <Box 
                                              sx={{ 
                                                width: 8, 
                                                height: 8, 
                                                borderRadius: '50%', 
                                                bgcolor: 'error.main', 
                                                mt: 0.7, 
                                                mr: 1.5 
                                              }} 
                                            />
                                            <Typography variant="body2" color="text.secondary">
                                              <Box component="span" sx={{ fontWeight: 600, color: 'error.main' }}>High Risk:</Box> Sensitive PII that could lead to identity theft or serious consequences if disclosed
                                            </Typography>
                                          </Box>
                                        </Grid>
                                        
                                        <Grid item xs={12} sm={4}>
                                          <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                                            <Box 
                                              sx={{ 
                                                width: 8, 
                                                height: 8, 
                                                borderRadius: '50%', 
                                                bgcolor: 'warning.main', 
                                                mt: 0.7, 
                                                mr: 1.5 
                                              }} 
                                            />
                                            <Typography variant="body2" color="text.secondary">
                                              <Box component="span" sx={{ fontWeight: 600, color: 'warning.main' }}>Moderate Risk:</Box> PII that could cause moderate harm if disclosed
                                            </Typography>
                                          </Box>
                                        </Grid>
                                        
                                        <Grid item xs={12} sm={4}>
                                          <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                                            <Box 
                                              sx={{ 
                                                width: 8, 
                                                height: 8, 
                                                borderRadius: '50%', 
                                                bgcolor: 'success.main', 
                                                mt: 0.7, 
                                                mr: 1.5 
                                              }} 
                                            />
                                            <Typography variant="body2" color="text.secondary">
                                              <Box component="span" sx={{ fontWeight: 600, color: 'success.main' }}>Low Risk:</Box> PII with minimal potential harm if disclosed
                                            </Typography>
                                          </Box>
                                        </Grid>
                                      </Grid>
                                    </Box>
                                    
                                    {file.analytics ? (
                                      <Grid container spacing={4}>
                                        <Grid item xs={12} md={6}>
                                          <Box sx={{ height: 250, mb: 2 }}>
                                            <Typography 
                                              variant="subtitle2" 
                                              sx={{ 
                                                mb: 1.5, 
                                                fontWeight: 600, 
                                                color: '#495057',
                                                textAlign: 'left'
                                              }}
                                            >
                                              Document Risk Distribution
                                            </Typography>
                                            <Bar
                                              data={{
                                                labels: ['High Risk', 'Moderate Risk', 'Low Risk'],
                                                datasets: [
                                                  {
                                                    label: 'Risk Level Count',
                                                    data: [
                                                      file.analytics.highRiskCount,
                                                      file.analytics.moderateRiskCount,
                                                      file.analytics.lowRiskCount
                                                    ],
                                                    backgroundColor: [
                                                      'rgba(239, 68, 68, 0.7)',
                                                      'rgba(249, 168, 37, 0.7)',
                                                      'rgba(52, 211, 153, 0.7)'
                                                    ],
                                                    borderColor: [
                                                      'rgba(239, 68, 68, 1)',
                                                      'rgba(249, 168, 37, 1)',
                                                      'rgba(52, 211, 153, 1)'
                                                    ],
                                                    borderWidth: 1,
                                                    borderRadius: 6
                                                  }
                                                ]
                                              }}
                                              options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                plugins: {
                                                  legend: {
                                                    display: false
                                                  }
                                                },
                                                scales: {
                                                  y: {
                                                    beginAtZero: true,
                                                    grid: {
                                                      display: true,
                                                      color: 'rgba(0, 0, 0, 0.05)'
                                                    }
                                                  },
                                                  x: {
                                                    grid: {
                                                      display: false
                                                    }
                                                  }
                                                }
                                              }}
                                            />
                                          </Box>
                                        </Grid>
                                        
                                        <Grid item xs={12} md={6}>
                                          <Box sx={{ height: 250, mb: 2 }}>
                                            <Typography 
                                              variant="subtitle2" 
                                              sx={{ 
                                                mb: 1.5, 
                                                fontWeight: 600, 
                                                color: '#495057',
                                                textAlign: 'left'
                                              }}
                                            >
                                              PII Type Distribution
                                            </Typography>
                                            <Bar
                                              data={{
                                                labels: Object.keys(file.analytics.labelCount).map(label => 
                                                  label.length > 12 ? label.substring(0, 10) + '...' : label
                                                ),
                                                datasets: [
                                                  {
                                                    label: 'Count',
                                                    data: Object.values(file.analytics.labelCount),
                                                    backgroundColor: 'rgba(59, 130, 246, 0.7)',
                                                    borderColor: 'rgba(59, 130, 246, 1)',
                                                    borderWidth: 1,
                                                    borderRadius: 6
                                                  }
                                                ]
                                              }}
                                              options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                plugins: {
                                                  legend: {
                                                    display: false
                                                  },
                                                  tooltip: {
                                                    callbacks: {
                                                      title: (context) => {
                                                        const index = context[0].dataIndex;
                                                        return Object.keys(file.analytics.labelCount)[index];
                                                      }
                                                    }
                                                  }
                                                },
                                                scales: {
                                                  y: {
                                                    beginAtZero: true,
                                                    grid: {
                                                      display: true,
                                                      color: 'rgba(0, 0, 0, 0.05)'
                                                    }
                                                  },
                                                  x: {
                                                    grid: {
                                                      display: false
                                                    }
                                                  }
                                                }
                                              }}
                                            />
                                          </Box>
                                        </Grid>
                                      </Grid>
                                    ) : (
                                      <Box 
                                        sx={{ 
                                          display: 'flex', 
                                          alignItems: 'center', 
                                          justifyContent: 'center',
                                          flexDirection: 'column',
                                          py: 6,
                                          backgroundColor: '#F8F9FA',
                                          borderRadius: 2
                                        }}
                                      >
                                        <AssessmentOutlinedIcon sx={{ fontSize: 48, color: '#CBD5E0', mb: 2 }} />
                                        <Typography variant="body1" color="text.secondary" fontWeight={500}>
                                          No analytics available for this document
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                          Run a scan to generate risk insights
                                        </Typography>
                                        <Button 
                                          variant="outlined" 
                                          size="small" 
                                          startIcon={<PlayArrowIcon />}
                                          sx={{ mt: 2 }}
                                        >
                                          Run Analysis
                                        </Button>
                                      </Box>
                                    )}
                                  </Box>
                                </Collapse>
                              </TableCell>
                            </TableRow>
                          </React.Fragment>
                        ))
                      ) : !receivedInput ? ( // Only show "No files uploaded" if no input has been received
                        <TableRow>
                          <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
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
                          <TableCell colSpan={5} sx={{ height: '100px' }} /> 
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
 <Card 
  sx={{ 
    width: '90%', 
    maxWidth: '700px', 
    p: 0, 
    borderRadius: '12px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1), 0 6px 10px rgba(0, 0, 0, 0.08)',
    overflow: 'hidden'
  }}
>
  {/* Header with gradient and icon */}
  <Box 
      sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        p: 2.5,
        pb: 2,
        background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
        color: 'white'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        {/* User Settings Button */}
        <IconButton 
          onClick={this.onSettings} // Use this.onSettings
          sx={{ 
            color: 'rgba(255, 255, 255, 0.8)', 
            backgroundColor: 'rgba(255, 255, 255, 0.2)', 
            borderRadius: '8px', 
            p: 1,
            mr: 1.5,
            '&:hover': { 
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
              color: 'white' 
            }
          }}
        >
          <SettingsIcon sx={{ fontSize: 24 }} />
        </IconButton>

        {/* Existing Security Icon */}
        <Box sx={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.2)', 
          borderRadius: '8px', 
          p: 1, 
          display: 'flex' 
        }}>
          <SecurityIcon sx={{ fontSize: 24 }} />
        </Box>
        
        <Typography variant="h6" sx={{ fontWeight: 600, margin: 0 }}>
          PII Sanitizer
        </Typography>
      </Box>
      
      <IconButton 
        onClick={onClose}
        sx={{ 
          color: 'rgba(255, 255, 255, 0.8)', 
          '&:hover': { color: 'white' } 
        }}
      >
        <CloseIcon />
      </IconButton>
    </Box>

  {/* Body content with padding */}
  <Box sx={{ p: 3 }}>
    {/* Description with icon */}
    <Box 
      sx={{ 
        mb: 2.5, 
        p: 2, 
        borderRadius: '8px', 
        backgroundColor: 'rgba(25, 118, 210, 0.08)',
        border: '1px solid rgba(25, 118, 210, 0.2)',
        display: 'flex',
        gap: 2
      }}
    >
      <InfoOutlinedIcon sx={{ color: '#1976d2' }} />
      <Typography variant="body2" color="text.secondary">
        Enter text containing sensitive information. Our AI-powered engine will identify and redact personally identifiable information (PII) such as names, addresses, emails, and phone numbers.
      </Typography>
    </Box>

    {/* Text area with styled border */}
    <Box 
      sx={{ 
        position: 'relative', 
        mb: 3,
        borderRadius: '8px',
        border: '1px solid rgba(0, 0, 0, 0.15)',
        '&:hover': { 
          border: '1px solid rgba(25, 118, 210, 0.5)' 
        },
        '&:focus-within': {
          boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.25)',
          border: '1px solid #1976d2'
        }
      }}
    >
      <textarea
        value={userInputText}
        onChange={this.handleTextInputChange}
        rows="8"
        placeholder="Paste your text containing sensitive information here..."
        style={{ 
          width: '100%', 
          padding: '16px', 
          fontSize: '16px', 
          borderRadius: '8px', 
          border: 'none',
          outline: 'none',
          resize: 'vertical',
          fontFamily: 'inherit',
          backgroundColor: 'transparent'
        }}
      />
    </Box>

    {/* Action buttons */}
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
      <Button 
        variant="contained" 
        color="primary" 
        size="large"
        onClick={this.handleSanitizeText}
        startIcon={<LockOutlinedIcon />}
        sx={{ 
          borderRadius: '8px', 
          px: 3, 
          py: 1.2,
          boxShadow: '0 4px 10px rgba(25, 118, 210, 0.2)',
          fontWeight: 600
        }}
      >
        Sanitize Text
      </Button>
      <Button 
        variant="outlined" 
        color="inherit"
        size="large" 
        onClick={this.toggleTextPopup}
        sx={{ 
          borderRadius: '8px', 
          px: 3,
          borderColor: 'rgba(0, 0, 0, 0.15)',
          color: 'text.secondary'
        }}
      >
        Cancel
      </Button>
    </Box>

    {/* Results section with animation and styled container */}
    {sanitizedText && (
      <Box 
        sx={{ 
          mt: 1, 
          animation: 'fadeIn 0.4s ease-in-out',
          '@keyframes fadeIn': {
            '0%': { opacity: 0, transform: 'translateY(10px)' },
            '100%': { opacity: 1, transform: 'translateY(0)' }
          }
        }}
      >
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            mb: 1.5,
            gap: 1
          }}
        >
          <Box 
            sx={{ 
              width: 10, 
              height: 10, 
              borderRadius: '50%', 
              backgroundColor: '#4caf50' 
            }} 
          />
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Sanitized Result
          </Typography>
        </Box>
        <Box 
          sx={{ 
            whiteSpace: 'pre-wrap', 
            p: 2.5, 
            borderRadius: '8px', 
            backgroundColor: 'rgba(25, 118, 210, 0.04)',
            border: '1px solid rgba(25, 118, 210, 0.15)',
            position: 'relative',
            mb: 1
          }}
        >
          <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
            {sanitizedText}
          </Typography>
        </Box>
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'flex-end' 
          }}
        >
          <Button 
            size="small" 
            startIcon={<ContentCopyIcon sx={{ fontSize: 16 }} />}
            sx={{ 
              textTransform: 'none', 
              color: '#1976d2',
              fontWeight: 500
            }}
          >
            Copy to clipboard
          </Button>
        </Box>
      </Box>
    )}
  </Box>

  {/* Footer with branding - looks great in screenshots */}
  <Box 
    sx={{ 
      borderTop: '1px solid rgba(0, 0, 0, 0.08)', 
      p: 2, 
      px: 3,
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      backgroundColor: 'rgba(0, 0, 0, 0.02)'
    }}
  >
    <Typography variant="caption" color="text.secondary">
      Your data remains private. Processing happens locally.
    </Typography>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Typography variant="caption" color="primary" sx={{ fontWeight: 500 }}>
        Secured with
      </Typography>
      <LockIcon sx={{ fontSize: 14, color: 'primary.main' }} />
    </Box>
  </Box>
</Card>
          </Box>
        )}
      </Box>
    );
  }
}

export default TextInputArea;
