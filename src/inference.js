/** */
/*global BigInt */
/*global BigInt64Array */

//import { loadTokenizer } from './bert_tokenizer.ts';
import * as wasmFeatureDetect from 'wasm-feature-detect';
import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun, AlignmentType, Header, Footer, PageBreak, SectionType, ShadingType } from "docx";
import { saveAs } from "file-saver";
//import fake.js from './fake.js';
import { piiToFakerMapping, getFakerFunctionForTag } from './fake.js';
import { faker } from '@faker-js/faker';  
//Setup onnxruntime 
const ort = require('onnxruntime-web');

//requires Cross-Origin-*-policy headers https://web.dev/coop-coep/
/**
const simdResolver = wasmFeatureDetect.simd().then(simdSupported => {
    console.log("simd is sufpported? "+ simdSupported);
    if (simdSupported) {
      ort.env.wasm.numThreads = 3; 
      ort.env.wasm.simd = true;
    } else {
      ort.env.wasm.numThreads = 1; 
      ort.env.wasm.simd = false;
    }
});
*/

const options = {
  executionProviders: ['wasm'], 
  graphOptimizationLevel: 'all'
};

var downLoadingModel = true;
const model = "./xtremedistill-go-emotion-int8.onnx";
const model2 = "./classifier_int8.onnx";

let session = ort.InferenceSession.create(model2, options);

session.then(t => { 
  downLoadingModel = false;
  //warmup the VM
  for(var i = 0; i < 1; i++) {
    console.log("Inference warmup " + i);
    lm_inference_TokenClasification("yo yo this is a warmup inference");
  }
});



const EMOJI_DEFAULT_DISPLAY = [
  ["Emotion", "Score"],
  ['admiration ',0],
  ['amusement ', 0],
  ['neutral ��',0],
  ['approval',0],
  ['joy',0],
  ['gratitude',0],
];

var tokenIndexObj = ['O', 'B-PHONEIMEI', 'I-PHONEIMEI', 'B-JOBAREA', 'I-JOBAREA', 'B-FIRSTNAME', 'B-VEHICLEVIN', 'I-VEHICLEVIN', 'I-FIRSTNAME', 'B-AGE', 'B-AGE', 'B-GENDER', 'I-GENDER', 'B-HEIGHT', 'I-HEIGHT', 'B-BUILDINGNUMBER', 'I-BUILDINGNUMBER', 'B-MASKEDNUMBER', 'I-MASKEDNUMBER', 'B-PASSWORD', 'I-PASSWORD', 'B-DOB', 'I-DOB', 'B-IPV6', 'I-IPV6', 'B-NEARBYGPSCOORDINATE', 'I-NEARBYGPSCOORDINATE', 'B-USERAGENT', 'I-USERAGENT', 'B-TIME', 'I-TIME', 'B-JOBTITLE', 'I-JOBTITLE', 'B-COUNTY', 'B-EMAIL', 'I-EMAIL', 'B-ACCOUNTNUMBER', 'I-ACCOUNTNUMBER', 'B-PIN', 'I-PIN', 'B-EYECOLOR', 'I-EYECOLOR', 'B-LASTNAME', 'I-LASTNAME', 'B-IPV4', 'I-IPV4', 'B-DATE', 'I-DATE', 'B-STREET', 'I-STREET', 'B-CITY', 'I-CITY', 'B-PREFIX', 'I-PREFIX', 'B-MIDDLENAME', 'B-CREDITCARDISSUER', 'B-CREDITCARDNUMBER', 'I-CREDITCARDNUMBER', 'I-CREDITCARDISSUER', 'B-STATE', 'B-VEHICLEVRM', 'I-VEHICLEVRM', 'B-ORDINALDIRECTION','B-SEX', 'B-JOBTYPE', 'I-JOBTYPE', 'B-CURRENCYCODE', 'I-CURRENCYCODE', 'B-CURRENCYSYMBOL', 'B-AMOUNT', 'I-AMOUNT', 'B-ACCOUNTNAME', 'I-ACCOUNTNAME', 'I-STATE', 'B-BITCOINADDRESS', 'I-BITCOINADDRESS', 'B-LITECOINADDRESS', 'I-LITECOINADDRESS', 'B-PHONENUMBER', 'I-PHONENUMBER', 'B-MAC', 'I-MAC', 'B-CURRENCY', 'B-IBAN', 'I-IBAN', 'B-COMPANYNAME', 'I-COMPANYNAME', 'B-CURRENCYNAME', 'I-CURRENCYNAME', 'I-CURRENCYSYMBOL', 'B-ZIPCODE', 'I-ZIPCODE', 'B-SSN', 'I-SSN', 'I-CURRENCY', 'B-URL', 'I-URL', 'B-IP', 'I-IP', 'B-SECONDARYADDRESS', 'I-SECONDARYADDRESS', 'B-USERNAME', 'I-USERNAME', 'B-ETHEREUMADDRESS', 'I-ETHEREUMADDRESS', 'B-CREDITCARDCVV', 'I-AGE', 'I-MIDDLENAME', 'I-COUNTY', 'B-BIC', 'I-BIC', 'I-CREDITCARDCVV', 'I-ORDINAL','I-SEX', 'O']

