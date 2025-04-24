/**
 * This script prepares the Slidev template project with all dependencies
 * during the extension packaging process, rather than at runtime.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Define paths
const rootDir = path.resolve(__dirname, '..');
const resourcesDir = path.join(rootDir, 'resources');
const templateDir = path.join(resourcesDir, 'slidev-template');

console.log('Preparing Slidev template project...');

// Create resources directory if it doesn't exist
if (!fs.existsSync(resourcesDir)) {
  console.log('Creating resources directory...');
  fs.mkdirSync(resourcesDir, { recursive: true });
}

// Create template directory if it doesn't exist
if (!fs.existsSync(templateDir)) {
  console.log('Creating template directory...');
  fs.mkdirSync(templateDir, { recursive: true });
} else {
  console.log('Template directory already exists');
}

// Create package.json for the template if it doesn't exist
const packageJsonPath = path.join(templateDir, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.log('Creating package.json for template...');
  
  const packageJson = {
    "name": "slidev-template",
    "private": true,
    "type": "module",
    "scripts": {
      "dev": "slidev",
      "build": "slidev build",
      "export": "slidev export"
    },
    "dependencies": {
      "@slidev/cli": "^51.5.0",
      "@slidev/theme-default": "^0.25.0",
      "@slidev/theme-seriph": "^0.25.0"
    },
    "devDependencies": {
      "playwright-chromium": "^1.52.0"  // Pre-install for PDF export
    }
  };
  
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

// Create empty folders for assets and components if they don't exist
const assetsDir = path.join(templateDir, 'assets');
if (!fs.existsSync(assetsDir)) {
  console.log('Creating assets directory...');
  fs.mkdirSync(assetsDir, { recursive: true });
}

const componentsDir = path.join(templateDir, 'components');
if (!fs.existsSync(componentsDir)) {
  console.log('Creating components directory...');
  fs.mkdirSync(componentsDir, { recursive: true });
}

// Create a basic .gitignore if it doesn't exist
const gitignorePath = path.join(templateDir, '.gitignore');
if (!fs.existsSync(gitignorePath)) {
  console.log('Creating .gitignore for template...');
  fs.writeFileSync(
    gitignorePath,
    'node_modules\n.DS_Store\ndist\n*.local\n.remote-assets\ncomponents.d.ts'
  );
}

// Check if node_modules already exists and is valid
const nodeModulesPath = path.join(templateDir, 'node_modules');
const slidevCliPath = path.join(nodeModulesPath, '@slidev', 'cli');

if (!fs.existsSync(slidevCliPath)) {
  console.log('Installing template dependencies (this may take a few minutes)...');
  
  try {
    // Run npm install in the template directory
    execSync('npm install', { 
      cwd: templateDir,
      stdio: 'inherit' // Show the output
    });
    console.log('Dependencies installed successfully');
  } catch (error) {
    console.error('Failed to install dependencies:', error);
    process.exit(1);
  }
} else {
  console.log('Dependencies already installed');
}

// Make sure .vscodeignore doesn't exclude our template with node_modules
const vscodeignorePath = path.join(rootDir, '.vscodeignore');
if (fs.existsSync(vscodeignorePath)) {
  let vscodeignore = fs.readFileSync(vscodeignorePath, 'utf8');
  
  // Check if we need to modify the .vscodeignore file
  const templatePattern = 'resources/slidev-template/node_modules/**';
  const negativeTemplatePattern = '!resources/slidev-template/node_modules/**';
  
  if (vscodeignore.includes(templatePattern) && !vscodeignore.includes(negativeTemplatePattern)) {
    console.log('Updating .vscodeignore to include slidev-template/node_modules...');
    
    // Add an exception for the template node_modules
    vscodeignore += '\n' + negativeTemplatePattern;
    fs.writeFileSync(vscodeignorePath, vscodeignore);
  }
}

console.log('Slidev template preparation complete!');