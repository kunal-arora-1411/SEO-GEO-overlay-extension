const fs = require('fs');
const path = require('path');

// Minimal valid PNG (1x1 transparent pixel)
// This is a base64-encoded minimal valid PNG
const MINIMAL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  'base64'
);

const iconsDir = path.join(__dirname, '..', 'extension', 'icons');

['icon16.png', 'icon48.png', 'icon128.png'].forEach(name => {
  fs.writeFileSync(path.join(iconsDir, name), MINIMAL_PNG);
  console.log(`Created ${name}`);
});
