import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ChatInterface, { Message } from '../components/ChatInterface';
import { useApi } from '../hooks/useApi';

export default function ChatPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const api = useApi();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!documentId) return;

    api.createSession(documentId)
      .then((r) => setSessionId(r.sessionId))
      .catch((err) => setError(err.message));
  }, [documentId]);

  const handleSend = async (question: string) => {
    if (!sessionId || !documentId) return;

    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setIsLoading(true);
    setError('');

    try {
      const { answer, citations } = await api.query(sessionId, question, documentId);
      setMessages((prev) => [...prev, { role: 'assistant', content: answer, citations }]);
    } catch (err) {
      setError((err as Error).message);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateWhitePaper = async () => {
    if (!sessionId) return;

    setIsGenerating(true);
    setError('');

    try {
      await api.generateWhitePaper(sessionId);
      navigate(`/whitepaper/${sessionId}`);
    } catch (err) {
      setError((err as Error).message);
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f9fafb' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #eee', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => navigate('/')}
            style={{ padding: '6px 12px', border: '1.5px solid #e0e0e0', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '13px' }}
          >
            ← Back
          </button>
          <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#1a1a2e' }}>Document Q&A</h1>
        </div>
        {sessionId && (
          <span style={{ fontSize: '12px', color: '#888' }}>Session: {sessionId.substring(0, 8)}...</span>
        )}
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 24px', fontSize: '14px', flexShrink: 0 }}>
          {error}
        </div>
      )}

      {!sessionId ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
          <p style={{ color: '#888' }}>Initializing session...</p>
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <ChatInterface
            messages={messages}
            isLoading={isLoading}
            onSend={handleSend}
            onGenerateWhitePaper={handleGenerateWhitePaper}
            isGenerating={isGenerating}
          />
        </div>
      )}
    </div>
  );
}
