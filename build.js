const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('Starting build process...');
console.log('Current directory:', process.cwd());
console.log('Node version:', process.version);

// Ensure CRA does not fail build due to warnings in CI environments
process.env.CI = 'false';

try {
  // Check if client directory exists
  const clientPath = path.join(__dirname, 'client');
  if (!fs.existsSync(clientPath)) {
    throw new Error(`Client directory not found at: ${clientPath}`);
  }
  
  // Change to client directory
  process.chdir(clientPath);
  console.log('Changed to client directory:', process.cwd());
  
  // Check if package.json exists
  if (!fs.existsSync('package.json')) {
    throw new Error('package.json not found in client directory');
  }
  
  // Install dependencies with force flag to resolve any conflicts
  console.log('Installing dependencies...');
  execSync('npm install --legacy-peer-deps --force', { stdio: 'inherit' });
  
  // Run build
  console.log('Running build...');
  execSync('npm run build', { stdio: 'inherit' });
  
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}
