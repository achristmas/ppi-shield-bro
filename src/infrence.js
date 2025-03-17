/** */
/*global BigInt */
/*global BigInt64Array */

import { loadTokenizer } from './bert_tokenizer.ts';
import * as wasmFeatureDetect from 'wasm-feature-detect';

//Setup onnxruntime 
const ort = require('onnxruntime-web');

//requires Cross-Origin-*-policy headers https://web.dev/coop-coep/
/**
const simdResolver = wasmFeatureDetect.simd().then(simdSupported => {
    console.log("simd is supported? "+ simdSupported);
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

const tokenizer = loadTokenizer()

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

async function infrenceStart(text){
let newSession = ort.InferenceSession.create(model2, options);
newSession.then(t => { 
  		downLoadingModel = false;
  		//warmup the VM
  		for(var i = 0; i < 1; i++) {
    			console.log("Inference warmup " + i);
    			   lm_inference_TokenClasification(text).then(t => {
                
				 //if contains 'XXXXX' then the document has PII data and notify the user
    				if (t.includes('XXXXX')) {
     				 alert("The document contains PII data. Please remove the data before uploading.");
    				}
      });  
		}
	});
   session = newSession; 
}  

async function lm_inference_TokenClasification(text) {
  try {
      // Store special characters' positions before cleaning
      const specialCharPositions = [];
      text.split('').forEach((char, index) => {
          if (!/[a-zA-Z0-9 ]/.test(char)) {
              specialCharPositions.push({ char, index });
          }
      });

      // Clean up text by removing special characters and extra spaces for BERT tokenization
      const cleanedText = text.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

      // Tokenize the cleaned text
      const encoded_ids = await tokenizer.then(t => t.tokenize(cleanedText));

      // Create the model input
      var model_input = create_model_input(encoded_ids);

      // Run the model token classification model
      var output = await session.then(s => s.run(model_input, ['output_0']));
      var numRows = output['output_0'].dims[1];
      var numCols = output['output_0'].dims[2];
      var tensorArray = output['output_0'].data;
      var reshapedArray = tensorArray.slice(0, numRows * numCols);

      // Get the highest value index for each row
      var myResults = [];
      for (var i = 0; i < numRows; i++) {
          var row = reshapedArray.slice(i * numCols, (i + 1) * numCols);
          myResults.push(argmax(row));
      }

      // Convert result indexes to labels
      const preds = myResults.map(i => tokenIndexObj[i]);

      // Tokenize words individually and align labels
      const words = cleanedText.split(' ');
      var offsetTokenArray = [];
      var offSetIndex = 1;
      for (var wordIndex = 0; wordIndex < words.length; wordIndex++) {
          const word = words[wordIndex];
          const encoded = await tokenizer.then(t => t.tokenize(word));
          for (var i = 0; i < encoded.length; i++) {
              offsetTokenArray.push({
                  wi: wordIndex,
                  token: encoded[i],
                  actual: word,
                  label: preds[offSetIndex],
                  tokenIndex: offSetIndex
              });
              offSetIndex++;
          }
      }

      // Restore special characters to their original positions
      var maskedArray = [];
      var charIndex = 0;
      words.forEach((word, i) => {
          while (specialCharPositions.length > 0 && specialCharPositions[0].index <= charIndex) {
              maskedArray.push(specialCharPositions.shift().char);
              charIndex++;
          }
          const firstToken = offsetTokenArray.find(t => t.wi === i);
          maskedArray.push(firstToken.label === 'O' ? firstToken.actual : `[${firstToken.label}]`);
          charIndex += word.length + 1; // Account for spaces
      });

      // Append any remaining special characters
      while (specialCharPositions.length > 0) {
          maskedArray.push(specialCharPositions.shift().char);
      }

      return maskedArray.join(' ');
  } catch (e) {
      alert(e);
  }
}

export let inference = lm_inference 
export let columnNames = EMOJI_DEFAULT_DISPLAY
export let modelDownloadInProgress = isDownloading
export let pii_inference = infrenceStart
