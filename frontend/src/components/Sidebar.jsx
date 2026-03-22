import React from 'react';

const Sidebar = ({ emotions, speakers, technicalTerms, sessionStats }) => {
  return (
    <div className="sidebar">
      {/* Emotions Card */}
      <div className="card card-blue">
        <div className="card-header">
          <svg className="card-icon" viewBox="0 0 24 24" fill="var(--google-blue)">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <div className="card-title">Emotions</div>
        </div>
        <div className="card-content">
          {emotions && emotions.length > 0 ? (
            emotions.map((emotion, index) => (
              <div key={index} className="stat-item">
                <span className="stat-label">{emotion.name}</span>
                <span className="stat-value">{emotion.percentage}%</span>
              </div>
            ))
          ) : (
            <div className="empty-state">
              No emotion data available
            </div>
          )}
        </div>
      </div>

      {/* Speakers Card */}
      <div className="card card-green">
        <div className="card-header">
          <svg className="card-icon" viewBox="0 0 24 24" fill="var(--google-green)">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
          </svg>
          <div className="card-title">Speakers</div>
        </div>
        <div className="card-content">
          {speakers && speakers.length > 0 ? (
            speakers.map((speaker, index) => (
              <div key={index} className="speaker-item">
                <span className="speaker-name">{speaker.name}</span>
                <span className="speaker-count">{speaker.count}</span>
              </div>
            ))
          ) : (
            <div className="empty-state">
              No speakers detected
            </div>
          )}
        </div>
      </div>

      {/* Technical Terms Card */}
      <div className="card card-yellow">
        <div className="card-header">
          <svg className="card-icon" viewBox="0 0 24 24" fill="var(--google-yellow)">
            <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
          </svg>
          <div className="card-title">Technical Terms</div>
        </div>
        <div className="card-content">
          {technicalTerms && technicalTerms.length > 0 ? (
            technicalTerms.map((term, index) => (
              <div key={index} className="term-item">
                <span className="term-text">{term.term}</span>
                <span className="term-count">{term.frequency}</span>
              </div>
            ))
          ) : (
            <div className="empty-state">
              No technical terms detected
            </div>
          )}
        </div>
      </div>

      {/* Session Stats Card */}
      <div className="card card-red">
        <div className="card-header">
          <svg className="card-icon" viewBox="0 0 24 24" fill="var(--google-red)">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
          </svg>
          <div className="card-title">Session Stats</div>
        </div>
        <div className="card-content">
          <div className="stat-item">
            <span className="stat-label">Total Chunks</span>
            <span className="stat-value">{sessionStats?.totalChunks || 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Duration</span>
            <span className="stat-value">
              {sessionStats?.totalDuration ? 
                Math.floor(sessionStats.totalDuration / 60) + ':' + 
                String(Math.floor(sessionStats.totalDuration % 60)).padStart(2, '0') 
                : '0:00'}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Current Chunk</span>
            <span className="stat-value">{sessionStats?.currentChunk || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
