import React, { useState, useEffect } from 'react';
import Navbar from './Navbar';
import TranscriptPanel from './TranscriptPanel';
import Sidebar from './Sidebar';
import { webSocketService } from '../services/websocketService';
import { apiService } from '../services/apiService';

/**
 * Derive sidebar-friendly emotion data from the accumulated chunks.
 * The backend sends emotions per speaker per chunk as:
 *   chunk.emotions = { "Speaker_1": { dominant_emotion, confidence, all_emotions } }
 *
 * We aggregate dominant_emotion counts across all chunks and convert to percentages.
 */
const deriveEmotions = (chunks) => {
  const counts = {};
  let total = 0;

  chunks.forEach((chunk) => {
    if (chunk.emotions && typeof chunk.emotions === 'object') {
      Object.values(chunk.emotions).forEach((emotionData) => {
        const emotion = emotionData?.dominant_emotion;
        if (emotion) {
          counts[emotion] = (counts[emotion] || 0) + 1;
          total += 1;
        }
      });
    }
  });

  return Object.entries(counts).map(([name, count]) => ({
    name,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0,
  }));
};

/**
 * Derive sidebar-friendly speaker data from accumulated chunks.
 * Count how many chunks each speaker appears in.
 */
const deriveSpeakers = (chunks) => {
  const counts = {};

  chunks.forEach((chunk) => {
    if (chunk.speakers && Array.isArray(chunk.speakers.speakers)) {
      chunk.speakers.speakers.forEach((speaker) => {
        counts[speaker] = (counts[speaker] || 0) + 1;
      });
    }
  });

  return Object.entries(counts).map(([name, count]) => ({ name, count }));
};

/**
 * Derive sidebar-friendly technical-terms data from accumulated chunks.
 * Deduplicate by term (case-insensitive) and track frequency.
 */
const deriveTerms = (chunks) => {
  const map = {};

  chunks.forEach((chunk) => {
    if (Array.isArray(chunk.jargon)) {
      chunk.jargon.forEach((j) => {
        const key = (j.term || '').toLowerCase();
        if (key) {
          if (!map[key]) {
            map[key] = { term: j.term, frequency: 0, definition: j.definition || '' };
          }
          map[key].frequency += 1;
        }
      });
    }
  });

  return Object.values(map).sort((a, b) => b.frequency - a.frequency);
};