var sanatization_sub_keys = new Array();


function labelToIds(label) {
    const ids = new Array(label.length);
    for (var i = 0; i < label.length; i++) {
        ids[i] = 0;
    }
return ids;
}
//create array of int values based on the property index
var labelToIdsArray = labelToIds(tokenIndexObj);
function isDownloading() {
  return downLoadingModel;
}

function sortResult(a, b) {
  if (a[1] === b[1]) {
      return 0;
  }
  else {
      return (a[1] < b[1]) ? 1 : -1;
  }
}

function sigmoid(t) {
  return 1/(1+Math.pow(Math.E, -t));
}
//softmax function
function softmax(arr) {
    return arr.map(function (value, index) {
        return Math.exp(value) / arr.map(function (y) { return Math.exp(y); }).reduce(function (a, b) { return a + b; });
    });
}
//functin to return the highest value of the array
function argmax(arr) {
    return arr.indexOf(Math.max(...arr));
}
function create_model_input(encoded) {
  var input_ids = new Array(encoded.length+2);
  var attention_mask = new Array(encoded.length+2);
  var token_type_ids = new Array(encoded.length+2);
  input_ids[0]= BigInt(101);
  attention_mask[0]= BigInt(1);
  token_type_ids[0]= BigInt(0);
  var i = 0;
  for(; i < encoded.length; i++) { 
    input_ids[i+1] = BigInt(encoded[i]);
    attention_mask[i+1] = BigInt(1);
    token_type_ids[i+1] = BigInt(0);
  }
  input_ids[i+1]= BigInt(102);
  attention_mask[i+1]= BigInt(1);
  token_type_ids[i+1]= BigInt(0);
  const sequence_length = input_ids.length;
  input_ids = new ort.Tensor('int64', BigInt64Array.from(input_ids), [1,sequence_length]);
  attention_mask = new ort.Tensor('int64', BigInt64Array.from(attention_mask), [1,sequence_length]);
  //token_type_ids = new ort.Tensor('int64', BigInt64Array.from(token_type_ids), [1,sequence_length]);
  return {
    input_ids: input_ids,
    attention_mask: attention_mask,
    //token_type_ids:token_type_ids
  }
}

async function lm_inference(text) {
  try { 
    const encoded_ids = await tokenizer.then(t => {
      return t.tokenize(text); 
    });
    if(encoded_ids.length === 0) {
      return [0.0, EMOJI_DEFAULT_DISPLAY];
    }
    const start = performance.now();
    const model_input = create_model_input(encoded_ids);
    const output =  await session.then(s => { return s.run(model_input,['output_0'])});
    const duration = (performance.now() - start).toFixed(1);
    const active_logits = output.view(-1, tokenIndexObj.length);
    const flattened_perdictions = active_logits.argmax(-1);
    return [0.0,EMOJI_DEFAULT_DISPLAY];
  } catch (e) {
    return [0.0,EMOJI_DEFAULT_DISPLAY];
  }
}
async function initializeSession() {
  if (!session) {
    session = await ort.InferenceSession.create(model2, options);
  }
} 

function removeNoFilesUploadedRow() {
  const table = document.getElementById('resultsTable');
  const rows = table.getElementsByTagName('tr');
  if (rows.length === 2) {
    const cells = rows[1].getElementsByTagName('td');
    if (cells.length === 1 && cells[0].textContent.indexOf('No files uploaded yet') > -1) {
      table.deleteRow(1);
    }
  }
}


