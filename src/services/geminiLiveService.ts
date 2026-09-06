/**
 * Gemini Live WebSocket Client Service
 * Powered by Gemini 3.5 Transcribe Live (gemini-3.5-transcribe-live)
 * Streams 16-bit PCM (16kHz mono) to server WebSocket gateway for real-time,
 * multilingual speech-to-text with SMART transcription and low-latency audio response.
 */

export type LiveSessionStatus = 
  | 'idle' 
  | 'requesting_permission' 
  | 'connecting' 
  | 'connected' 
  | 'setupComplete'
  | 'listening' 
  | 'processing'
  | 'speaking' 
  | 'reconnecting'
  | 'error' 
  | 'closed';

export interface LiveSessionCallbacks {
  onStatusChange: (status: LiveSessionStatus, message?: string) => void;
  onInterimTranscript?: (text: string) => void;
  onFinalTranscript?: (text: string, finished: boolean) => void;
  onTurnComplete?: (userText: string, modelText?: string) => void;
  onAudioLevel?: (level: number) => void; // 0 to 1 for visualizer
  onError: (error: string) => void;
}

export interface LiveSessionStartOptions {
  idToken?: string;
  customVocabulary?: string[];
}

export function float32To16BitPcmBase64(float32Array: Float32Array): string {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16Array.buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function pcmBase64ToAudioBuffer(
  base64: string,
  audioCtx: AudioContext
): AudioBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16Array = new Int16Array(bytes.buffer);
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7fff);
  }
  const buffer = audioCtx.createBuffer(1, float32Array.length, 24000);
  buffer.copyToChannel(float32Array, 0);
  return buffer;
}

export class GeminiLiveSession {
  private ws: WebSocket | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private nextStartTime = 0;
  private activeAudioSources: AudioBufferSourceNode[] = [];
  private callbacks: LiveSessionCallbacks;
  private isMuted = false;
  private isSpeaking = false;
  private currentModelText = '';
  private currentUserAccumulated = '';
  private isConnecting = false;
  private isSetupComplete = false;
  private isExplicitlyStopped = false;
  private speechAnimInterval: any = null;

  constructor(callbacks: LiveSessionCallbacks) {
    this.callbacks = callbacks;
  }

