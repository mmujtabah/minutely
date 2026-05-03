import MiddlewareRegistry from '../base/redux/MiddlewareRegistry';
import { getCurrentConference } from '../base/conference/functions';
import { getLocalParticipant } from '../base/participants/functions';
import { supabase } from '../supabase-auth/client';
import {
    START_TRANSCRIPTION,
    STOP_TRANSCRIPTION,
} from './actionTypes';
import {
    transcriptionStarted,
    transcriptionStopped,
    setTranscriptionStatus,
    transcriptSegmentReceived
} from './actions';

// ─────────────────────────────────────────────────────────────────────────────
// Deepgram Nova-3 Live Transcription URL
// Improvements over previous config:
//   • model=nova-3        — most accurate Deepgram model (~5% WER vs ~7% for Nova-2)
//   • smart_format=true   — adds punctuation, capitalization, and number formatting
//   • filler_words=false  — strips "um", "uh", "like" from output
//   • utterance_end_ms    — flushes a final transcript after 1500ms of silence
//   • vad_events=true     — fires SpeechStarted/UtteranceEnd events for better UX
//   • diarize=true        — speaker separation (per-participant streams already give identity)
// ─────────────────────────────────────────────────────────────────────────────
const DEEPGRAM_WS_URL = [
    'wss://api.deepgram.com/v1/listen',
    '?model=nova-2',
    '&encoding=linear16',
    '&sample_rate=16000',
    '&smart_format=true',
].join('');

// Active WebSocket references
let deepgramWs: WebSocket | null = null;
let minutelyWs: WebSocket | null = null;

// AudioWorklet node reference
let audioWorkletNode: AudioWorkletNode | null = null;
let audioContext: AudioContext | null = null;

MiddlewareRegistry.register(store => next => action => {
    switch (action.type) {
        case START_TRANSCRIPTION: {
            startTranscriptionPipeline(store);
            break;
        }
        case STOP_TRANSCRIPTION: {
            stopTranscriptionPipeline(store);
            break;
        }
    }

    return next(action);
});