async function infrenceStart(text, fileName="file.docx") {
  // Create a notification that PII inference is about to start in a visually pleasing way
  const notification = document.createElement('div');
  
  notification.className = 'notification';
  notification.textContent = 'PII Inference is starting...';


  Object.assign(notification.style, {
    backgroundColor: '#333',
    color: '#fff',
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
        //if the notification is already present remove it
        try {
          document.body.removeChild(existingNotifications[i]);
        }
        catch (e) {
          console.log("Error removing existing notification: ", e);
        }
      ;
      }
      document.body.appendChild(notification);

  try {
    await initializeSession();
    downLoadingModel = false;

    // Warm up the VM
    for (var i = 0; i < 1; i++) {
      console.log("Inference warmup " + i);
      return lm_inference_TokenClasification(text, fileName).then((processedText) => {
        // Properly decode HTML entities in the processed text
        const decodeHTMLEntities = (text) => {
          const textarea = document.createElement('textarea');
          textarea.innerHTML = text;
          return textarea.value;
        };

        // Clean up PII labels for better HTML compatibility
        const cleanProcessedText = (text) => {
          // Convert PII markers to HTML-safe format
          return text.replace(/\[(B|I)-([^\]]+)\]/g, '<span class="pii-marker" data-pii-type="$2">[$1-$2]</span>');
        };

        // Process the text with proper HTML handling
        const htmlSafeText = decodeHTMLEntities(processedText.processedText);
        const formattedText = cleanProcessedText(htmlSafeText);

        // Extract PII information for reporting
        const piiLabels = tokenIndexObj.filter(label => label.startsWith('B-') || label.startsWith('I-'));
        const piiCount = (processedText.processedText.match(/\[B-.*?\]/g) || []).length;
        const piiTypesArray = (processedText.processedText.match(/\[B-.*?\]/g) || []).map(label =>
          label.replace(/\[B-|\]/g, '')
        );
        const piiTypes = new Set(piiTypesArray);

        // Find the existing row for the file
        const table = document.getElementById('resultsTable');
        const rows = table.getElementsByTagName('tr');
        let targetRow = null;
        for (let row of rows) {
          if (row.cells[0] && row.cells[0].textContent === fileName) {
            targetRow = row;
            break;
          }
        }

        // if (targetRow) {
        //   const piiCell = targetRow.cells[1];
        //   const sanitizedCell = targetRow.cells[2];

        //   // Update the PII cell and sanitized cell
        //   if (piiTypes.size >= 1) {
        //     const piiTypesList = Array.from(piiTypes).join(', ');
        //     piiCell.innerHTML = `Contains <strong>${piiCount}</strong> PII Elements of: <strong>${piiTypes.size}</strong> types<br><small>(${piiTypesList})</small>`;
        //     piiCell.className = 'pii';
        //     sanitizedCell.innerHTML = processedText ? 'Yes' : 'No';
        //     sanitizedCell.className = processedText ? 'success' : 'default';
        //   } else {
        //     piiCell.textContent = 'No PII Found';
        //     sanitizedCell.textContent = 'No';
        //     sanitizedCell.className = 'default';
        //   }

        //   // Post a message to the sender of the message with the results
        //   window.postMessage({ type: 'PII_INFERENCE_RESULT', fileName: fileName, piiCount: piiCount, content: formattedText }, '*');
        // }

        // Return the sanitized text
        return {
          pt: processedText.processedText,
          sr: processedText.syntheticReplacementText,
          pw: processedText.processedWords,
          html: processedText.finalText,
          subHTML: processedText.finalSubstitutionText,
        };
      }).catch(error => {
        console.log('Error during token classification:', error);
        // Show error in UI
        const table = document.getElementById('resultsTable');
        const rows = table.getElementsByTagName('tr');
        let targetRow = null;
        for (let row of rows) {
          if (row.cells[0] && row.cells[0].textContent === fileName) {
            targetRow = row;
            break;
          }
        }
        if (targetRow) {
          const errorCell = targetRow.cells[1];
          errorCell.textContent = 'Error processing file';
          errorCell.className = 'error';
          targetRow.cells[2].textContent = '';
        }
      });
    }
  } catch (e) {
    console.log(e);
  }
}  

var cuiDI_String = "";



