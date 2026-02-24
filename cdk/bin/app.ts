#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CognitoStack } from '../lib/stacks/cognito-stack';
import { AIStack } from '../lib/stacks/ai-stack';
import { BackendStack } from '../lib/stacks/backend-stack';
import { FrontendStack } from '../lib/stacks/frontend-stack';

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

// 1. Auth (no deps)
const cognitoStack = new CognitoStack(app, 'AgentAnalystCognito', { env });

// 2. AI infrastructure (OpenSearch Serverless + Bedrock KB)
// Uses a placeholder bucket ARN at synth time; real bucket deployed in BackendStack
// We defer the AI stack to accept the actual bucket from BackendStack or use a fixed name
const aiStack = new AIStack(app, 'AgentAnalystAI', {
  env,
  // Documents bucket name is deterministic — uses account+region in name
  documentsBucketNameToken: `agent-analyst-documents-${process.env.CDK_DEFAULT_ACCOUNT ?? 'ACCOUNT'}-${process.env.CDK_DEFAULT_REGION ?? 'REGION'}`,
});

// 3. Backend (S3 + DynamoDB + Lambdas + API GW), depends on Cognito + AI
const backendStack = new BackendStack(app, 'AgentAnalystBackend', {
  env,
  userPool: cognitoStack.userPool,
  knowledgeBaseId: aiStack.knowledgeBaseId,
  dataSourceId: aiStack.dataSourceId,
});
backendStack.addDependency(cognitoStack);
backendStack.addDependency(aiStack);

// 4. Frontend (S3 + CloudFront), depends on Backend + Cognito
const frontendStack = new FrontendStack(app, 'AgentAnalystFrontend', {
  env,
  apiUrl: backendStack.apiUrl,
  userPoolId: cognitoStack.userPool.userPoolId,
  userPoolClientId: cognitoStack.userPoolClient.userPoolClientId,
});
frontendStack.addDependency(backendStack);
frontendStack.addDependency(cognitoStack);

app.synth();
