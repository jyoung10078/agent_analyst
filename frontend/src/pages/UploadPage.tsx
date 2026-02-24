import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'aws-amplify/auth';
import FileUpload from '../components/FileUpload';
import { useApi, Document } from '../hooks/useApi';

export default function UploadPage() {
  const navigate = useNavigate();
  const api = useApi();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [error, setError] = useState('');
  const [pollingId, setPollingId] = useState<string | null>(null);

  useEffect(() => {
    api.getDocuments().then((r) => setDocuments(r.documents)).catch(() => {});
  }, []);

  // Poll for document status
  useEffect(() => {
    if (!pollingId) return;

    const interval = setInterval(async () => {
      try {
        const { documents: docs } = await api.getDocuments();
        setDocuments(docs);
        const doc = docs.find((d) => d.documentId === pollingId);
        if (doc?.status === 'READY') {
          clearInterval(interval);
          setPollingId(null);
          setUploadProgress('');
          navigate(`/chat/${doc.documentId}`);
        } else if (doc?.status === 'FAILED') {
          clearInterval(interval);
          setPollingId(null);
          setUploadProgress('');
          setError('Document processing failed. Please try again.');
        } else if (doc?.status === 'PROCESSING') {
          setUploadProgress('Processing document and indexing for Q&A...');
        }
      } catch {
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [pollingId]);

  const handleFile = async (file: File) => {
    setError('');
    setIsUploading(true);
    setUploadProgress('Getting upload URL...');

    try {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
      const { uploadUrl, documentId } = await api.getUploadUrl(file.name, extension, file.type);

      setUploadProgress('Uploading file to S3...');
      await api.uploadToS3(uploadUrl, file);

      setUploadProgress('Upload complete! Processing document...');
      setIsUploading(false);
      setPollingId(documentId);
    } catch (err) {
      setError((err as Error).message);
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const statusColor = (status: Document['status']) => {
    switch (status) {
      case 'READY': return '#16a34a';
      case 'PROCESSING': return '#d97706';
      case 'FAILED': return '#dc2626';
      default: return '#6b7280';
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #eee', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#1a1a2e' }}>Agent Analyst</h1>
        <button onClick={handleLogout} style={{ padding: '8px 16px', border: '1.5px solid #e0e0e0', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '14px' }}>
          Sign Out
        </button>
      </div>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '40px 20px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px', color: '#333' }}>Upload a Document</h2>
        <p style={{ color: '#666', marginBottom: '32px' }}>Upload a file to start a Q&A session and generate a white paper</p>

        {error && (
          <div style={{ background: '#fee2e2', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        {uploadProgress && (
          <div style={{ background: '#eff6ff', color: '#2563eb', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px' }}>
            {uploadProgress}
          </div>
        )}

        <FileUpload onFile={handleFile} isLoading={isUploading || !!pollingId} />

        {documents.length > 0 && (
          <div style={{ marginTop: '40px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#333' }}>Your Documents</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {documents
                .filter((d) => d.documentId !== undefined)
                .map((doc) => (
                  <div
                    key={doc.documentId}
                    onClick={() => doc.status === 'READY' && navigate(`/chat/${doc.documentId}`)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'white',
                      borderRadius: '8px',
                      padding: '14px 18px',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                      cursor: doc.status === 'READY' ? 'pointer' : 'default',
                      border: '1px solid #eee',
                      transition: 'box-shadow 0.2s',
                    }}
                  >
                    <div>
                      <p style={{ fontWeight: '500', fontSize: '15px', color: '#333' }}>{doc.fileName}</p>
                      <p style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
                        {new Date(doc.createdAt).toLocaleDateString()} · {doc.fileType.toUpperCase()}
                      </p>
                    </div>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: statusColor(doc.status),
                      background: `${statusColor(doc.status)}18`,
                      padding: '4px 10px',
                      borderRadius: '20px',
                    }}>
                      {doc.status}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