//function to export the html content to a word document with the CUI designator and footer
async function exportHTML(fileInput, cuiDesignatorText = "",orgName="",dist) {
  // CUI Designator Block (Now in Footer)
  const cuiFooterContent = new Paragraph({
      children: [
          new TextRun({ text: "Controlled by: [Your Organization]", bold: true }),
          new TextRun({ break: 1, text: "CUI Category(ies): [Category]" }),
          new TextRun({ break: 1, text: "LDC or Distribution Statement: [LDC]" }),
          new TextRun({ break: 1, text: "POC: [Point of Contact]" })
      ],
      alignment: AlignmentType.RIGHT
  });

  // Title Page with CUI Warning (Purple container spans full page width)
  const titlePage = [
      new Paragraph({
          children: [
              new TextRun({ text: "CUI", bold: true, size: 48, color: "FFFFFF" }),
          ],
          alignment: AlignmentType.CENTER,
          shading: { type: ShadingType.CLEAR, color: "4B0082", fill: "4B0082" },
          spacing: { after: 0 }
      }),
      new Paragraph({
          children: [
              new TextRun({ text: "ATTENTION", bold: true, size: 32, color: "FFFFFF" }),
          ],
          alignment: AlignmentType.CENTER,
          shading: { type: ShadingType.CLEAR, color: "4B0082", fill: "4B0082" },
          spacing: { after: 0 }
      }),
      new Paragraph({
          children: [
              new TextRun({
                  text: "All individuals handling this information are required to protect it from unauthorized disclosure.",
                  color: "FFFFFF"
              }),
              new TextRun({ break: 1, text: "Handling, storage, reproduction, and disposition must follow 32 CFR Part 2002.", color: "FFFFFF" }),
          ],
          alignment: AlignmentType.CENTER,
          shading: { type: ShadingType.CLEAR, color: "4B0082", fill: "4B0082" },
          spacing: { after: 0 }
      }),
      new Paragraph({
          children: [
              new TextRun({ text: "Standard Form 901 (11-18) | Prescribed by GSA/ISOO | 32 CFR 2002", italics: true, color: "FFFFFF" }),
          ],
          alignment: AlignmentType.CENTER,
          shading: { type: ShadingType.CLEAR, color: "4B0082", fill: "4B0082" },
          spacing: { after: 0 }
      }),
      new Paragraph({
          children: [],
          shading: { type: ShadingType.CLEAR, color: "4B0082", fill: "4B0082" },
          pageBreakBefore: true
      })
  ];


  // Header and Footer
  const header = new Header({
      children: [
          new Paragraph({
              children: [new TextRun({ text: "CONTROLLED UNCLASSIFIED INFORMATION (CUI)", bold: true })],
              alignment: AlignmentType.CENTER
          })
      ]
  });

  const footer = new Footer({
      children: [cuiFooterContent]
  });

  // Parse HTML content into Paragraph objects
  const parser = new DOMParser();
  var fi = await fileInput.unalteratedText;
  const htmlDoc = parser.parseFromString(fi, 'text/html');
  const elements = htmlDoc.body.childNodes;
  const mainContent = [];

  elements.forEach(element => {
      if (element.nodeType === Node.ELEMENT_NODE) {
          const textRuns = [];
          element.childNodes.forEach(child => {
              if (child.nodeType === Node.TEXT_NODE) {
                  textRuns.push(new TextRun({ text: child.textContent }));
              } else if (child.nodeType === Node.ELEMENT_NODE) {
                  switch (child.tagName.toLowerCase()) {
                      case 'strong':
                          textRuns.push(new TextRun({ text: child.textContent, bold: true }));
                          break;
                      case 'br':
                          textRuns.push(new TextRun({ break: 1 }));
                          break;
                      case 'tab':
                          textRuns.push(new TextRun({ text: "\t" }));
                          break;
                      default:
                          textRuns.push(new TextRun({ text: child.textContent }));
                  }
              }
          });

          switch (element.tagName.toLowerCase()) {
              case 'p':
                  mainContent.push(new Paragraph({ children: textRuns }));
                  break;
              case 'h1':
                  mainContent.push(new Paragraph({ children: [new TextRun({ text: element.textContent, bold: true, size: 48 })] }));
                  break;
              case 'h2':
                  mainContent.push(new Paragraph({ children: [new TextRun({ text: element.textContent, bold: true, size: 32 })] }));
                  break;
              default:
                  mainContent.push(new Paragraph({ children: textRuns }));
          }
      }
  });

  // Create the Document
  const doc = new Document({
      sections: [
          {
              properties: { type: SectionType.CONTINUOUS },
              headers: { default: header },
              footers: { default: footer },
              children: titlePage
          },
          {
              properties: { type: SectionType.CONTINUOUS },
              headers: { default: header },
              footers: { default: footer },
              children: mainContent
          }
      ]
  });

  // Generate and Download Word File
  Packer.toBlob(doc).then(async blob => {
    var blow = await fileInput.filename
      saveAs(blob, `${blow}.docx`);
  });
}

