import { fetchAuthSession } from 'aws-amplify/auth';
import config from '../config';

async function getAuthToken(): Promise<string> {
  const session = await fetchAuthSession();
  return session.tokens?.idToken?.toString() ?? '';
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken();
  const url = `${config.apiUrl.replace(/\/$/, '')}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error ?? `HTTP ${res.status}`);
  }

  return res.json();
}

export interface Document {
  userId: string;
  documentId: string;
  fileName: string;
  s3Key: string;
  fileType: string;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
  createdAt: string;
}

export interface UploadResponse {
  uploadUrl: string;
  documentId: string;
  s3Key: string;
}

export interface QueryResponse {
  answer: string;
  citations: Array<{ text: string; location?: unknown }>;
  sessionId: string;
}

export interface WhitePaperResponse {
  markdownContent: string;
  s3Url: string;
}

export function useApi() {
  const getDocuments = () => apiFetch<{ documents: Document[] }>('/documents');

  const getUploadUrl = (fileName: string, fileType: string, contentType: string) =>
    apiFetch<UploadResponse>('/documents/upload', {
      method: 'POST',
      body: JSON.stringify({ fileName, fileType, contentType }),
    });

  const uploadToS3 = async (uploadUrl: string, file: File) => {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });
    if (!res.ok) throw new Error('S3 upload failed');
  };

  const createSession = (documentId: string) =>
    apiFetch<{ sessionId: string }>('/sessions', {
      method: 'POST',
      body: JSON.stringify({ documentId }),
    });

  const query = (sessionId: string, question: string, documentId: string) =>
    apiFetch<QueryResponse>(`/sessions/${sessionId}/query`, {
      method: 'POST',
      body: JSON.stringify({ question, documentId }),
    });

  const generateWhitePaper = (sessionId: string) =>
    apiFetch<WhitePaperResponse>(`/sessions/${sessionId}/whitepaper`, { method: 'POST' });

  const getWhitePaper = (sessionId: string) =>
    apiFetch<WhitePaperResponse>(`/sessions/${sessionId}/whitepaper`);

  return {
    getDocuments,
    getUploadUrl,
    uploadToS3,
    createSession,
    query,
    generateWhitePaper,
    getWhitePaper,
  };
}
