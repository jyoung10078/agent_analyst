import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { DocumentRecord, SessionMessage } from './types';

const client = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(client);

const DOCUMENTS_TABLE = process.env.DOCUMENTS_TABLE!;
const SESSIONS_TABLE = process.env.SESSIONS_TABLE!;

export async function putDocument(record: DocumentRecord): Promise<void> {
  await docClient.send(new PutCommand({
    TableName: DOCUMENTS_TABLE,
    Item: record,
  }));
}

export async function getDocument(userId: string, documentId: string): Promise<DocumentRecord | null> {
  const result = await docClient.send(new GetCommand({
    TableName: DOCUMENTS_TABLE,
    Key: { userId, documentId },
  }));
  return (result.Item as DocumentRecord) ?? null;
}

export async function listDocuments(userId: string): Promise<DocumentRecord[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: DOCUMENTS_TABLE,
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
  }));
  return (result.Items ?? []) as DocumentRecord[];
}

export async function updateDocumentStatus(
  userId: string,
  documentId: string,
  status: string
): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: DOCUMENTS_TABLE,
    Key: { userId, documentId },
    UpdateExpression: 'SET #status = :status',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':status': status },
  }));
}

export async function putSessionMessage(message: SessionMessage): Promise<void> {
  await docClient.send(new PutCommand({
    TableName: SESSIONS_TABLE,
    Item: message,
  }));
}

export async function getSessionMessages(sessionId: string): Promise<SessionMessage[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: SESSIONS_TABLE,
    KeyConditionExpression: 'sessionId = :sid',
    ExpressionAttributeValues: { ':sid': sessionId },
  }));
  return (result.Items ?? []) as SessionMessage[];
}

export async function getSessionsByUser(userId: string): Promise<SessionMessage[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: SESSIONS_TABLE,
    IndexName: 'userId-index',
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
  }));
  return (result.Items ?? []) as SessionMessage[];
}

// Find a document by S3 key (scan-like approach using GSI not available, so we query by prefix)
export async function findDocumentByS3Key(s3Key: string): Promise<DocumentRecord | null> {
  // We need to scan across all users - in production this should be optimized with a GSI
  // For now we store the userId in the S3 key prefix: uploads/{userId}/{documentId}/filename
  const parts = s3Key.split('/');
  if (parts.length >= 3) {
    const userId = parts[1];
    const documentId = parts[2];
    return getDocument(userId, documentId);
  }
  return null;
}
