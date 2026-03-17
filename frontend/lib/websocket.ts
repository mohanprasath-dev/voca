export type MessageHandler = (message: VocaMessage) => void;
export type AudioHandler = (chunk: ArrayBuffer) => void;
export type ConnectionStatusHandler = (connected: boolean) => void;

export interface VocaMessage {
  type: 'persona_loaded' | 'transcript' | 'language_changed' | 'response' | 'escalation' | 'session_summary' | 'error';
  [key: string]: unknown;
}

class VocaWebSocket {
  private ws: WebSocket | null = null;
  private personaId: string | null = null;
  private onMessage: MessageHandler | null = null;
  private onAudio: AudioHandler | null = null;
  private onConnectionStatus: ConnectionStatusHandler | null = null;
  private _isConnected: boolean = false;
  private _latencyMs: number = 0;
  private speechStartTime: number | null = null;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT = 3;
  private readonly RECONNECT_DELAY_MS = 2000;
  private readonly STABLE_CONNECTION_MS = 1000;
  private reconnectTimer: number | null = null;
  private stabilityTimer: number | null = null;
  private connectedAt: number | null = null;
  private connectionInProgress: boolean = false;
  private allowReconnect: boolean = false;
  private intentionalClose: boolean = false;

  connect(
    personaId: string,
    onMessage: MessageHandler,
    onAudio: AudioHandler,
    onConnectionStatus?: ConnectionStatusHandler,
  ): void {
    const isSamePersona = this.personaId === personaId;

    this.personaId = personaId;
    this.onMessage = onMessage;
    this.onAudio = onAudio;
    this.onConnectionStatus = onConnectionStatus || null;
    this.intentionalClose = false;

    if (this.ws?.readyState === WebSocket.CONNECTING || this.connectionInProgress) {
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      if (!isSamePersona) {
        this.switchPersona(personaId);
      }
      this._isConnected = true;
      this.onConnectionStatus?.(true);
      return;
    }

    this.reconnectAttempts = 0;
    this.clearReconnectTimer();
    this._connect();
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearStabilityTimer(): void {
    if (this.stabilityTimer !== null) {
      window.clearTimeout(this.stabilityTimer);
      this.stabilityTimer = null;
    }
  }

  private _connect() {
    if (!this.personaId) return;
    if (this.ws?.readyState === WebSocket.CONNECTING || this.connectionInProgress) return;

    this.connectionInProgress = true;

    this.ws = new WebSocket(`ws://localhost:8000/ws/browser/${this.personaId}`);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      this._isConnected = true;
      this.onConnectionStatus?.(true);
      this.connectionInProgress = false;
      this.connectedAt = Date.now();
      this.allowReconnect = false;
      this.clearStabilityTimer();
      this.stabilityTimer = window.setTimeout(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.allowReconnect = true;
          this.reconnectAttempts = 0;
        }
      }, this.STABLE_CONNECTION_MS);
    };

    this.ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        if (this.onAudio) {
          this.onAudio(event.data);
        }
      } else if (typeof event.data === 'string') {
        try {
          const message = JSON.parse(event.data) as VocaMessage;
          
          if (message.type === 'response' && this.speechStartTime !== null) {
            this._latencyMs = Date.now() - this.speechStartTime;
            this.speechStartTime = null; // Reset until next speech
          }
          
          if (this.onMessage) {
            this.onMessage(message);
          }
        } catch (e) {
          console.error("Failed to parse VocaMessage JSON", e);
        }
      }
    };

    this.ws.onclose = (event) => {
      const connectionDuration = this.connectedAt === null ? 0 : Date.now() - this.connectedAt;
      const wasStableConnection = this.allowReconnect || connectionDuration >= this.STABLE_CONNECTION_MS;

      this._isConnected = false;
      this.onConnectionStatus?.(false);
      this.connectionInProgress = false;
      this.connectedAt = null;
      this.clearStabilityTimer();
      this.ws = null;

      if (this.intentionalClose || event.code === 1000) {
        this.intentionalClose = false;
        this.allowReconnect = false;
        return;
      }

      if (!wasStableConnection) {
        this.allowReconnect = false;
        this.reconnectAttempts = this.MAX_RECONNECT;
        return;
      }

      if (this.reconnectAttempts >= this.MAX_RECONNECT) {
        this.allowReconnect = false;
        return;
      }

      this.reconnectAttempts += 1;
      this.clearReconnectTimer();
      this.reconnectTimer = window.setTimeout(() => {
        this.reconnectTimer = null;
        this._connect();
      }, this.RECONNECT_DELAY_MS);
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket Error", error);
      this.onConnectionStatus?.(false);
    };
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.clearReconnectTimer();
    this.clearStabilityTimer();
    this.reconnectAttempts = this.MAX_RECONNECT;
    this.connectionInProgress = false;
    this.allowReconnect = false;

    if (this.ws) {
      this.ws.close(1000, 'User disconnected');
      this.ws = null;
    }

    this._isConnected = false;
    this.onConnectionStatus?.(false);
    this.connectedAt = null;
  }

  sendAudio(chunk: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(chunk);
    }
  }

  sendEndOfSpeech(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.speechStartTime = Date.now();
      this.ws.send(JSON.stringify({ type: 'end_of_speech' }));
    }
  }

  sendEndSession(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'end_session' }));
    }
  }

  switchPersona(personaId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.personaId = personaId;
      this.ws.send(JSON.stringify({ type: 'switch_persona', persona_id: personaId }));
    } else if (this.ws?.readyState !== WebSocket.CONNECTING && this.onMessage && this.onAudio) {
      this.connect(personaId, this.onMessage, this.onAudio);
    }
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  get latencyMs(): number {
    return this._latencyMs;
  }
}

export const vocaWS = new VocaWebSocket();