import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { putSessionMessage, getSessionMessages } from '../../shared/dynamodb';
import { retrieveAndGenerate } from '../../shared/bedrock';
import { response, errorResponse } from '../../shared/types';

const KNOWLEDGE_BASE_ID = process.env.KNOWLEDGE_BASE_ID!;

function getUserId(event: APIGatewayProxyEvent): string {
  const claims = event.requestContext.authorizer?.claims;
  return claims?.sub ?? claims?.['cognito:username'] ?? 'anonymous';
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const method = event.httpMethod;
    const userId = getUserId(event);
    const sessionId = event.pathParameters?.sessionId;

    // POST /sessions — create a new session
    if (method === 'POST' && !sessionId) {
      const body = JSON.parse(event.body ?? '{}');
      const { documentId } = body;

      if (!documentId) {
        return errorResponse(400, 'documentId is required');
      }

      const newSessionId = uuidv4();

      // Create a session marker entry
      await putSessionMessage({
        sessionId: newSessionId,
        timestamp: new Date().toISOString(),
        userId,
        documentId,
        role: 'user',
        content: '__session_init__',
      });

      return response(200, { sessionId: newSessionId });
    }

    // POST /sessions/{sessionId}/query
    if (method === 'POST' && sessionId) {
      const body = JSON.parse(event.body ?? '{}');
      const { question, documentId } = body;

      if (!question) {
        return errorResponse(400, 'question is required');
      }

      // Save user message
      const userTimestamp = new Date().toISOString();
      await putSessionMessage({
        sessionId,
        timestamp: userTimestamp,
        userId,
        documentId: documentId ?? '',
        role: 'user',
        content: question,
      });

      // Call Bedrock KB
      const { answer, citations } = await retrieveAndGenerate(
        KNOWLEDGE_BASE_ID,
        question,
        sessionId
      );

      // Save assistant response
      const assistantTimestamp = new Date(Date.now() + 1).toISOString();
      await putSessionMessage({
        sessionId,
        timestamp: assistantTimestamp,
        userId,
        documentId: documentId ?? '',
        role: 'assistant',
        content: answer,
        citations,
      });

      return response(200, { answer, citations, sessionId });
    }

    return errorResponse(405, 'Method not allowed');
  } catch (err) {
    console.error('Query handler error:', err);
    return errorResponse(500, 'Internal server error');
  }
}
