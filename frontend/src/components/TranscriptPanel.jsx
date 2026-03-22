import React, { useRef, useEffect } from 'react';
import moment from 'moment';

const TranscriptPanel = ({ chunks, error }) => {
  const chunksEndRef = useRef(null);

  const scrollToBottom = () => {
    chunksEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chunks]);

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
          chunks.map((chunk, index) => (
            <div key={chunk.chunk_id || index} className="transcript-chunk">
              <div className="chunk-timestamp">
                {moment(chunk.start_time * 1000).format('HH:mm:ss')} - {moment(chunk.end_time * 1000).format('HH:mm:ss')}
              </div>
              <div className="chunk-text">
                {chunk.text}
              </div>
            </div>
          ))
        )}
        <div ref={chunksEndRef} />
      </div>
    </div>
  );
};

export default TranscriptPanel;
