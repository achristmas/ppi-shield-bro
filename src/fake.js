/**
 * Mapping of PII types to faker.js functions
 * Ignores B- (beginning) and I- (inside) prefixes as they're positional indicators
 */

import { faker } from '@faker-js/faker';

// Helper function to create a fallback generator for unmapped PII types
function createFallbackGenerator(type) {
  return () => `[${type.replace(/^[BI]-/, '')}_${faker.string.alphanumeric(8)}]`;
}

// Main mapping object
const piiToFakerMapping = {
  // Personal Information
  "FIRSTNAME": () => faker.person.firstName(),
  "MIDDLENAME": () => faker.person.middleName(),
  "LASTNAME": () => faker.person.lastName(),
  "PREFIX": () => faker.person.prefix(),
  "AGE": () => faker.number.int({ min: 18, max: 90 }).toString(),
  "GENDER": () => faker.person.gender(),
  "SEX": () => faker.helpers.arrayElement(['Male', 'Female']),
  "DOB": () => faker.date.birthdate().toISOString().split('T')[0],
  "HEIGHT": () => `${faker.number.int({ min: 150, max: 200 })} cm`,
  "EYECOLOR": () => faker.helpers.arrayElement(['Blue', 'Brown', 'Green', 'Hazel', 'Gray']),
  
  // Contact & Address Information
  "EMAIL": () => faker.internet.email(),
  "PHONENUMBER": () => faker.phone.number(),
  "PHONEIMEI": () => faker.helpers.replaceSymbols('##-######-######-#'),
  "STREET": () => faker.location.street(),
  "BUILDINGNUMBER": () => faker.location.buildingNumber(),
  "SECONDARYADDRESS": () => faker.location.secondaryAddress(),
  "CITY": () => faker.location.city(),
  "COUNTY": () => faker.location.county(),
  "STATE": () => faker.location.state(),
  "ZIPCODE": () => faker.location.zipCode(),
  "ORDINALDIRECTION": () => faker.helpers.arrayElement(['North', 'South', 'East', 'West']),
  "NEARBYGPSCOORDINATE": () => `${faker.location.latitude()}, ${faker.location.longitude()}`,
  
  // Financial Information
  "ACCOUNTNUMBER": () => faker.finance.accountNumber(),
  "ACCOUNTNAME": () => faker.finance.accountName(),
  "CREDITCARDNUMBER": () => faker.finance.creditCardNumber(),
  "CREDITCARDISSUER": () => faker.finance.creditCardIssuer(),
  "CREDITCARDCVV": () => faker.finance.creditCardCVV(),
  "CURRENCY": () => faker.finance.currency().code,
  "CURRENCYCODE": () => faker.finance.currencyCode(),
  "CURRENCYSYMBOL": () => faker.finance.currencySymbol(),
  "CURRENCYNAME": () => faker.finance.currencyName(),
  "AMOUNT": () => faker.finance.amount(),
  "IBAN": () => faker.finance.iban(),
  "BIC": () => faker.finance.bic(),
  "PIN": () => faker.finance.pin(),
  
  // Crypto Addresses
  "BITCOINADDRESS": () => faker.finance.bitcoinAddress(),
  "ETHEREUMADDRESS": () => faker.finance.ethereumAddress(),
  "LITECOINADDRESS": () => createFallbackGenerator("LITECOINADDRESS")(), // No direct faker equivalent
  
  // Internet & Tech
  "USERNAME": () => faker.internet.userName(),
  "PASSWORD": () => faker.internet.password(),
  "URL": () => faker.internet.url(),
  "IPV4": () => faker.internet.ipv4(),
  "IPV6": () => faker.internet.ipv6(),
  "IP": () => faker.internet.ip(),
  "MAC": () => faker.internet.mac(),
  "USERAGENT": () => faker.internet.userAgent(),
  
  // Professional & Company
  "JOBTITLE": () => faker.person.jobTitle(),
  "JOBTYPE": () => faker.person.jobType(),
  "JOBAREA": () => faker.person.jobArea(),
  "COMPANYNAME": () => faker.company.name(),
  
  // Vehicles
  "VEHICLEVIN": () => faker.vehicle.vin(),
  "VEHICLEVRM": () => faker.vehicle.vrm(), // UK registration number
  
  // Time & Date
  "DATE": () => faker.date.recent().toISOString().split('T')[0],
  "TIME": () => faker.date.recent().toISOString().split('T')[1].substring(0, 8),
  
  // IDs & Documents
  "SSN": () => faker.finance.accountNumber(9),
  "MASKEDNUMBER": () => faker.helpers.replaceSymbols('###-##-####').replace(/[#]/g, '*'),
  
  // Other/Special Types
  "ORDINAL": () => faker.helpers.arrayElement(['1st', '2nd', '3rd', '4th', '5th']),
  "O": (original) => original, // Not PII, return as is
  
  // Default handler for unmapped types
  "DEFAULT": (original, type) => createFallbackGenerator(type)()
};

/**
 * Function to get the appropriate faker function for a given PII type
 * @param {string} tag - The PII type tag (including B- or I- prefix)
 * @returns {Function} - The appropriate faker function
 */
export function getFakerFunctionForTag(tag) {
  // Remove B- or I- prefix
  const type = tag.replace(/^[BI]-/, '');
  
  // Return the appropriate function or the default one
  return piiToFakerMapping[type] || piiToFakerMapping.DEFAULT;
}

/**
 * Usage example in the substitutePII function:
 */
function substitutePII(text, piiClassifications, options = {}) {
  // Sort classifications by start position
  const sortedClassifications = piiClassifications.sort((a, b) => a.start - b.start);
  
  // Implementation as before...
  
  for (const classification of sortedClassifications) {
    const { start, end, type, text: originalText } = classification;
    
    // Get the appropriate substitution strategy using our mapping
    const strategy = getFakerFunctionForTag(type) || piiToFakerMapping.DEFAULT;
    
    // Generate the substitution
    let replacement = strategy(originalText, type);
    
    // Rest of the implementation...
  }
}

// Export the mapping for use in other modules
export { piiToFakerMapping };