import React, { useRef, useEffect } from 'react';

const TranscriptPanel = ({ chunks, error, isLive = false }) => {
  const chunksEndRef = useRef(null);

  const scrollToBottom = () => {
    chunksEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chunks]);

  const formatTime = (seconds) => {
    if (seconds == null || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const getChunkText = (chunk) => {
    if (chunk.transcript && chunk.transcript.full_text) {
      return chunk.transcript.full_text;
    }
    if (typeof chunk.text === 'string') {
      return chunk.text;
    }
    return '';
  };

  const getSpeakers = (chunk) => {
    if (chunk.speakers && Array.isArray(chunk.speakers.speakers)) {
      return chunk.speakers.speakers;
    }
    return [];
  };

  return (
    <div className="card transcript-container">
      <div className="card-header">
        <div className="card-title">
          <span>🎙️</span>
          <span>{isLive ? 'Real-Time Live Transcript' : 'Meeting Transcript'}</span>
          {isLive && (
            <span style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '0.4rem', 
              fontSize: '0.75rem', 
              color: 'var(--ai-rose)',
              fontWeight: 600 
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--ai-rose)', animation: 'record-pulse 1.5s infinite' }} />
              STREAMING
            </span>
          )}
        </div>

        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {chunks.length} chunks processed
        </span>
      </div>

      <div className="transcript-scroll">
        {error && (
          <div style={{
            padding: '0.85rem 1rem',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#FCA5A5',
            fontSize: '0.875rem'
          }}>
            ⚠️ {error}
          </div>
        )}

        {chunks.length === 0 ? (
          <div className="empty-state" style={{ height: '100%', border: 'none' }}>
            <div className="empty-icon">🎙️</div>
            <div className="empty-title">Waiting for Speech...</div>
            <p className="empty-desc">
              Start a meeting session to begin streaming live audio chunks and speech-to-text transcription.
            </p>
          </div>
        ) : (
          chunks.map((chunk, index) => {
            const text = getChunkText(chunk);
            const speakers = getSpeakers(chunk);
            return (
              <div key={chunk.chunk_id ?? index} className="transcript-bubble">
                <div className="bubble-meta">
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span className="timestamp-tag">
                      {formatTime(chunk.start_time)} – {formatTime(chunk.end_time)}
                    </span>
                    {speakers.length > 0 && (
                      <span className="speaker-tag">
                        👤 {speakers.join(', ')}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Chunk #{chunk.chunk_id ?? index + 1}
                  </span>
                </div>

                <div className="bubble-text">
                  {text || <em style={{ opacity: 0.5 }}>No speech detected in this chunk</em>}
                </div>

                {chunk.micro_summary && (
                  <div className="bubble-summary">
                    💡 Summary: {chunk.micro_summary}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={chunksEndRef} />
      </div>
    </div>
  );
};

export default TranscriptPanel;
