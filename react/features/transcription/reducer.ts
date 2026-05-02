import ReducerRegistry from '../base/redux/ReducerRegistry';
import {
    TRANSCRIPTION_STARTED,
    TRANSCRIPTION_STOPPED,
    TRANSCRIPT_SEGMENT_RECEIVED,
    SET_TRANSCRIPTION_STATUS,
    TOGGLE_TRANSCRIPT_PANEL
} from './actionTypes';

export interface TranscriptionState {
    isTranscribing: boolean;
    sessionId: string | null;
    deepgramToken: string | null;
    wsUrl: string | null;
    status: 'disconnected' | 'connecting' | 'connected' | 'error';
    segments: Array<any>;
    isTranscriptPanelOpen: boolean;
}

const DEFAULT_STATE: TranscriptionState = {
    isTranscribing: false,
    sessionId: null,
    deepgramToken: null,
    wsUrl: null,
    status: 'disconnected',
    segments: [],
    isTranscriptPanelOpen: false
};

ReducerRegistry.register('features/transcription', (state = DEFAULT_STATE, action: any) => {
    switch (action.type) {
        case TRANSCRIPTION_STARTED:
            return {
                ...state,
                isTranscribing: true,
                sessionId: action.sessionId,
                deepgramToken: action.deepgramToken,
                wsUrl: action.wsUrl,
                segments: [] // Clear previous segments on start
            };

        case TRANSCRIPTION_STOPPED:
            return {
                ...state,
                isTranscribing: false,
                sessionId: null,
                deepgramToken: null,
                wsUrl: null,
                status: 'disconnected'
            };

        case SET_TRANSCRIPTION_STATUS:
            return {
                ...state,
                status: action.status
            };

        case TRANSCRIPT_SEGMENT_RECEIVED:
            return {
                ...state,
                // Replace if we have a matching startSecs/endSecs, otherwise append
                segments: appendOrUpdateSegment(state.segments, action.segment)
            };

        case TOGGLE_TRANSCRIPT_PANEL:
            return {
                ...state,
                isTranscriptPanelOpen: !state.isTranscriptPanelOpen
            };
            
        default:
            return state;
    }
});

function appendOrUpdateSegment(segments: Array<any>, newSegment: any) {
    // Basic logic: if we find a segment that has the same speaker and overlaps,
    // or is the "final" version of a previous "partial", replace it.
    // Deepgram sends words as they arrive. The middleware will batch them into segments.
    // For simplicity, we just append it here, but in real scenarios, you'd replace partials.
    return [...segments, newSegment];
}
