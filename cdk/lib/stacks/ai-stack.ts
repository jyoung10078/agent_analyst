import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as opensearchserverless from 'aws-cdk-lib/aws-opensearchserverless';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as path from 'path';
import { Construct } from 'constructs';

interface AIStackProps extends cdk.StackProps {
  documentsBucketNameToken: string;
}

export class AIStack extends cdk.Stack {
  public readonly knowledgeBaseId: string;
  public readonly dataSourceId: string;

  constructor(scope: Construct, id: string, props: AIStackProps) {
    super(scope, id, props);

    const collectionName = 'agent-analyst-kb';
    const documentsBucketArn = `arn:aws:s3:::${props.documentsBucketNameToken}`;

    // ── OpenSearch Serverless policies ────────────────────────────
    const encryptionPolicy = new opensearchserverless.CfnSecurityPolicy(this, 'EncryptionPolicy', {
      name: `${collectionName}-enc`,
      type: 'encryption',
      policy: JSON.stringify({
        Rules: [{ ResourceType: 'collection', Resource: [`collection/${collectionName}`] }],
        AWSOwnedKey: true,
      }),
    });

    const networkPolicy = new opensearchserverless.CfnSecurityPolicy(this, 'NetworkPolicy', {
      name: `${collectionName}-net`,
      type: 'network',
      policy: JSON.stringify([
        {
          Rules: [
            { ResourceType: 'collection', Resource: [`collection/${collectionName}`] },
            { ResourceType: 'dashboard', Resource: [`collection/${collectionName}`] },
          ],
          AllowFromPublic: true,
        },
      ]),
    });

    // ── IAM role for Bedrock Knowledge Base ───────────────────────
    const kbRole = new iam.Role(this, 'KnowledgeBaseRole', {
      roleName: 'agent-analyst-kb-role',
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      inlinePolicies: {
        BedrockKBPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['bedrock:InvokeModel'],
              resources: [
                `arn:aws:bedrock:${this.region}::foundation-model/amazon.titan-embed-text-v2:0`,
              ],
            }),
            new iam.PolicyStatement({
              actions: ['s3:GetObject', 's3:ListBucket'],
              resources: [documentsBucketArn, `${documentsBucketArn}/*`],
            }),
            new iam.PolicyStatement({
              actions: ['aoss:APIAccessAll'],
              resources: [`arn:aws:aoss:${this.region}:${this.account}:collection/*`],
            }),
          ],
        }),
      },
    });

    // ── IAM role for the Custom Resource Lambda ───────────────────
    const crRole = new iam.Role(this, 'IndexCreatorRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        AOSSPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['aoss:APIAccessAll'],
              resources: [`arn:aws:aoss:${this.region}:${this.account}:collection/*`],
            }),
          ],
        }),
      },
    });

    // ── OpenSearch Serverless collection ──────────────────────────
    const collection = new opensearchserverless.CfnCollection(this, 'KBCollection', {
      name: collectionName,
      type: 'VECTORSEARCH',
    });
    collection.addDependency(encryptionPolicy);
    collection.addDependency(networkPolicy);

    // ── Data access policies (KB role + CR Lambda role) ───────────
    const dataAccessPolicy = new opensearchserverless.CfnAccessPolicy(this, 'DataAccessPolicy', {
      name: `${collectionName}-access`,
      type: 'data',
      policy: JSON.stringify([
        {
          Rules: [
            {
              ResourceType: 'collection',
              Resource: [`collection/${collectionName}`],
              Permission: [
                'aoss:CreateCollectionItems',
                'aoss:DeleteCollectionItems',
                'aoss:UpdateCollectionItems',
                'aoss:DescribeCollectionItems',
              ],
            },
            {
              ResourceType: 'index',
              Resource: [`index/${collectionName}/*`],
              Permission: [
                'aoss:CreateIndex',
                'aoss:DeleteIndex',
                'aoss:UpdateIndex',
                'aoss:DescribeIndex',
                'aoss:ReadDocument',
                'aoss:WriteDocument',
              ],
            },
          ],
          // Both the KB role and the CR Lambda role need access
          Principal: [kbRole.roleArn, crRole.roleArn],
        },
      ]),
    });
    dataAccessPolicy.addDependency(collection);

    // ── Custom Resource: create the vector index ──────────────────
    const indexCreatorFn = new lambda.Function(this, 'IndexCreatorFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../cr-handlers/create-os-index')
      ),
      timeout: cdk.Duration.minutes(10),
      role: crRole,
      environment: { REGION: this.region },
    });

    const indexCreatorProvider = new cr.Provider(this, 'IndexCreatorProvider', {
      onEventHandler: indexCreatorFn,
    });

    const createIndex = new cdk.CustomResource(this, 'CreateOSIndex', {
      serviceToken: indexCreatorProvider.serviceToken,
      properties: {
        CollectionEndpoint: collection.attrCollectionEndpoint,
        // change this value to force re-run on updates
        Nonce: '1',
      },
    });
    createIndex.node.addDependency(dataAccessPolicy);

    // ── Bedrock Knowledge Base ─────────────────────────────────────
    const knowledgeBase = new bedrock.CfnKnowledgeBase(this, 'KnowledgeBase', {
      name: 'agent-analyst-kb',
      roleArn: kbRole.roleArn,
      knowledgeBaseConfiguration: {
        type: 'VECTOR',
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: `arn:aws:bedrock:${this.region}::foundation-model/amazon.titan-embed-text-v2:0`,
        },
      },
      storageConfiguration: {
        type: 'OPENSEARCH_SERVERLESS',
        opensearchServerlessConfiguration: {
          collectionArn: collection.attrArn,
          vectorIndexName: 'bedrock-knowledge-base-default-index',
          fieldMapping: {
            vectorField: 'bedrock-knowledge-base-default-vector',
            textField: 'AMAZON_BEDROCK_TEXT_CHUNK',
            metadataField: 'AMAZON_BEDROCK_METADATA',
          },
        },
      },
    });
    knowledgeBase.node.addDependency(createIndex);
    knowledgeBase.node.addDependency(kbRole);

    // ── Bedrock Data Source ────────────────────────────────────────
    const dataSource = new bedrock.CfnDataSource(this, 'DataSource', {
      name: 'agent-analyst-documents',
      knowledgeBaseId: knowledgeBase.attrKnowledgeBaseId,
      dataSourceConfiguration: {
        type: 'S3',
        s3Configuration: {
          bucketArn: documentsBucketArn,
          inclusionPrefixes: ['uploads/'],
        },
      },
      vectorIngestionConfiguration: {
        chunkingConfiguration: {
          chunkingStrategy: 'FIXED_SIZE',
          fixedSizeChunkingConfiguration: {
            maxTokens: 500,
            overlapPercentage: 20,
          },
        },
      },
    });

    this.knowledgeBaseId = knowledgeBase.attrKnowledgeBaseId;
    this.dataSourceId = dataSource.attrDataSourceId;

    new cdk.CfnOutput(this, 'KnowledgeBaseId', {
      value: knowledgeBase.attrKnowledgeBaseId,
      exportName: 'AgentAnalystKnowledgeBaseId',
    });

    new cdk.CfnOutput(this, 'DataSourceId', {
      value: dataSource.attrDataSourceId,
      exportName: 'AgentAnalystDataSourceId',
    });
  }
}