async function loadMammothScript(){
 
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.4.2/mammoth.browser.min.js";
    script.id = "mammothScript";
    script.async = true;
    document.body.appendChild(script);
  
}

//on load run the loadMammothScript function
window.onload = loadMammothScript;


async function lm_inference_TokenClasification(text,fileName="dummy") {


  try {
    
    //sub and in for &amp; cause it loose its shit on that char
    text = text.replace(/&amp;/g,"and");
    //nomralize spacing so everything has a single space
    //text = text.replace(/\s+/g, ' ');
    
    //split html from special character from words and store them in an array
    var word = []
    var htmlTags = []
    var specialChars = []
  // get the start and end position of the html tags
    var htmlTagPattern = /<[^>]*>/g;
    let matchme;
    while ((matchme = htmlTagPattern.exec(text)) !== null) {
      htmlTags.push({
        content: matchme[0],
        startPos: matchme.index,
        endPos: matchme.index + matchme[0].length,
        type: 'html'
      });
    }
    // Get the start and end position of special characters that are not within HTML tags
    var specialCharMap2 = new Map();

    // First, create a map to quickly check if a position is inside an HTML tag
    const isInHtmlTag = new Array(text.length).fill(false);
    for (const tag of htmlTags) {
      for (let pos = tag.startPos; pos < tag.endPos; pos++) {
        isInHtmlTag[pos] = true;
      }
    }

    // Now identify special characters that aren't part of HTML tags
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      // Skip if this position is inside an HTML tag
      if (isInHtmlTag[i]) {
        continue;
      }
      
      // Check if it's a special character (not alphanumeric and not a space)
      if (!/[a-zA-Z0-9 ]/.test(char)) {
        specialCharMap2.set(i, {
          content: char,
          originalIndex: i,
          type: 'special',
          startPos: i,
          endPos: i + 1  // Fixed: end position should be start + 1
        });
      }
    }
   // Collect words in the text with their start and end positions, excluding HTML tags
  var wordPattern = /\b(?!(?:[^<>]*>))([a-zA-Z0-9]+)\b/g;
  let matchWord;
  var wordIndex = 0;
  while ((matchWord = wordPattern.exec(text)) !== null) {
    word.push({
      content: matchWord[1],
      startPos: matchWord.index,
      endPos: matchWord.index + matchWord[1].length,
      type: 'word',
      index: wordIndex++
    });
  }
  htmlTags = htmlTags.concat(Array.from(specialCharMap2.values()));
    //merge the arrays into one array
    var mergedElements = htmlTags.concat(word);
    
   

    
    
    //clean the text of html ans special characters
    const cleanText = text.replace(/<[^>]*>/g, '').replace(/[^a-zA-Z0-9 ]/g, ' '); 
    
   
    // Create a version of text without special chars for tokenization
    const textForTokenization = cleanText.replace(/\s+/g, ' ').trim();
    
    // Split cleaned text into chunks (50 words per chunk)
    const chunkSize = 50;
    const words = textForTokenization.split(' ');
    const wordChunks = [];
    
    for (let i = 0; i < words.length; i += chunkSize) {
      wordChunks.push(words.slice(i, i + chunkSize).join(' '));
    }
    
    // Process each chunk
    let processedText = '';
    let currentWordIndex = 0;
    // synthetic replacement text
    let syntheticReplacementText = '';
    
    for (let chunkIndex = 0; chunkIndex < wordChunks.length; chunkIndex++) {
      //update the notification to show the progress of the infrence
      //clear the existing notification and write a new one
      const notification = document.createElement('div');
      notification.className = 'notification';
      notification.textContent = `PII Inference is ${Math.round((chunkIndex + 1) / wordChunks.length * 100)}% complete...`;
      Object.assign(notification.style, {
        backgroundColor: '#333',
        color: '#fff',
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
        try{
           document.body.removeChild(existingNotifications[i]);
        }catch (e) {
          console.log("Error removing existing notification: ", e);
        }
      }
      document.body.appendChild(notification);

      await new Promise((resolve) => setTimeout(resolve, 500));
    
      const chunk = wordChunks[chunkIndex];
      
      // Tokenize the chunk
      const encoded_ids = Mytokenizer.encode(chunk);
      
      // Create the model input
      const model_input = create_model_input(encoded_ids);
      
      // Run the model token classification
      const s = await session;
      const output = await s.run(model_input, ['output_0']);
      
      // Extract and reshape output tensor
      const numRows = output['output_0'].dims[1];
      const numCols = output['output_0'].dims[2];
      const tensorArray = output['output_0'].data;
      const reshapedArray = tensorArray.slice(0, numRows * numCols);
      
      // Get the highest probability class for each token
      const predictions = [];
      for (let i = 0; i < numRows; i++) {
        const row = reshapedArray.slice(i * numCols, (i + 1) * numCols);
        predictions.push(argmax(row));
      }
      
      // Convert result indices to labels
      const predictionLabels = predictions.map(i => tokenIndexObj[i]);
      
      // Process each word in the chunk with its corresponding label
      const chunkWords = chunk.split(' ');
      let wordToLabelMap = new Map();
      
      
      //validate that if a credit card number label is found that it is followed by another credit card number label
      //if not change the label to 'O'
      for (let i = 0; i < predictionLabels.length; i++) {
        //replace the label with 'O' if the next label is not a credit card number for B-CREDITCARDNUMBER
        if (predictionLabels[i] === 'B-CREDITCARDNUMBER') {
          if (predictionLabels[i + 1] !== 'I-CREDITCARDNUMBER') {
            predictionLabels[i] = 'O';
          }
        }
        //replace the label with 'O' if the next label is not a credit card number for I-CREDITCARDNUMBER
        if (predictionLabels[i] === 'I-CREDITCARDNUMBER') {
          if (predictionLabels[i + 1] !== 'I-CREDITCARDNUMBER') {
            predictionLabels[i] = 'O';
          }
        }
      }


      
      // Build a mapping of words to labels
      let tokenIndex = 1; // Start at 1 to skip CLS token
      for (let wordIdx = 0; wordIdx < chunkWords.length; wordIdx++) {
        const word = chunkWords[wordIdx];
        if (!word) continue;
        
        const wordTokens = Mytokenizer.encode(word);
        const wordLabel = predictionLabels[tokenIndex]; // Use first token's label for the word
        
        wordToLabelMap.set(currentWordIndex + wordIdx, {
          word: word,
          label: wordLabel
        });
        
        // Advance token index by the number of tokens in this word
        tokenIndex += wordTokens.length;
      }
      
      // Build the processed text for this chunk
      let chunkProcessedText = '';
      //Build synthetic rplacement chunk too
      let chunkSyntheticReplacement = '';
      
      for (let i = 0; i < chunkWords.length; i++) {
        const wordInfo = wordToLabelMap.get(currentWordIndex + i);
        if (!wordInfo) continue;

        
        
        // Apply PII masking if needed
        if (wordInfo.label !== 'O') {
          chunkProcessedText += `[${wordInfo.label}] `;
           //check to see if the word is present for the file name with the same label in sanatization_sub_keys if so use that replacment as the synthetic replacement
           var found = sanatization_sub_keys.find(obj => obj.fName === fileName && obj.original === wordInfo.word && obj.type === wordInfo.label);
           if (found) {
             chunkSyntheticReplacement += `${found.replacement} `;
           }else {
 
 
             var replacementFunction = getFakerFunctionForTag(wordInfo.label);
             var anonymizedText = replacementFunction(wordInfo.word);
             //update the sanatization_sub_keys with object that show the original word and the replacement
             sanatization_sub_keys.push({ fName:fileName, original: wordInfo.word, replacement: anonymizedText, type: wordInfo.label });
             //add the anonymized text to the synthetic replacement
             chunkSyntheticReplacement += `${anonymizedText} `;
           }
        } else {
          chunkProcessedText += `${wordInfo.word} `;
          chunkSyntheticReplacement += `${wordInfo.word} `; // Keep the original word for non-PII
         
        }
      }
      syntheticReplacementText += chunkSyntheticReplacement;
      processedText += chunkProcessedText;
      currentWordIndex += chunkWords.length;
    }
    
    // Trim the processed text and split into words
    processedText = processedText.trim();
    const processedWords = processedText.split(' ');
    const processedSubstitutionWords = syntheticReplacementText.split(' ');
    syntheticReplacementText = syntheticReplacementText.trim();

    //order the orginalMerge array by startPos
    mergedElements.sort((a, b) => a.startPos - b.startPos);

    //use the orginalMerge array to reinsert the special elements at their original positions
    let finalText = '';
    let finalSubstitutionText = '';
    let currentPos = 0;
    let wordIdx = 0;
    for (let i = 0; i < mergedElements.length; i++) {
      // Get current element
      const element = mergedElements[i];
      
      // Check if there's a gap between the current position and the start of this element
      if (element.startPos > currentPos) {
        // Add appropriate spacing based on the gap
        finalText += ' '.repeat(Math.min(element.startPos - currentPos, 1));
        finalSubstitutionText += ' '.repeat(Math.min(element.startPos - currentPos, 1));
      }
      
      // Process element based on type
      if (element.type === 'html' || element.type === 'special') {
        // Handle special case for &amp;
        if (element.content === 'amp;') {
          finalText += '&';
          finalSubstitutionText += '&';
        } else {
          finalText += element.content;
          finalSubstitutionText += element.content;
        }
      } else {
        // It's a word - replace with processed version
        finalText += processedWords[wordIdx];
        finalSubstitutionText += processedSubstitutionWords[wordIdx];
        wordIdx++;
      }
      
      // Update current position to the end of this element
      currentPos = element.endPos;
    }

    
    const completionNotification = document.createElement('div');
    completionNotification.className = 'notification';
    completionNotification.textContent = 'PII Inference is complete!';
   
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

    return {finalText , processedText, syntheticReplacementText, processedWords,finalSubstitutionText};
  } catch (error) {
    console.error('Error in token classification:', error);
    throw new Error(`Token classification failed: ${error.message}`);
  }
}

