import React, { useRef, useState } from 'react';

interface FileUploadProps {
  onFile: (file: File) => void;
  isLoading: boolean;
}

const ACCEPTED_TYPES = ['.xlsx', '.xls', '.pdf', '.csv', '.docx'];

export default function FileUpload({ onFile, isLoading }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => !isLoading && inputRef.current?.click()}
      style={{
        border: `2px dashed ${isDragging ? '#667eea' : '#d0d0d0'}`,
        borderRadius: '12px',
        padding: '60px 40px',
        textAlign: 'center',
        cursor: isLoading ? 'not-allowed' : 'pointer',
        background: isDragging ? '#f0f0ff' : 'white',
        transition: 'all 0.2s',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleChange}
        style={{ display: 'none' }}
        disabled={isLoading}
      />
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: '#333' }}>
        {isLoading ? 'Uploading...' : 'Drop your file here'}
      </h3>
      <p style={{ color: '#888', fontSize: '14px' }}>
        {isLoading ? 'Please wait' : 'or click to browse'}
      </p>
      <p style={{ color: '#aaa', fontSize: '12px', marginTop: '12px' }}>
        Supports: PDF, Excel (.xlsx, .xls), CSV, Word (.docx)
      </p>
    </div>
  );
}
