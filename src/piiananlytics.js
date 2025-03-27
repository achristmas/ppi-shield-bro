const piiCategoryMapping = {
    "O": "NA",
    "B-PHONEIMEI": "moderate",
    "I-PHONEIMEI": "moderate",
    "B-JOBAREA": "low",
    "I-JOBAREA": "low",
    "B-FIRSTNAME": "low",
    "I-FIRSTNAME": "low",
    "B-VEHICLEVIN": "moderate",
    "I-VEHICLEVIN": "moderate",
    "B-AGE": "low",
    "I-AGE": "low",
    "B-GENDER": "low",
    "I-GENDER": "low",
    "B-HEIGHT": "low",
    "I-HEIGHT": "low",
    "B-BUILDINGNUMBER": "low",
    "I-BUILDINGNUMBER": "low",
    "B-MASKEDNUMBER": "low",
    "I-MASKEDNUMBER": "low",
    "B-PASSWORD": "high",
    "I-PASSWORD": "high",
    "B-DOB": "moderate",
    "I-DOB": "moderate",
    "B-IPV6": "moderate",
    "I-IPV6": "moderate",
    "B-NEARBYGPSCOORDINATE": "moderate",
    "I-NEARBYGPSCOORDINATE": "moderate",
    "B-USERAGENT": "low",
    "I-USERAGENT": "low",
    "B-TIME": "low",
    "I-TIME": "low",
    "B-JOBTITLE": "low",
    "I-JOBTITLE": "low",
    "B-COUNTY": "low",
    "I-COUNTY": "low",
    "B-EMAIL": "moderate",
    "I-EMAIL": "moderate",
    "B-ACCOUNTNUMBER": "high",
    "I-ACCOUNTNUMBER": "high",
    "B-PIN": "high",
    "I-PIN": "high",
    "B-EYECOLOR": "low",
    "I-EYECOLOR": "low",
    "B-LASTNAME": "low",
    "I-LASTNAME": "low",
    "B-IPV4": "moderate",
    "I-IPV4": "moderate",
    "B-DATE": "low",
    "I-DATE": "low",
    "B-STREET": "low",
    "I-STREET": "low",
    "B-CITY": "low",
    "I-CITY": "low",
    "B-PREFIX": "low",
    "I-PREFIX": "low",
    "B-MIDDLENAME": "low",
    "I-MIDDLENAME": "low",
    "B-CREDITCARDISSUER": "low",
    "I-CREDITCARDISSUER": "low",
    "B-CREDITCARDNUMBER": "high",
    "I-CREDITCARDNUMBER": "high",
    "B-STATE": "low",
    "I-STATE": "low",
    "B-VEHICLEVRM": "moderate",
    "I-VEHICLEVRM": "moderate",
    "B-ORDINALDIRECTION": "low",
    "I-ORDINALDIRECTION": "low",
    "B-SEX": "low",
    "I-SEX": "low",
    "B-JOBTYPE": "low",
    "I-JOBTYPE": "low",
    "B-CURRENCYCODE": "low",
    "I-CURRENCYCODE": "low",
    "B-CURRENCYSYMBOL": "low",
    "I-CURRENCYSYMBOL": "low",
    "B-AMOUNT": "low",
    "I-AMOUNT": "low",
    "B-ACCOUNTNAME": "low",
    "I-ACCOUNTNAME": "low",
    "B-BITCOINADDRESS": "moderate",
    "I-BITCOINADDRESS": "moderate",
    "B-LITECOINADDRESS": "moderate",
    "I-LITECOINADDRESS": "moderate",
    "B-PHONENUMBER": "moderate",
    "I-PHONENUMBER": "moderate",
    "B-MAC": "moderate",
    "I-MAC": "moderate",
    "B-CURRENCY": "low",
    "I-CURRENCY": "low",
    "B-IBAN": "high",
    "I-IBAN": "high",
    "B-COMPANYNAME": "low",
    "I-COMPANYNAME": "low",
    "B-CURRENCYNAME": "low",
    "I-CURRENCYNAME": "low",
    "B-ZIPCODE": "low",
    "I-ZIPCODE": "low",
    "B-SSN": "high",
    "I-SSN": "high",
    "B-URL": "low",
    "I-URL": "low",
    "B-IP": "moderate",
    "I-IP": "moderate",
    "B-SECONDARYADDRESS": "low",
    "I-SECONDARYADDRESS": "low",
    "B-USERNAME": "moderate",
    "I-USERNAME": "moderate",
    "B-ETHEREUMADDRESS": "moderate",
    "I-ETHEREUMADDRESS": "moderate",
    "B-CREDITCARDCVV": "high",
    "I-CREDITCARDCVV": "high",
    "B-BIC": "low",
    "I-BIC": "low"
  }

  //fuction that returns the count of labels by key based on an input string
  async function getLabelCount(inputString) {
    //split the input string into labels based on whitespace
    const labelsandWords = await inputString.split(' ');
    const labelCount = {};
    for (var labelWord of labelsandWords) {
        //validate the labelWord is enclosed by the brackets
        labelWord = labelWord.trim(); // remove any leading or trailing whitespace
        if (labelWord.startsWith('[') && labelWord.endsWith(']')) {
            labelWord = labelWord.slice(1, -1); // remove the brackets
            //get the category for the label and increment the count
            const category = getPiiCategory(labelWord); // get the category for the label
            
            if (labelCount[labelWord]) {
                labelCount[labelWord]++; // increment the count for the category
            } else {
                labelCount[labelWord] = 1; // initialize the count for the category
            }
        }
    }
    return labelCount; // return the count object
  }

  // function to get the pii category for a given label
  function getPiiCategory(label) {
    label = label.trim(); // remove any leading or trailing whitespace
    //check to see if the label is enclosed in brackets and remove them
    if (label.startsWith('[') && label.endsWith(']')) {
        label = label.slice(1, -1);
            return piiCategoryMapping[label] || "unknown";
    }else {
        return piiCategoryMapping[label] || "NA"; // return "NA" if the label is not PII
    }
  }
  //cuntion to provide a high risk count based on a a input string 
   async function getHighRiskCount(inputString) {
        const labels = await inputString.split(' ');
        let highRiskCount = 0;
        for (const label of labels) {
        if (getPiiCategory(label) == "high") {
            highRiskCount++;
        }
        }
        return highRiskCount;
    }


    // function to provide a moderate risk count based on a a input string
    async function getModerateRiskCount(inputString) {
        const labels = await inputString.split(' ');
        let moderateRiskCount = 0;
        for (const label of labels) {
        if (getPiiCategory(label) == "moderate") {
            moderateRiskCount++;
        }
        }
        return moderateRiskCount;
    }
    // function to provide a low risk count based on a a input string
    async function getLowRiskCount(inputString) {

        //if any char \[ or \] is present in the input string, replace it with the appropriate label [ or ] removing the escape character
        inputString = inputString.replace(/\\\[/g, '[').replace(/\\\]/g, ']');
        const labels = await inputString.split(' ');
        let lowRiskCount = 0;
        for (const label of labels) {
        if (getPiiCategory(label) == "low") {
            lowRiskCount++;
        }
        }
        return lowRiskCount;
    }

    // export the functions for use in other modules
    module.exports = {
        getPiiCategory,
        getHighRiskCount,
        getModerateRiskCount,
        getLowRiskCount,
        getLabelCount
    };
