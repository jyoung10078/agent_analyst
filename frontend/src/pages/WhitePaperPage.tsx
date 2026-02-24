import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import WhitePaperViewer from '../components/WhitePaperViewer';
import { useApi } from '../hooks/useApi';

export default function WhitePaperPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const api = useApi();
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId) return;

    api.getWhitePaper(sessionId)
      .then((r) => {
        setContent(r.markdownContent);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setIsLoading(false);
      });
  }, [sessionId]);

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whitepaper-${sessionId?.substring(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #eee', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => navigate(-1)}
            style={{ padding: '6px 12px', border: '1.5px solid #e0e0e0', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '13px' }}
          >
            ← Back
          </button>
          <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#1a1a2e' }}>White Paper</h1>
        </div>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
          <p style={{ color: '#888' }}>Loading white paper...</p>
        </div>
      )}

      {error && !isLoading && (
        <div style={{ maxWidth: '760px', margin: '40px auto', padding: '0 20px' }}>
          <div style={{ background: '#fee2e2', color: '#dc2626', padding: '16px', borderRadius: '8px' }}>
            {error}
          </div>
        </div>
      )}

      {content && !isLoading && (
        <WhitePaperViewer content={content} onDownload={handleDownload} />
      )}
    </div>
  );
}
