import React, { useState, useEffect } from 'react';
import Navbar from './Navbar';
import TranscriptPanel from './TranscriptPanel';
import Sidebar from './Sidebar';
import { webSocketService } from '../services/websocketService';
import { apiService } from '../services/apiService';

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
              return {
                ...prev,
                chunks: [...prev.chunks, chunk],
                sessionStats: {
                  ...prev.sessionStats,
                  totalChunks: prev.sessionStats.totalChunks + 1,
                  currentChunk: chunk.chunk_id,
                  totalDuration: chunk.end_time,
                },
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
          setState(prev => ({ ...prev, error: error.message }));
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
