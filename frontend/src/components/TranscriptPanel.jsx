import React, { useRef, useEffect } from 'react';
import { MicIcon, AlertCircleIcon, SparklesIcon } from './Icons';

const TranscriptPanel = ({ chunks, error, isLive = false }) => {
  const chunksEndRef = useRef(null);

  useEffect(() => {
    chunksEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  const getPrimaryEmotion = (chunk) => {
    if (!chunk.emotions || typeof chunk.emotions !== 'object') return null;
    const first = Object.values(chunk.emotions)[0];
    if (!first || !first.dominant_emotion) return null;
    return first.dominant_emotion;
  };

  const renderHighlightedText = (text, jargonList) => {
    if (!text) {
      return <em style={{ opacity: 0.55 }}>No speech detected in this chunk</em>;
    }
    if (!Array.isArray(jargonList) || jargonList.length === 0) {
      return text;
    }

    const terms = jargonList
      .map((j) => (j.term || '').trim())
      .filter((t) => t.length >= 2)
      .slice(0, 6);

    if (terms.length === 0) return text;

    const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) => {
      const isMatch = terms.some((t) => t.toLowerCase() === part.toLowerCase());
      return isMatch ? (
        <mark key={i} className="jargon-highlight">
          {part}
        </mark>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      );
    });
  };

  return (
    <div className="card transcript-container">
      <div className="card-header">
        <div className="card-title">
          <MicIcon size={17} />
          <span>{isLive ? 'Real-Time Transcript Stream' : 'Meeting Transcript'}</span>
          {isLive && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.72rem',
                color: 'var(--ai-rose)',
                fontWeight: 700,
                padding: '0.15rem 0.55rem',
                borderRadius: '999px',
                background: 'rgba(239, 68, 68, 0.12)',
              }}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--ai-rose)',
                  animation: 'record-pulse 1.5s infinite',
                }}
              />
              LIVE
            </span>
          )}
        </div>

        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          {chunks.length} {chunks.length === 1 ? 'chunk' : 'chunks'}
        </span>
      </div>

      <div className="transcript-scroll">
        {error && (
          <div
            style={{
              padding: '0.8rem 1rem',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--ai-rose)',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <AlertCircleIcon size={16} />
            <span>{error}</span>
          </div>
        )}

        {chunks.length === 0 ? (
          <div className="empty-state" style={{ height: '100%', border: 'none', background: 'transparent' }}>
            <div className="empty-icon">
              <MicIcon size={22} />
            </div>
            <div className="empty-title">Waiting for Speech...</div>
            <p className="empty-desc">
              Start a meeting session to begin streaming live audio chunks and speech-to-text transcription.
            </p>
          </div>
        ) : (
          chunks.map((chunk, index) => {
            const text = getChunkText(chunk);
            const emotion = getPrimaryEmotion(chunk);
            return (
              <div key={chunk.chunk_id ?? index} className="transcript-bubble">
                <div className="bubble-meta">
                  <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                    <span className="timestamp-tag">
                      {formatTime(chunk.start_time)} – {formatTime(chunk.end_time)}
                    </span>
                    {emotion && <span className="emotion-chip">{emotion}</span>}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Chunk #{(chunk.chunk_id ?? index) + 1}
                  </span>
                </div>

                <div className="bubble-text">
                  {renderHighlightedText(text, chunk.jargon)}
                </div>

                {chunk.micro_summary && (
                  <div
                    style={{
                      marginTop: '0.55rem',
                      paddingTop: '0.5rem',
                      borderTop: '1px solid var(--border-subtle)',
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    <SparklesIcon size={13} />
                    <span>{chunk.micro_summary}</span>
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