const Dashboard = () => {
  const [state, setState] = useState({
    isConnected: false,
    currentSession: null,
    sessionStatus: 'idle',
    chunks: [],
    finalSummary: null,
    statusMessages: [],
    error: null,
    sessionStats: {
      totalChunks: 0,
      totalDuration: 0,
      currentChunk: 0,
    },
    emotions: [],
    speakers: [],
    technicalTerms: [],
  });

  const [showStartDialog, setShowStartDialog] = useState(false);
  const [sessionName, setSessionName] = useState('');

  useEffect(() => {
    const initializeConnection = async () => {
      try {
        await webSocketService.connect();

        webSocketService.onConnected(() => {
          setState(prev => ({ ...prev, isConnected: true, error: null }));
        });

        webSocketService.onDisconnected(() => {
          setState(prev => ({ ...prev, isConnected: false }));
        });

        webSocketService.onChunkUpdate((sessionId, chunk) => {
          console.log('Received chunk update:', { sessionId, chunk });
          setState(prev => {
            if (sessionId === prev.currentSession) {
              const newChunks = [...prev.chunks, chunk];
              return {
                ...prev,
                chunks: newChunks,
                sessionStats: {
                  ...prev.sessionStats,
                  totalChunks: prev.sessionStats.totalChunks + 1,
                  currentChunk: chunk.chunk_id,
                  totalDuration: chunk.end_time,
                },
                // Re-derive sidebar data from accumulated chunks
                emotions: deriveEmotions(newChunks),
                speakers: deriveSpeakers(newChunks),
                technicalTerms: deriveTerms(newChunks),
              };
            }
            return prev;
          });
        });

        webSocketService.onSummaryUpdate((sessionId, summary) => {
          console.log('Received summary update:', { sessionId, summary });
          setState(prev => {
            if (sessionId === prev.currentSession) {
              return {
                ...prev,
                finalSummary: summary,
                sessionStatus: 'completed',
              };
            }
            return prev;
          });
        });

        webSocketService.onEmotionUpdate((sessionId, emotions) => {
          console.log('Received emotion update:', { sessionId, emotions });
          setState(prev => {
            if (sessionId === prev.currentSession) {
              return { ...prev, emotions };
            }
            return prev;
          });
        });

        webSocketService.onSpeakerUpdate((sessionId, speakers) => {
          console.log('Received speaker update:', { sessionId, speakers });
          setState(prev => {
            if (sessionId === prev.currentSession) {
              return { ...prev, speakers };
            }
            return prev;
          });
        });

        webSocketService.onTechnicalTermsUpdate((sessionId, terms) => {
          console.log('Received technical terms update:', { sessionId, terms });
          setState(prev => {
            if (sessionId === prev.currentSession) {
              return { ...prev, technicalTerms: terms };
            }
            return prev;
          });
        });

        webSocketService.onError((error) => {
          setState(prev => ({ ...prev, error: typeof error === 'string' ? error : error?.message || 'Unknown error' }));
        });

      } catch (error) {
        setState(prev => ({ ...prev, error: 'Failed to connect to WebSocket service' }));
      }
    };

    initializeConnection();

    return () => {
      webSocketService.disconnect();
    };
  }, []);

  const handleStartSession = async () => {
    try {
      const sessionData = {
        name: sessionName || `Session ${new Date().toISOString()}`,
        language: 'en',
      };

      const response = await apiService.startSession(sessionData);
      
      setState(prev => ({
        ...prev,
        currentSession: response.session_id,
        sessionStatus: 'recording',
        chunks: [],
        finalSummary: null,
        error: null,
        sessionStats: {
          totalChunks: 0,
          totalDuration: 0,
          currentChunk: 0,
        },
        emotions: [],
        speakers: [],
        technicalTerms: [],
      }));

      // Subscribe to WebSocket session for real-time updates
      webSocketService.subscribeToSession(response.session_id);

      setShowStartDialog(false);
      setSessionName('');
    } catch (error) {
      setState(prev => ({ ...prev, error: 'Failed to start session' }));
    }
  };

  const handleStopSession = async () => {
    try {
      if (state.currentSession) {
        // Unsubscribe from WebSocket session
        webSocketService.unsubscribeFromSession(state.currentSession);
        
        await apiService.stopSession(state.currentSession);
        
        setState(prev => ({
          ...prev,
          sessionStatus: 'completed',
        }));
      }
    } catch (error) {
      setState(prev => ({ ...prev, error: 'Failed to stop session' }));
    }
  };

  return (
    <div className="dashboard">
      <Navbar 
        isConnected={state.isConnected}
        onStartSession={() => setShowStartDialog(true)}
        onStopSession={handleStopSession}
        sessionStatus={state.sessionStatus}
      />
      
      <div className="main-content">
        <TranscriptPanel 
          chunks={state.chunks}
          error={state.error}
        />
        
        <Sidebar 
          emotions={state.emotions}
          speakers={state.speakers}
          technicalTerms={state.technicalTerms}
          sessionStats={state.sessionStats}
        />
      </div>

      {/* Start Session Dialog */}
      {showStartDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--white)',
            padding: '2rem',
            borderRadius: '0px',
            border: '3px solid var(--black)',
            minWidth: '400px',
            maxWidth: '90%'
          }}>
            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '1.5rem',
              color: 'var(--black)'
            }}>
              Start New Session
            </h2>
            
            <input
              type="text"
              placeholder="Enter session name (optional)"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid var(--gray-300)',
                borderRadius: '0px',
                fontSize: '1rem',
                marginBottom: '1.5rem',
                fontFamily: 'Inter, sans-serif'
              }}
            />
            
            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => {
                  setShowStartDialog(false);
                  setSessionName('');
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: '2px solid var(--gray-300)',
                  backgroundColor: 'transparent',
                  borderRadius: '0px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              
              <button
                onClick={handleStartSession}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: '2px solid var(--google-green)',
                  backgroundColor: 'var(--google-green)',
                  color: 'var(--white)',
                  borderRadius: '0px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  cursor: 'pointer'
                }}
              >
                Start Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
