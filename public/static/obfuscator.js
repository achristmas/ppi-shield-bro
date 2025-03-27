const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

// Path to the build directory
const buildDir = path.join(__dirname, 'build', 'static', 'js');

// Obfuscate all JavaScript files in the build directory
fs.readdir(buildDir, (err, files) => {
  if (err) {
    console.error('Error reading build directory:', err);
    process.exit(1);
  }

  files.forEach((file) => {
    if (file.endsWith('.js')) {
      const filePath = path.join(buildDir, file);

      // Read the JavaScript file
      fs.readFile(filePath, 'utf8', (readErr, data) => {
        if (readErr) {
          console.error('Error reading file:', filePath, readErr);
          return;
        }

        // Obfuscate the JavaScript code
        const obfuscatedCode = JavaScriptObfuscator.obfuscate(data, {
          compact: true,
          controlFlowFlattening: true,
        }).getObfuscatedCode();

        // Write the obfuscated code back to the file
        fs.writeFile(filePath, obfuscatedCode, 'utf8', (writeErr) => {
          if (writeErr) {
            console.error('Error writing file:', filePath, writeErr);
          } else {
            console.log('Obfuscated:', filePath);
          }
        });
      });
    }
  });
});