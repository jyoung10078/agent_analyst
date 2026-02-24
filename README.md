# Agent Analyst

A full-stack AWS application for AI-powered document Q&A and white paper generation. Upload Excel, PDF, CSV, or Word files — ask questions using RAG via Amazon Bedrock Knowledge Bases (Meta Llama 3.1 70B), then generate structured markdown white papers from the conversation.

## Architecture

```
User → CloudFront → React SPA (S3)
User → Cognito → API Gateway → Lambda functions
Upload → S3 → Ingest Lambda → Bedrock Knowledge Base (OpenSearch Serverless)
Q&A   → Query Lambda → Bedrock KB RetrieveAndGenerate (Llama 3.1 70B)
                    → DynamoDB (session history)
White Paper → Whitepaper Lambda → Llama multi-step prompting → S3 → response
```

**CDK Stacks:**
| Stack | Contents |
|-------|----------|
| `AgentAnalystCognito` | Cognito User Pool + Client |
| `AgentAnalystAI` | OpenSearch Serverless + Bedrock Knowledge Base |
| `AgentAnalystBackend` | S3, DynamoDB, 4 Lambda functions, API Gateway |
| `AgentAnalystFrontend` | S3 + CloudFront (React SPA) |

> **Cost note:** OpenSearch Serverless has a minimum charge of ~$175/month. This is required for Bedrock Knowledge Bases.

## Prerequisites

- AWS CLI configured with appropriate permissions
- Node.js 20+
- CDK bootstrapped in your account/region: `npx cdk bootstrap`
- Bedrock model access enabled in your AWS console:
  - `meta.llama3-1-70b-instruct-v1:0`
  - `amazon.titan-embed-text-v2:0`

## Deployment

```bash
# 1. Install dependencies
npm install

# 2. Build backend Lambdas
cd backend && npm run build && cd ..

# 3. Build frontend (with placeholder config for synth)
cd frontend && npm run build && cd ..

# 4. Bootstrap CDK (first time only)
cd cdk && npx cdk bootstrap

# 5. Deploy all stacks
npx cdk deploy --all --require-approval broadening --outputs-file cdk-outputs.json

# 6. Inject CDK outputs into frontend config
cd ../frontend && node scripts/inject-config.js ../cdk/cdk-outputs.json

# 7. Rebuild frontend with real config, then redeploy frontend stack
npm run build && cd ../cdk
npx cdk deploy AgentAnalystFrontend --require-approval never
```

## Local Development

```bash
# Copy and fill in env vars from your CDK deploy outputs
cp frontend/.env.local.example frontend/.env.local
# Edit frontend/.env.local with your API URL, User Pool ID, etc.

cd frontend && npm run dev
```

## Project Structure

```
agent-analyst/
├── cdk/                    # AWS CDK TypeScript
│   ├── bin/app.ts          # Stack composition
│   └── lib/stacks/
│       ├── cognito-stack.ts
│       ├── ai-stack.ts         # OpenSearch Serverless + Bedrock KB
│       ├── backend-stack.ts    # S3 + DynamoDB + Lambdas + API GW
│       └── frontend-stack.ts   # S3 + CloudFront
├── backend/                # Lambda handlers
│   ├── handlers/
│   │   ├── upload/         # Presigned URL generation + document listing
│   │   ├── ingest/         # S3-triggered: file processing + KB sync
│   │   ├── query/          # Session management + RAG Q&A
│   │   └── whitepaper/     # Multi-step Llama white paper generation
│   └── shared/             # DynamoDB helpers, Bedrock client, types
└── frontend/               # React + Vite + TypeScript
    └── src/
        ├── pages/          # UploadPage, ChatPage, WhitePaperPage, AuthPage
        ├── components/     # FileUpload, ChatInterface, WhitePaperViewer
        └── hooks/          # useAuth, useApi
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/documents/upload` | Get presigned S3 URL for upload |
| `GET` | `/documents` | List user's documents |
| `POST` | `/sessions` | Create Q&A session |
| `POST` | `/sessions/{id}/query` | Ask a question (RAG) |
| `POST` | `/sessions/{id}/whitepaper` | Generate white paper |
| `GET` | `/sessions/{id}/whitepaper` | Retrieve white paper |

## Supported File Types

| Type | Processing |
|------|-----------|
| PDF | Native Bedrock KB ingestion |
| Word (.docx) | Native Bedrock KB ingestion |
| Excel (.xlsx, .xls) | Converted to markdown tables via `xlsx` library |
| CSV | Converted to markdown table via `csv-parse` |
