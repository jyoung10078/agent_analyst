import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { Construct } from 'constructs';

interface BackendStackProps extends cdk.StackProps {
  userPool: cognito.UserPool;
  knowledgeBaseId: string;
  dataSourceId: string;
}

export class BackendStack extends cdk.Stack {
  public readonly apiUrl: string;
  public readonly documentsBucket: s3.Bucket;
  public readonly whitepapersBucket: s3.Bucket;
  public readonly documentsTable: dynamodb.Table;
  public readonly sessionsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);

    // ── Storage ──────────────────────────────────────────────────
    this.documentsBucket = new s3.Bucket(this, 'DocumentsBucket', {
      bucketName: `agent-analyst-documents-${this.account}-${this.region}`,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['*'],
          exposedHeaders: ['ETag'],
          maxAge: 3000,
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    this.whitepapersBucket = new s3.Bucket(this, 'WhitepapersBucket', {
      bucketName: `agent-analyst-whitepapers-${this.account}-${this.region}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    this.documentsTable = new dynamodb.Table(this, 'DocumentsTable', {
      tableName: 'agent-analyst-documents',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'documentId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.sessionsTable = new dynamodb.Table(this, 'SessionsTable', {
      tableName: 'agent-analyst-sessions',
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.sessionsTable.addGlobalSecondaryIndex({
      indexName: 'userId-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ── Lambda shared config ──────────────────────────────────────
    const llmModelId = 'meta.llama3-1-70b-instruct-v1:0';
    const embeddingModelId = 'amazon.titan-embed-text-v2:0';

    const commonEnv = {
      DOCUMENTS_BUCKET: this.documentsBucket.bucketName,
      WHITEPAPERS_BUCKET: this.whitepapersBucket.bucketName,
      DOCUMENTS_TABLE: this.documentsTable.tableName,
      SESSIONS_TABLE: this.sessionsTable.tableName,
      KNOWLEDGE_BASE_ID: props.knowledgeBaseId,
      DATA_SOURCE_ID: props.dataSourceId,
      LLM_MODEL_ID: llmModelId,
      EMBEDDING_MODEL_ID: embeddingModelId,
      REGION: this.region,
    };

    const bedrockPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
        'bedrock:RetrieveAndGenerate',
        'bedrock:Retrieve',
        'bedrock:StartIngestionJob',
        'bedrock:GetIngestionJob',
        'bedrock:ListIngestionJobs',
      ],
      resources: ['*'],
    });

    // ── Upload Lambda ─────────────────────────────────────────────
    const uploadFn = new lambda.Function(this, 'UploadFn', {
      functionName: 'agent-analyst-upload',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/dist/upload')),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: commonEnv,
    });
    this.documentsBucket.grantReadWrite(uploadFn);
    this.documentsTable.grantReadWriteData(uploadFn);

    // ── Ingest Lambda (S3-triggered) ──────────────────────────────
    const ingestFn = new lambda.Function(this, 'IngestFn', {
      functionName: 'agent-analyst-ingest',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/dist/ingest')),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: commonEnv,
    });
    this.documentsBucket.grantReadWrite(ingestFn);
    this.documentsTable.grantReadWriteData(ingestFn);
    ingestFn.addToRolePolicy(bedrockPolicy);

    // S3 event source — bucket and lambda in same stack, no cycle
    ingestFn.addEventSource(
      new lambdaEventSources.S3EventSource(this.documentsBucket, {
        events: [s3.EventType.OBJECT_CREATED],
        filters: [{ prefix: 'uploads/' }],
      })
    );

    // ── Query Lambda ──────────────────────────────────────────────
    const queryFn = new lambda.Function(this, 'QueryFn', {
      functionName: 'agent-analyst-query',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/dist/query')),
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      environment: commonEnv,
    });
    this.sessionsTable.grantReadWriteData(queryFn);
    this.documentsTable.grantReadData(queryFn);
    queryFn.addToRolePolicy(bedrockPolicy);

    // ── Whitepaper Lambda ─────────────────────────────────────────
    const whitePaperFn = new lambda.Function(this, 'WhitepaperFn', {
      functionName: 'agent-analyst-whitepaper',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/dist/whitepaper')),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: commonEnv,
    });
    this.sessionsTable.grantReadWriteData(whitePaperFn);
    this.whitepapersBucket.grantReadWrite(whitePaperFn);
    whitePaperFn.addToRolePolicy(bedrockPolicy);

    // ── API Gateway ───────────────────────────────────────────────
    const api = new apigateway.RestApi(this, 'AgentAnalystApi', {
      restApiName: 'agent-analyst-api',
      description: 'Agent Analyst REST API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
      deployOptions: { stageName: 'prod' },
    });

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [props.userPool],
      authorizerName: 'agent-analyst-authorizer',
    });

    const authOptions: apigateway.MethodOptions = {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    };

    // /documents
    const documents = api.root.addResource('documents');
    const uploadIntegration = new apigateway.LambdaIntegration(uploadFn);
    documents.addMethod('GET', uploadIntegration, authOptions);
    documents.addResource('upload').addMethod('POST', uploadIntegration, authOptions);

    // /sessions
    const sessions = api.root.addResource('sessions');
    const queryIntegration = new apigateway.LambdaIntegration(queryFn);
    sessions.addMethod('POST', queryIntegration, authOptions);

    const sessionById = sessions.addResource('{sessionId}');
    sessionById.addResource('query').addMethod('POST', queryIntegration, authOptions);

    const whitePaperIntegration = new apigateway.LambdaIntegration(whitePaperFn);
    const whitePaperResource = sessionById.addResource('whitepaper');
    whitePaperResource.addMethod('POST', whitePaperIntegration, authOptions);
    whitePaperResource.addMethod('GET', whitePaperIntegration, authOptions);

    this.apiUrl = api.url;

    // ── Outputs ───────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      exportName: 'AgentAnalystApiUrl',
    });

    new cdk.CfnOutput(this, 'DocumentsBucketName', {
      value: this.documentsBucket.bucketName,
      exportName: 'AgentAnalystDocumentsBucket',
    });
  }
}
