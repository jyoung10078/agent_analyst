import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { putDocument, listDocuments } from '../../shared/dynamodb';
import { response, errorResponse } from '../../shared/types';

const s3Client = new S3Client({ region: process.env.REGION });

const DOCUMENTS_BUCKET = process.env.DOCUMENTS_BUCKET!;
const KNOWLEDGE_BASE_ID = process.env.KNOWLEDGE_BASE_ID!;

function getUserId(event: APIGatewayProxyEvent): string {
  const claims = event.requestContext.authorizer?.claims;
  return claims?.sub ?? claims?.['cognito:username'] ?? 'anonymous';
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const method = event.httpMethod;
    const userId = getUserId(event);

    if (method === 'GET') {
      const documents = await listDocuments(userId);
      return response(200, { documents });
    }

    if (method === 'POST') {
      const body = JSON.parse(event.body ?? '{}');
      const { fileName, fileType, contentType } = body;

      if (!fileName || !contentType) {
        return errorResponse(400, 'fileName and contentType are required');
      }

      const documentId = uuidv4();
      const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
      const s3Key = `uploads/${userId}/${documentId}/${fileName}`;

      // Generate presigned URL for direct S3 upload
      const putCommand = new PutObjectCommand({
        Bucket: DOCUMENTS_BUCKET,
        Key: s3Key,
        ContentType: contentType,
      });

      const uploadUrl = await getSignedUrl(s3Client, putCommand, { expiresIn: 900 }); // 15 min

      // Create document record in DynamoDB
      await putDocument({
        userId,
        documentId,
        fileName,
        s3Key,
        fileType: fileType ?? extension,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        knowledgeBaseId: KNOWLEDGE_BASE_ID,
      });

      return response(200, {
        uploadUrl,
        documentId,
        s3Key,
      });
    }

    return errorResponse(405, 'Method not allowed');
  } catch (err) {
    console.error('Upload handler error:', err);
    return errorResponse(500, 'Internal server error');
  }
}
