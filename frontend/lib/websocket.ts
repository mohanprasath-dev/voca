export type MessageHandler = (message: VocaMessage) => void;
export type AudioHandler = (chunk: ArrayBuffer) => void;

export interface VocaMessage {
  type: 'persona_loaded' | 'transcript' | 'language_changed' | 'response' | 'escalation' | 'error';
  [key: string]: unknown;
}

class VocaWebSocket {
  private ws: WebSocket | null = null;
  private personaId: string | null = null;
  private onMessage: MessageHandler | null = null;
  private onAudio: AudioHandler | null = null;
  private _isConnected: boolean = false;
  private _latencyMs: number = 0;
  private speechStartTime: number | null = null;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT = 3;

  connect(personaId: string, onMessage: MessageHandler, onAudio: AudioHandler): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.disconnect();
    }
    
    this.personaId = personaId;
    this.onMessage = onMessage;
    this.onAudio = onAudio;
    this.reconnectAttempts = 0;
    
    this._connect();
  }

  private _connect() {
    if (!this.personaId) return;

    this.ws = new WebSocket(`ws://localhost:8000/ws/browser/${this.personaId}`);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      this._isConnected = true;
      this.reconnectAttempts = 0;
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
      this._isConnected = false;
      if (event.code !== 1000 && this.reconnectAttempts < this.MAX_RECONNECT) {
        this.reconnectAttempts++;
        setTimeout(() => this._connect(), 1000 * this.reconnectAttempts);
      }
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket Error", error);
    };
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, "User disconnected");
      this.ws = null;
    }
    this._isConnected = false;
    this.reconnectAttempts = this.MAX_RECONNECT; // Prevent auto-reconnect
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

  switchPersona(personaId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.personaId = personaId;
      this.ws.send(JSON.stringify({ type: 'switch_persona', persona_id: personaId }));
    } else {
      // Reconnect with new persona
      if (this.onMessage && this.onAudio) {
        this.connect(personaId, this.onMessage, this.onAudio);
      }
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