import React, { useRef, useEffect } from 'react';

const TranscriptPanel = ({ chunks, error }) => {
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

  /**
   * Safely extract the transcript text from a chunk.
   * The backend sends chunks as ProcessedChunk objects where the text lives at
   * `chunk.transcript.full_text`.  We also fall back to legacy `chunk.text`
   * for any older/simplified payloads.
   */
  const getChunkText = (chunk) => {
    if (chunk.transcript && chunk.transcript.full_text) {
      return chunk.transcript.full_text;
    }
    if (typeof chunk.text === 'string') {
      return chunk.text;
    }
    return '';
  };

  /**
   * Extract speaker labels from a chunk (if available).
   */
  const getSpeakers = (chunk) => {
    if (chunk.speakers && Array.isArray(chunk.speakers.speakers)) {
      return chunk.speakers.speakers;
    }
    return [];
  };

  return (
    <div className="transcript-panel">
      <div className="transcript-header">
        Live Transcript
      </div>
      
      <div className="transcript-content">
        {error && (
          <div className="error-toast">
            <svg className="error-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <div className="error-content">
              <div className="error-title">Connection Error</div>
              <div className="error-message">{error}</div>
            </div>
            <button className="error-close" onClick={() => {}}>
              ×
            </button>
          </div>
        )}
        
        {chunks.length === 0 ? (
          <div className="empty-state">
            No transcript available. Start a session to begin recording.
          </div>
        ) : (
          chunks.map((chunk, index) => {
            const text = getChunkText(chunk);
            const speakers = getSpeakers(chunk);
            return (
              <div key={chunk.chunk_id ?? index} className="transcript-chunk">
                <div className="chunk-meta">
                  <span className="chunk-timestamp">
                    {formatTime(chunk.start_time)} – {formatTime(chunk.end_time)}
                  </span>
                  {speakers.length > 0 && (
                    <span className="chunk-speakers">
                      {speakers.join(', ')}
                    </span>
                  )}
                </div>
                <div className="chunk-text">
                  {text || <em style={{ opacity: 0.5 }}>No speech detected</em>}
                </div>
                {chunk.micro_summary && (
                  <div className="chunk-summary">
                    Summary: {chunk.micro_summary}
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
