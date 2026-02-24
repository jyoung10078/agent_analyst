import React, { useRef, useEffect } from 'react';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: Array<{ text: string }>;
}

interface ChatInterfaceProps {
  messages: Message[];
  isLoading: boolean;
  onSend: (question: string) => void;
  onGenerateWhitePaper: () => void;
  isGenerating: boolean;
}

export default function ChatInterface({
  messages,
  isLoading,
  onSend,
  onGenerateWhitePaper,
  isGenerating,
}: ChatInterfaceProps) {
  const [input, setInput] = React.useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput('');
  };

  const hasExchanges = messages.some((m) => m.role === 'assistant');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#888', marginTop: '40px' }}>
            <p style={{ fontSize: '16px' }}>Ask a question about your document</p>
            <p style={{ fontSize: '13px', marginTop: '8px' }}>The AI will analyze the document and provide answers with citations</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '75%',
              padding: '12px 16px',
              borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              background: msg.role === 'user' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white',
              color: msg.role === 'user' ? 'white' : '#333',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              fontSize: '15px',
              lineHeight: '1.5',
            }}>
              <p style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
              {msg.citations && msg.citations.length > 0 && (
                <details style={{ marginTop: '8px', fontSize: '12px', opacity: 0.8 }}>
                  <summary style={{ cursor: 'pointer' }}>
                    {msg.citations.length} source{msg.citations.length > 1 ? 's' : ''}
                  </summary>
                  {msg.citations.map((c, j) => (
                    <p key={j} style={{ marginTop: '4px', fontStyle: 'italic' }}>
                      "{c.text.substring(0, 150)}..."
                    </p>
                  ))}
                </details>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '12px 16px', background: 'white', borderRadius: '18px 18px 18px 4px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <span style={{ color: '#888' }}>Thinking...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{ borderTop: '1px solid #eee', padding: '16px', background: 'white' }}>
        {hasExchanges && (
          <button
            onClick={onGenerateWhitePaper}
            disabled={isGenerating}
            style={{
              width: '100%',
              padding: '10px',
              marginBottom: '12px',
              background: isGenerating ? '#e0e0e0' : 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
              color: isGenerating ? '#888' : 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
            }}
          >
            {isGenerating ? 'Generating White Paper...' : 'Generate White Paper'}
          </button>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px' }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about your document..."
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: '1.5px solid #e0e0e0',
              borderRadius: '8px',
              fontSize: '15px',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            style={{
              padding: '12px 20px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
              opacity: isLoading || !input.trim() ? 0.6 : 1,
              fontWeight: '600',
            }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
