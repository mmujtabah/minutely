import MiddlewareRegistry from '../base/redux/MiddlewareRegistry';
import { getCurrentConference } from '../base/conference/functions';
import { getLocalParticipant } from '../base/participants/functions';
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

// References to active WebSockets
let deepgramWs: WebSocket | null = null;
let minutelyWs: WebSocket | null = null;

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
        console.error('No active conference found');
        return;
    }
    
    // We get the room name (acting as meeting ID for now, though later it should be the actual Minutely meeting ID)
    const meetingId = conference.getName();

    store.dispatch(setTranscriptionStatus('connecting'));

    try {
        // 1. Call Go backend to start session
        // Note: You might need to pass auth tokens here depending on your middleware
        const res = await fetch(`/api/v1/meetings/${meetingId}/transcription/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!res.ok) {
            throw new Error('Failed to start transcription session');
        }

        const data = await res.json();
        const sessionId = data.session_id;
        const deepgramToken = data.deepgram_token;

        // The WebSocket URL for our Go Hub
        // Assumes the frontend is served on the same origin or handled by proxy
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/v1/meetings/${meetingId}/transcription/ws`;

        // 2. Connect to Deepgram
        connectToDeepgram(store, deepgramToken, meetingId);

        // 3. Connect to Minutely Go Backend
        connectToMinutely(store, wsUrl);

        store.dispatch(transcriptionStarted(sessionId, deepgramToken, wsUrl));
        store.dispatch(setTranscriptionStatus('connected'));

    } catch (error) {
        console.error('Error starting transcription:', error);
        store.dispatch(setTranscriptionStatus('error'));
    }
}

function stopTranscriptionPipeline(store: any) {
    if (deepgramWs) {
        deepgramWs.close();
        deepgramWs = null;
    }
    if (minutelyWs) {
        minutelyWs.close();
        minutelyWs = null;
    }

    const state = store.getState();
    const conference = getCurrentConference(state);
    if (conference) {
        const meetingId = conference.getName();
        fetch(`/api/v1/meetings/${meetingId}/transcription/end`, {
            method: 'POST',
        }).catch(err => console.error("Failed to end session on backend", err));
    }

    store.dispatch(transcriptionStopped());
}

function connectToDeepgram(store: any, token: string, meetingId: string) {
    // Deepgram Live Transcription URL (16kHz mono audio, English, diarized)
    const url = 'wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&channels=1&diarize=true';
    
    deepgramWs = new WebSocket(url, ['token', token]);

    deepgramWs.onopen = () => {
        console.log('Deepgram WebSocket connected');
        // Now we need to start capturing local audio and sending it to Deepgram.
        // This is simplified. In Jitsi, we capture from the local track.
        startAudioCapture(store);
    };

    deepgramWs.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'Results' && msg.channel.alternatives[0].transcript !== '') {
            const transcript = msg.channel.alternatives[0].transcript;
            const isFinal = msg.is_final;
            const start = msg.start;
            const end = msg.start + msg.duration;

            const localParticipant = getLocalParticipant(store.getState());
            
            // Build the standard segment format we defined in Go
            const segment = {
                meeting_id: meetingId,
                speaker_name: localParticipant?.name || 'Unknown',
                speaker_email: localParticipant?.email || 'unknown@example.com',
                text: transcript,
                start_secs: start,
                end_secs: end,
                is_partial: !isFinal
            };

            // 1. Dispatch locally so it shows on the UI immediately
            store.dispatch(transcriptSegmentReceived(segment));

            // 2. Forward to Minutely Hub to broadcast to others and persist
            if (minutelyWs && minutelyWs.readyState === WebSocket.OPEN) {
                minutelyWs.send(JSON.stringify(segment));
            }
        }
    };

    deepgramWs.onerror = (error) => {
        console.error('Deepgram WebSocket error:', error);
    };

    deepgramWs.onclose = () => {
        console.log('Deepgram WebSocket closed');
    };
}

function connectToMinutely(store: any, wsUrl: string) {
    minutelyWs = new WebSocket(wsUrl);

    minutelyWs.onopen = () => {
        console.log('Minutely Hub WebSocket connected');
    };

    minutelyWs.onmessage = (event) => {
        const segment = JSON.parse(event.data);
        const localParticipant = getLocalParticipant(store.getState());
        
        // Don't duplicate segments we sent ourselves (since we already dispatched them locally)
        // But do dispatch segments from other participants
        if (segment.speaker_email !== localParticipant?.email) {
            store.dispatch(transcriptSegmentReceived(segment));
        }
    };

    minutelyWs.onerror = (error) => {
        console.error('Minutely Hub WebSocket error:', error);
    };

    minutelyWs.onclose = () => {
        console.log('Minutely Hub WebSocket closed');
    };
}

// Global scriptProcessor reference to prevent garbage collection
let scriptProcessor: ScriptProcessorNode | null = null;

function startAudioCapture(store: any) {
    const state = store.getState();
    const tracks = state['features/base/tracks'];
    const localAudioTrack = tracks.find((t: any) => t.local && t.mediaType === 'audio');

    if (!localAudioTrack) {
        console.error('No local audio track found to stream to Deepgram');
        return;
    }

    const stream = localAudioTrack.jitsiTrack.getOriginalStream();
    if (!stream) return;

    try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
            sampleRate: 16000 // Deepgram expects 16kHz
        });
        
        const source = audioContext.createMediaStreamSource(stream);
        scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);

        source.connect(scriptProcessor);
        scriptProcessor.connect(audioContext.destination);

        scriptProcessor.onaudioprocess = (e) => {
            if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
                // Convert Float32Array to Int16Array for Deepgram
                const floatData = e.inputBuffer.getChannelData(0);
                const pcmData = new Int16Array(floatData.length);
                for (let i = 0; i < floatData.length; i++) {
                    const s = Math.max(-1, Math.min(1, floatData[i]));
                    pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }
                deepgramWs.send(pcmData.buffer);
            }
        };
    } catch (e) {
        console.error("Failed to start audio capture", e);
    }
}