  public async start(options?: LiveSessionStartOptions): Promise<void> {
    // Prevent simultaneous duplicate connections
    if (this.isConnecting) {
      console.log('[Gemini Live] Connection attempt already in progress, skipping duplicate.');
      return;
    }

    // Clean up any existing active session before starting
    this.cleanup();
    this.isConnecting = true;
    this.isExplicitlyStopped = false;
    this.isSetupComplete = false;
    this.isSpeaking = false;
    this.currentUserAccumulated = '';
    this.currentModelText = '';

    console.log('[Gemini Live] Initializing Transcribe Live session...');

    try {
      this.callbacks.onStatusChange('requesting_permission', 'Requesting microphone access...');

      // 1. Request microphone access
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (permErr: any) {
        let msg = 'Microphone permission denied. Please allow microphone access to talk to Gemini.';
        if (permErr.name === 'NotFoundError' || permErr.name === 'DevicesNotFoundError') {
          msg = 'No microphone device found. Please connect a microphone and try again.';
        }
        console.warn('[Gemini Live] Microphone error:', permErr.name);
        this.callbacks.onStatusChange('error', msg);
        this.callbacks.onError(msg);
        this.cleanup();
        return;
      }

      this.callbacks.onStatusChange('connecting', 'Authenticating voice session...');

      // 2. Request single-use ephemeral ticket via Authorization: Bearer <idToken>
      let ticket = '';
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (options?.idToken) {
          headers['Authorization'] = `Bearer ${options.idToken}`;
        }

        const authRes = await fetch('/api/voice/session', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            customVocabulary: options?.customVocabulary || ['AuraJournal', 'journaling', 'mindfulness', 'reflection'],
          }),
        });

        if (!authRes.ok) {
          const errData = await authRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to authenticate voice session.');
        }

        const data = await authRes.json();
        ticket = data.ticket;
      } catch (authErr: any) {
        console.error('[Gemini Live] Ephemeral token failed:', authErr.message);
        this.callbacks.onStatusChange('error', authErr.message || 'Voice authentication failed');
        this.callbacks.onError(authErr.message || 'Voice authentication failed');
        this.cleanup();
        return;
      }

      this.callbacks.onStatusChange('connecting', 'Connecting to Gemini Live...');

      // 3. Initialize AudioContexts
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.inputAudioCtx = new AudioCtxClass({ sampleRate: 16000 });
      this.outputAudioCtx = new AudioCtxClass({ sampleRate: 24000 });

      if (this.inputAudioCtx.state === 'suspended') {
        await this.inputAudioCtx.resume();
      }
      if (this.outputAudioCtx.state === 'suspended') {
        await this.outputAudioCtx.resume();
      }

      // 4. Connect to Server WebSocket using single-use ticket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live?ticket=${encodeURIComponent(ticket)}`;
      console.log('[Gemini Live] Connecting to WebSocket gateway at /api/live');
      
      const newWs = new WebSocket(wsUrl);
      this.ws = newWs;

      newWs.onopen = () => {
        if (this.ws !== newWs || this.isExplicitlyStopped) return;
        console.log('[Gemini Live] WebSocket opened. Waiting for setupComplete from Transcribe Live API...');
        this.callbacks.onStatusChange('connected', 'Connected. Initializing session...');
      };

      newWs.onmessage = (event) => {
        if (this.ws !== newWs || this.isExplicitlyStopped) return;
        try {
          const msg = JSON.parse(event.data);
          this.handleServerMessage(msg);
        } catch (e) {
          // Ignore non-JSON or malformed packets
        }
      };

      newWs.onerror = () => {
        if (this.ws !== newWs || this.isExplicitlyStopped) return;
        console.warn('[Gemini Live] WebSocket connection error/closed');
        this.callbacks.onStatusChange('error', 'WebSocket connection error');
        this.callbacks.onError('Could not establish real-time connection with Gemini Live server.');
      };

      newWs.onclose = () => {
        if (this.ws !== newWs || this.isExplicitlyStopped) return;
        console.log('[Gemini Live] WebSocket closed');
        this.callbacks.onStatusChange('closed', 'Voice session ended');
        this.cleanup();
      };
    } catch (err: any) {
      console.error('[Gemini Live] Start session failed:', err.message);
      this.callbacks.onStatusChange('error', err.message || 'Failed to start Live session');
      this.callbacks.onError(err.message || 'Failed to start Live session');
      this.cleanup();
    } finally {
      this.isConnecting = false;
    }
  }

  private startMicStreaming() {
    if (!this.inputAudioCtx || !this.mediaStream) return;

    try {
      this.sourceNode = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);
      // Buffer size 2048 gives 128ms chunks for very low latency live streaming
      this.scriptProcessor = this.inputAudioCtx.createScriptProcessor(2048, 1, 1);

      this.sourceNode.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.inputAudioCtx.destination);

      this.scriptProcessor.onaudioprocess = (e) => {
        // Echo prevention: pause mic streaming while AI response is actively playing
        if (this.isMuted || !this.isSetupComplete || this.isSpeaking) return;
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const channelData = e.inputBuffer.getChannelData(0);

        // Calculate audio energy level for visualizer
        let sum = 0;
        for (let i = 0; i < channelData.length; i++) {
          sum += channelData[i] * channelData[i];
        }
        const rms = Math.sqrt(sum / channelData.length);
        const level = Math.min(1, rms * 6);
        if (this.callbacks.onAudioLevel) {
          this.callbacks.onAudioLevel(level);
        }

        // Convert to 16-bit PCM little endian base64
        const base64 = float32To16BitPcmBase64(channelData);
        try {
          this.ws.send(JSON.stringify({ type: 'audio', audio: base64 }));
        } catch {
          // Socket might have closed during processing
        }
      };
    } catch (err: any) {
      console.error('[Gemini Live] Microphone streaming error:', err.message);
    }
  }

  private handleServerMessage(msg: any) {
    if (msg.type === 'setupComplete') {
      console.log('[Gemini Live] Setup complete signal received from backend.');
      this.isSetupComplete = true;
      this.callbacks.onStatusChange('setupComplete', 'Gemini Live ready');
      this.startMicStreaming();
      this.callbacks.onStatusChange('listening', 'Listening to you...');
      return;
    }

    // Live speculative interim transcription
    if (msg.type === 'interimTranscript' && typeof msg.text === 'string') {
      if (this.callbacks.onInterimTranscript) {
        this.callbacks.onInterimTranscript(msg.text);
      }
    }

    // Finalized smart transcript segment
    if (msg.type === 'finalTranscript' && typeof msg.text === 'string') {
      this.currentUserAccumulated = (this.currentUserAccumulated ? this.currentUserAccumulated + ' ' : '') + msg.text.trim();
      if (this.callbacks.onFinalTranscript) {
        this.callbacks.onFinalTranscript(msg.text, !!msg.finished);
      }
    }

    // Backward compatibility with audio/text chunk from server if emitted
    if (msg.type === 'audio' && msg.audio) {
      this.callbacks.onStatusChange('speaking', 'Gemini is speaking...');
      this.playAudioChunk(msg.audio);
    }

    if (msg.type === 'text' && msg.text) {
      this.currentModelText += msg.text;
    }

    if (msg.type === 'interrupted') {
      this.stopPlayback();
      this.callbacks.onStatusChange('listening', 'Listening to you...');
    }

    if (msg.type === 'turnComplete') {
      const finalText = this.currentUserAccumulated.trim();
      if (this.callbacks.onTurnComplete && (finalText || this.currentModelText)) {
        this.callbacks.onTurnComplete(finalText, this.currentModelText);
      }
      this.currentUserAccumulated = '';
      this.currentModelText = '';
    }

    if (msg.type === 'error') {
      console.error('[Gemini Live] Server returned error:', msg.error);
      this.callbacks.onStatusChange('error', msg.error);
      this.callbacks.onError(msg.error);
    }
  }

  /**
   * Natural speech synthesis output for Gemini Journal response
   * Speaks response text empathetically, animates the sound wave,
   * and cleanly transitions back to listening for the next turn.
   */
  public playAudioResponse(text: string, onEnd?: () => void): void {
    if (
      typeof window === 'undefined' ||
      !('speechSynthesis' in window) ||
      typeof SpeechSynthesisUtterance === 'undefined' ||
      !text ||
      !text.trim()
    ) {
      this.isSpeaking = false;
      if (onEnd) onEnd();
      return;
    }

    try {
      this.stopPlayback();
      this.isSpeaking = true;
      try {
        window.speechSynthesis.cancel();
      } catch {}

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      let voices: SpeechSynthesisVoice[] = [];
      try {
        voices = window.speechSynthesis.getVoices() || [];
      } catch {}
      const preferredVoice = voices.find(
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.includes('Natural') ||
            v.name.includes('Google') ||
            v.name.includes('Samantha') ||
            v.name.includes('Daniel') ||
            v.name.includes('Alex'))
      );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

    this.callbacks.onStatusChange('speaking', 'Gemini is speaking...');

    // Dynamic wave animation while speaking
    if (this.speechAnimInterval) clearInterval(this.speechAnimInterval);
    this.speechAnimInterval = setInterval(() => {
      if (this.callbacks.onAudioLevel) {
        this.callbacks.onAudioLevel(0.15 + Math.random() * 0.45);
      }
    }, 120);

    const finishSpeaking = () => {
      this.isSpeaking = false;
      if (this.speechAnimInterval) {
        clearInterval(this.speechAnimInterval);
        this.speechAnimInterval = null;
      }
      if (this.callbacks.onAudioLevel) {
        this.callbacks.onAudioLevel(0);
      }
      if (onEnd) onEnd();
    };

    utterance.onend = () => finishSpeaking();
    utterance.onerror = () => finishSpeaking();

    window.speechSynthesis.speak(utterance);
    } catch {
      this.isSpeaking = false;
      if (onEnd) onEnd();
    }
  }

  private playAudioChunk(base64: string) {
    if (!this.outputAudioCtx) return;

    try {
      const buffer = pcmBase64ToAudioBuffer(base64, this.outputAudioCtx);
      const source = this.outputAudioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.outputAudioCtx.destination);

      const currentTime = this.outputAudioCtx.currentTime;
      // Schedule audio chunks precisely for gapless playback
      const startTime = Math.max(currentTime, this.nextStartTime);
      source.start(startTime);
      this.nextStartTime = startTime + buffer.duration;

      this.activeAudioSources.push(source);

      source.onended = () => {
        const idx = this.activeAudioSources.indexOf(source);
        if (idx !== -1) {
          this.activeAudioSources.splice(idx, 1);
        }
        if (this.activeAudioSources.length === 0 && this.outputAudioCtx && this.outputAudioCtx.currentTime >= this.nextStartTime) {
          this.callbacks.onStatusChange('listening', 'Listening to you...');
        }
      };
    } catch (e) {
      console.error('[Audio Playback Error]', e);
    }
  }

  public stopPlayback() {
    this.isSpeaking = false;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this.speechAnimInterval) {
      clearInterval(this.speechAnimInterval);
      this.speechAnimInterval = null;
    }
    for (const src of this.activeAudioSources) {
      try {
        src.stop();
      } catch {}
    }
    this.activeAudioSources = [];
    if (this.outputAudioCtx) {
      this.nextStartTime = this.outputAudioCtx.currentTime;
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.callbacks.onStatusChange('listening', 'Microphone Muted');
    } else {
      this.callbacks.onStatusChange('listening', 'Listening to you...');
    }
    return this.isMuted;
  }

  public sendText(text: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && text.trim()) {
      this.currentUserAccumulated = text.trim();
      try {
        this.ws.send(JSON.stringify({ type: 'text', text: text.trim() }));
      } catch (e) {
        console.warn('[Gemini Live] Failed to send text:', e);
      }
    }
  }

  public stop(): void {
    this.isExplicitlyStopped = true;
    this.cleanup();
    this.callbacks.onStatusChange('idle', 'Voice session ended');
  }

  private cleanup(): void {
    this.isSpeaking = false;
    this.stopPlayback();

    if (this.scriptProcessor) {
      try {
        this.scriptProcessor.disconnect();
      } catch {}
      this.scriptProcessor = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      this.mediaStream = null;
    }

    if (this.inputAudioCtx && this.inputAudioCtx.state !== 'closed') {
      try {
        this.inputAudioCtx.close();
      } catch {}
      this.inputAudioCtx = null;
    }

    if (this.outputAudioCtx && this.outputAudioCtx.state !== 'closed') {
      try {
        this.outputAudioCtx.close();
      } catch {}
      this.outputAudioCtx = null;
    }

    if (this.ws) {
      const socket = this.ws;
      this.ws = null;

      // Nullify all event handlers immediately to prevent callbacks on closed/closing socket
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;

      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'end' }));
          socket.close(1000, 'Session stopped');
        } else if (socket.readyState === WebSocket.CONNECTING) {
          socket.onopen = () => {
            try {
              socket.close(1000, 'Closed after open');
            } catch {}
          };
          socket.onerror = () => {};
          try {
            socket.close(1000, 'Aborted while connecting');
          } catch {}
        }
      } catch {}
    }
  }
}
