export type DocumentStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
export type MessageRole = 'user' | 'assistant';

export interface DocumentRecord {
  userId: string;
  documentId: string;
  fileName: string;
  s3Key: string;
  fileType: string;
  status: DocumentStatus;
  createdAt: string;
  knowledgeBaseId?: string;
}

export interface SessionMessage {
  sessionId: string;
  timestamp: string;
  userId: string;
  documentId: string;
  role: MessageRole;
  content: string;
  citations?: Citation[];
}

export interface Citation {
  text: string;
  location?: unknown;
}

export interface ApiResponse<T = unknown> {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

export function response<T>(statusCode: number, body: T): ApiResponse<T> {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body),
  };
}

export function errorResponse(statusCode: number, message: string): ApiResponse {
  return response(statusCode, { error: message });
}
