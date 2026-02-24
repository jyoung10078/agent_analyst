#!/usr/bin/env node
/**
 * After CDK deploy, run this script to inject the CDK outputs into the frontend .env.production
 * Usage: node scripts/inject-config.js [path/to/cdk-outputs.json]
 */
const fs = require('fs');
const path = require('path');

const outputsFile = process.argv[2] ?? path.join(__dirname, '../../cdk/cdk-outputs.json');

if (!fs.existsSync(outputsFile)) {
  console.error(`CDK outputs file not found: ${outputsFile}`);
  console.error('Run: cd cdk && npx cdk deploy --all --outputs-file cdk-outputs.json');
  process.exit(1);
}

const outputs = JSON.parse(fs.readFileSync(outputsFile, 'utf-8'));

// Flatten all stack outputs
const flat = {};
for (const stackOutputs of Object.values(outputs)) {
  Object.assign(flat, stackOutputs);
}

const apiUrl = flat['ApiUrl'] ?? flat['AgentAnalystApiUrl'] ?? '';
const userPoolId = flat['UserPoolId'] ?? flat['AgentAnalystUserPoolId'] ?? '';
const userPoolClientId = flat['UserPoolClientId'] ?? flat['AgentAnalystUserPoolClientId'] ?? '';
const region = process.env.AWS_REGION ?? process.env.CDK_DEFAULT_REGION ?? 'us-east-1';

const envContent = `# Auto-generated from CDK outputs - do not edit manually
VITE_API_URL=${apiUrl}
VITE_USER_POOL_ID=${userPoolId}
VITE_USER_POOL_CLIENT_ID=${userPoolClientId}
VITE_REGION=${region}
`;

const envPath = path.join(__dirname, '../.env.production');
fs.writeFileSync(envPath, envContent);
console.log('Wrote frontend config to:', envPath);
console.log({ apiUrl, userPoolId, userPoolClientId, region });
