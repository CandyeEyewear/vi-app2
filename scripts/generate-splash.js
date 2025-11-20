/**
 * Generate Splash Screen PNG from SVG
 * 
 * This script requires sharp to be installed:
 * npm install --save-dev sharp
 * 
 * Run: node scripts/generate-splash.js
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('❌ Error: sharp is not installed.');
  console.log('📦 Please install it first:');
  console.log('   npm install --save-dev sharp');
  console.log('\n📝 Or use an online converter:');
  console.log('   1. Open assets/splash.svg in a browser');
  console.log('   2. Use browser dev tools to export as PNG');
  console.log('   3. Save as assets/splash.png (1284x2778)');
  process.exit(1);
}

const svgPath = path.join(__dirname, '../assets/splash.svg');
const pngPath = path.join(__dirname, '../assets/splash.png');

// Read SVG
const svgBuffer = fs.readFileSync(svgPath);

// Convert to PNG
sharp(svgBuffer)
  .resize(1284, 2778, {
    fit: 'contain',
    background: { r: 33, g: 150, b: 243, alpha: 1 } // #2196F3
  })
  .png()
  .toFile(pngPath)
  .then(() => {
    console.log('✅ Splash screen generated successfully!');
    console.log(`📁 Saved to: ${pngPath}`);
    console.log('\n📱 Next steps:');
    console.log('   1. Run: npx expo prebuild --clean');
    console.log('   2. Test on device/simulator');
  })
  .catch((err) => {
    console.error('❌ Error generating splash screen:', err);
    console.log('\n📝 Alternative: Use an online SVG to PNG converter');
    console.log('   - Upload assets/splash.svg');
    console.log('   - Set size: 1284 x 2778');
    console.log('   - Download as assets/splash.png');
  });