// Basic BERT Tokenizer in JavaScript
class BertTokenizer {
  constructor(vocab) {
    this.vocab = vocab;
    this.invVocab = Object.entries(vocab).reduce((acc, [k, v]) => { acc[v] = k; return acc; }, {});
  }

  tokenize(text) {
    let tokens = this.basicTokenize(text);
    return tokens.flatMap(token => this.wordpieceTokenize(token));
  }

  basicTokenize(text) {
    text = text.toLowerCase();
    text = text.replace(/\./g, ' . ');
    text = text.replace(/,/g, ' , ');
    text = text.replace(/!/g, ' ! ');
    text = text.replace(/\?/g, ' ? ');
    text = text.replace(/\(/g, ' ( ');
    text = text.replace(/\)/g, ' ) ');
    text = text.replace(/\s+/g, ' ').trim();
    return text.split(' ');
  }

  wordpieceTokenize(word) {
    if (this.vocab[word]) return [word];

    let subwords = [];
    let start = 0;
    while (start < word.length) {
      let end = word.length;
      let subword = null;
      while (start < end) {
        let candidate = (start === 0 ? '' : '##') + word.slice(start, end);
        if (this.vocab[candidate] !== undefined) {
          subword = candidate;
          break;
        }
        end -= 1;
      }
      if (subword === null) return ['[UNK]'];
      subwords.push(subword);
      start = end;
    }
    return subwords;
  }

  encode(text) {
    const tokens = this.tokenize(text);
    return tokens.map(token => this.vocab[token] ?? this.vocab['[UNK]']);
  }
}

// Load the BERT vocab file
async function loadVocab() {
  const response = await fetch('/static/distilbert_vocab.json');
  const vocab = await response.json();
  return  new BertTokenizer(vocab);

}

let Mytokenizer;
(async () => {
  Mytokenizer = await loadVocab();
})();
const tokenizer = Mytokenizer

const TurndownService = require('turndown').default; 

async function convertHtmlToMarkdown(file,useSubstitutions = false) {
    const turndownService = new TurndownService();
    if(useSubstitutions){
      const fileSubstitutions = await file.substituionText;
      return turndownService.turndown(fileSubstitutions);
    }else{
    const fileContentFool = await file.html; // Await the promise if file is a promise
  
    return turndownService.turndown(fileContentFool);
    }
}



export let inference = lm_inference 
export let columnNames = EMOJI_DEFAULT_DISPLAY
export let modelDownloadInProgress = isDownloading
export let pii_inference = infrenceStart
export { removeNoFilesUploadedRow ,exportHTML, convertHtmlToMarkdown, loadMammothScript, lm_inference_TokenClasification, initializeSession };
