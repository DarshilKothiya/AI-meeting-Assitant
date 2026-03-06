/**
 * WebSocket service for real-time communication with the backend
 * Uses native browser WebSocket API (backend is FastAPI native WS, not Socket.IO)
 */

const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws';

class WebSocketService {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this._manualClose = false;

    this.onConnectedHandler = null;
    this.onDisconnectedHandler = null;
    this.onChunkUpdateHandler = null;
    this.onSummaryUpdateHandler = null;
    this.onStatusUpdateHandler = null;
    this.onErrorHandler = null;
  }

  connect(url = WS_URL) {
    this._url = url;
    this._manualClose = false;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('Connected to WebSocket server');
          this.reconnectAttempts = 0;
          this.onConnectedHandler?.();
          resolve();
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          this.onDisconnectedHandler?.();

          if (!this._manualClose) {
            this._scheduleReconnect();
          }
        };

        this.ws.onerror = (event) => {
          console.error('WebSocket error:', event);
          const msg = 'WebSocket connection error';
          this.onErrorHandler?.(msg);
          // Only reject on the first connection attempt
          if (this.reconnectAttempts === 0) {
            reject(new Error(msg));
          }
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this._handleMessage(message);
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  _handleMessage(message) {
    console.log('Received WebSocket message:', message);

    switch (message.type) {
      case 'connection':
        if (message.status === 'connected') {
          console.log('WebSocket connection confirmed, client_id:', message.client_id);
        }
        break;

      case 'chunk_update':
        if (message.session_id && message.chunk) {
          this.onChunkUpdateHandler?.(message.session_id, message.chunk);
        }
        break;

      case 'summary_update':
        if (message.session_id && message.summary) {
          this.onSummaryUpdateHandler?.(message.session_id, message.summary);
        }
        break;

      case 'status':
        this.onStatusUpdateHandler?.(message.session_id, message.status, message.details);
        break;

      case 'heartbeat':
        // Respond to server heartbeat
        this.send({ type: 'heartbeat' });
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }

  _scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      this.onErrorHandler?.('Connection lost. Please refresh the page.');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      if (!this._manualClose) {
        this.connect(this._url).catch(() => {});
      }
    }, delay);
  }

  disconnect() {
    this._manualClose = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket not connected');
    }
  }

  subscribeToSession(sessionId) {
    this.send({ type: 'subscribe', session_id: sessionId });
  }

  unsubscribeFromSession(sessionId) {
    this.send({ type: 'unsubscribe', session_id: sessionId });
  }

  onConnected(handler) { this.onConnectedHandler = handler; }
  onDisconnected(handler) { this.onDisconnectedHandler = handler; }
  onChunkUpdate(handler) { this.onChunkUpdateHandler = handler; }
  onSummaryUpdate(handler) { this.onSummaryUpdateHandler = handler; }
  onStatusUpdate(handler) { this.onStatusUpdateHandler = handler; }
  onError(handler) { this.onErrorHandler = handler; }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const webSocketService = new WebSocketService();
