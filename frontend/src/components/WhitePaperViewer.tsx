import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface WhitePaperViewerProps {
  content: string;
  onDownload: () => void;
}

export default function WhitePaperViewer({ content, onDownload }: WhitePaperViewerProps) {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px', gap: '12px' }}>
        <button
          onClick={onDownload}
          style={{
            padding: '10px 20px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
          }}
        >
          Download .md
        </button>
        <button
          onClick={() => window.print()}
          style={{
            padding: '10px 20px',
            background: 'white',
            color: '#333',
            border: '1.5px solid #e0e0e0',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Print
        </button>
      </div>

      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '48px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        lineHeight: '1.7',
      }}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '24px', color: '#1a1a2e', borderBottom: '2px solid #667eea', paddingBottom: '12px' }}>
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 style={{ fontSize: '22px', fontWeight: '600', marginTop: '32px', marginBottom: '16px', color: '#2d2d44' }}>
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginTop: '24px', marginBottom: '12px', color: '#444' }}>
                {children}
              </h3>
            ),
            p: ({ children }) => (
              <p style={{ marginBottom: '16px', color: '#333', fontSize: '15px' }}>{children}</p>
            ),
            blockquote: ({ children }) => (
              <blockquote style={{
                borderLeft: '4px solid #667eea',
                paddingLeft: '16px',
                margin: '16px 0',
                color: '#555',
                fontStyle: 'italic',
                background: '#f8f8ff',
                padding: '12px 16px',
                borderRadius: '0 8px 8px 0',
              }}>
                {children}
              </blockquote>
            ),
            ul: ({ children }) => (
              <ul style={{ paddingLeft: '24px', marginBottom: '16px' }}>{children}</ul>
            ),
            ol: ({ children }) => (
              <ol style={{ paddingLeft: '24px', marginBottom: '16px' }}>{children}</ol>
            ),
            li: ({ children }) => (
              <li style={{ marginBottom: '8px', color: '#333' }}>{children}</li>
            ),
            table: ({ children }) => (
              <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  {children}
                </table>
              </div>
            ),
            th: ({ children }) => (
              <th style={{ padding: '10px 14px', background: '#667eea', color: 'white', textAlign: 'left', borderBottom: '2px solid #5268d4' }}>
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td style={{ padding: '10px 14px', borderBottom: '1px solid #eee' }}>{children}</td>
            ),
            code: ({ children, className }) => {
              const isBlock = className?.includes('language-');
              if (isBlock) {
                return (
                  <pre style={{ background: '#f5f5f5', padding: '16px', borderRadius: '8px', overflowX: 'auto', marginBottom: '16px' }}>
                    <code style={{ fontSize: '13px', color: '#333' }}>{children}</code>
                  </pre>
                );
              }
              return <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: '4px', fontSize: '13px' }}>{children}</code>;
            },
            hr: () => <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '32px 0' }} />,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