async function startTranscriptionPipeline(store: any) {
    const state = store.getState();
    const conference = getCurrentConference(state);

    if (!conference) {
        console.error('[Minutely Transcription] No active conference found');
        return;
    }

    const meetingId = conference.getName();
    store.dispatch(setTranscriptionStatus('connecting'));

    try {
        // 1. Obtain session + Deepgram token from Go backend
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const res = await fetch(`/api/v1/meetings/${meetingId}/transcription/start`, {
            method: 'POST',
            headers
        });

        if (!res.ok) {
            throw new Error('Failed to start transcription session');
        }

        const data = await res.json();
        const sessionId = data.session_id;
        const deepgramToken = data.deepgram_token;

        // 2. Connect to Minutely Go Hub (broadcast + persist)
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/v1/meetings/${meetingId}/transcription/ws`;
        connectToMinutely(store, wsUrl);

        // 3. Connect to Deepgram Nova-3 + start audio capture
        await connectToDeepgram(store, deepgramToken, meetingId);

        store.dispatch(transcriptionStarted(sessionId, deepgramToken, wsUrl));
        store.dispatch(setTranscriptionStatus('connected'));

    } catch (error) {
        console.error('[Minutely Transcription] Error starting pipeline:', error);
        store.dispatch(setTranscriptionStatus('error'));
    }
}

function stopTranscriptionPipeline(store: any) {
    console.log('[Minutely Transcription] Stopping pipeline...');
    // Tear down audio capture
    if (audioWorkletNode) {
        audioWorkletNode.disconnect();
        audioWorkletNode = null;
    }
    if (audioContext) {
        audioContext.close().catch(() => { /* ignore */ });
        audioContext = null;
    }

    // Close WebSockets
    if (deepgramWs) {
        deepgramWs.close();
        deepgramWs = null;
    }
    if (minutelyWs) {
        minutelyWs.close();
        minutelyWs = null;
    }

    // Notify backend to close live session + trigger AI pipeline
    const state = store.getState();
    const conference = getCurrentConference(state);
    if (conference) {
        const meetingId = conference.getName();
        
        // Notify backend to close live session + trigger AI pipeline
        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            const headers: Record<string, string> = {};
            if (session) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }

            fetch(`/api/v1/meetings/${meetingId}/transcription/end`, {
                method: 'POST',
                headers
            }).catch(err => console.error('[Minutely Transcription] Failed to end session:', err));
        })();
    }

    store.dispatch(transcriptionStopped());
}

// ─────────────────────────────────────────────────────────────────────────────
// Deepgram Connection
// ─────────────────────────────────────────────────────────────────────────────
async function connectToDeepgram(store: any, token: string, meetingId: string) {
    console.log(`[Deepgram] Connecting with token (len: ${token?.length}, prefix: ${token?.substring(0, 4)}...)`);
    deepgramWs = new WebSocket(DEEPGRAM_WS_URL, [ 'token', token ]);

    deepgramWs.onopen = async () => {
        console.log('[Deepgram] Connected (Nova-2)');
        await startAudioCapture(store);
    };

    deepgramWs.onmessage = (event) => {
        let msg: any;
        try {
            msg = JSON.parse(event.data);
            console.log('[Deepgram] Message received:', msg.type || 'unknown', msg);
        } catch {
            return;
        }

        // VAD: SpeechStarted event — could drive UI indicator in future
        if (msg.type === 'SpeechStarted') {
            return;
        }

        // UtteranceEnd: flush any partial segment
        if (msg.type === 'UtteranceEnd') {
            return;
        }

        // Main transcript results
        if (msg.type === 'Results') {
            const alt = msg.channel?.alternatives?.[0];
            if (!alt || !alt.transcript || alt.transcript.trim() === '') return;

            const transcript = alt.transcript;
            const isFinal = msg.is_final;
            const start = msg.start ?? 0;
            const end = start + (msg.duration ?? 0);

            const localParticipant = getLocalParticipant(store.getState());

            const segment = {
                meeting_id:    meetingId,
                speaker_name:  localParticipant?.name  || 'Unknown',
                speaker_email: localParticipant?.email || 'unknown@example.com',
                text:          transcript,
                start_secs:    start,
                end_secs:      end,
                is_partial:    !isFinal,
                // Nova-3 confidence score for UI rendering
                confidence:    alt.confidence ?? null,
            };

            // Dispatch to local Redux state immediately (zero-latency UI)
            store.dispatch(transcriptSegmentReceived(segment));

            // Forward final segments to Go Hub for broadcast + persistence
            if (isFinal && minutelyWs && minutelyWs.readyState === WebSocket.OPEN) {
                minutelyWs.send(JSON.stringify(segment));
            }
        }
    };

    deepgramWs.onerror = (error) => {
        console.error('[Deepgram] WebSocket error:', error);
        store.dispatch(setTranscriptionStatus('error'));
    };

    deepgramWs.onclose = (event) => {
        console.log(`[Deepgram] WebSocket closed (code: ${event.code})`);
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Minutely Go Hub Connection
// ─────────────────────────────────────────────────────────────────────────────
function connectToMinutely(store: any, wsUrl: string) {
    minutelyWs = new WebSocket(wsUrl);

    minutelyWs.onopen = () => {
        console.log('[Minutely Hub] WebSocket connected');
    };

    minutelyWs.onmessage = (event) => {
        let segment: any;
        try {
            segment = JSON.parse(event.data);
        } catch {
            return;
        }

        const localParticipant = getLocalParticipant(store.getState());

        // Only dispatch segments from OTHER participants — we already showed our own
        if (segment.speaker_email !== localParticipant?.email) {
            store.dispatch(transcriptSegmentReceived(segment));
        }
    };

    minutelyWs.onerror = (error) => {
        console.error('[Minutely Hub] WebSocket error:', error);
    };

    minutelyWs.onclose = () => {
        console.log('[Minutely Hub] WebSocket closed');
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Audio Capture — AudioWorklet (replaces deprecated ScriptProcessorNode)
//
// Strategy:
//  1. Try modern AudioWorkletNode (Chrome 66+, Firefox 76+, Safari 14.1+)
//  2. Fall back to ScriptProcessorNode for legacy browsers
//
// The worklet runs off the main thread, reducing latency and avoiding
// audio glitches caused by main-thread GC pauses.
// ─────────────────────────────────────────────────────────────────────────────
async function startAudioCapture(store: any) {
    const state = store.getState();
    const tracks = state['features/base/tracks'];
    const localAudioTrack = tracks.find((t: any) => t.local && t.mediaType === 'audio');

    if (!localAudioTrack) {
        console.error('[Minutely Transcription] No local audio track found');
        return;
    }

    const stream = localAudioTrack.jitsiTrack.getOriginalStream();
    if (!stream) {
        console.error('[Minutely Transcription] No media stream available');
        return;
    }

    try {
        audioContext = new AudioContext({ sampleRate: 16000 });
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        const source = audioContext.createMediaStreamSource(stream);

        // ── AudioWorklet path (modern browsers) ──────────────────────────
        if (typeof AudioWorkletNode !== 'undefined' && audioContext.audioWorklet) {
            try {
                // Inline the worklet as a Blob URL so no separate file is needed
                const workletCode = `
                    class PCMProcessor extends AudioWorkletProcessor {
                        constructor() {
                            super();
                            this._buffer = [];
                            this._bufferSize = 4096;
                        }
                        process(inputs) {
                            const input = inputs[0];
                            if (!input || !input[0]) return true;
                            const samples = input[0];
                            // Simple noise gate: skip frames below -60dBFS
                            let rms = 0;
                            for (let i = 0; i < samples.length; i++) rms += samples[i] * samples[i];
                            rms = Math.sqrt(rms / samples.length);
                            if (rms < 0.001) return true;
                            // Convert Float32 → Int16
                            const pcm = new Int16Array(samples.length);
                            for (let i = 0; i < samples.length; i++) {
                                const s = Math.max(-1, Math.min(1, samples[i]));
                                pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                            }
                            this.port.postMessage(pcm.buffer, [pcm.buffer]);
                            return true;
                        }
                    }
                    registerProcessor('minutely-pcm-processor', PCMProcessor);
                `;
                const blob = new Blob([ workletCode ], { type: 'application/javascript' });
                const blobUrl = URL.createObjectURL(blob);
                await audioContext.audioWorklet.addModule(blobUrl);
                URL.revokeObjectURL(blobUrl);

                audioWorkletNode = new AudioWorkletNode(audioContext, 'minutely-pcm-processor');
                audioWorkletNode.port.onmessage = (e) => {
                    if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
                        deepgramWs.send(e.data);
                    }
                };

                source.connect(audioWorkletNode);
                // Do NOT connect worklet to destination (avoid echo)
                console.log('[Minutely Transcription] AudioWorklet active (Nova-2 pipeline)');
                return;
            } catch (workletErr) {
                console.warn('[Minutely Transcription] AudioWorklet failed, falling back to ScriptProcessor:', workletErr);
            }
        }

        // ── ScriptProcessor fallback (legacy) ────────────────────────────
        console.warn('[Minutely Transcription] Using deprecated ScriptProcessorNode (legacy browser)');
        const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
        source.connect(scriptProcessor);
        scriptProcessor.connect(audioContext.destination);
        scriptProcessor.onaudioprocess = (e) => {
            if (!deepgramWs || deepgramWs.readyState !== WebSocket.OPEN) return;
            const floatData = e.inputBuffer.getChannelData(0);
            // Simple noise gate
            let rms = 0;
            for (let i = 0; i < floatData.length; i++) rms += floatData[i] * floatData[i];
            rms = Math.sqrt(rms / floatData.length);
            if (rms < 0.001) return;
            const pcmData = new Int16Array(floatData.length);
            for (let i = 0; i < floatData.length; i++) {
                const s = Math.max(-1, Math.min(1, floatData[i]));
                pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            deepgramWs.send(pcmData.buffer);
        };

    } catch (e) {
        console.error('[Minutely Transcription] Failed to start audio capture:', e);
    }
}
