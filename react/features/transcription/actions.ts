import {
    START_TRANSCRIPTION,
    STOP_TRANSCRIPTION,
    TRANSCRIPTION_STARTED,
    TRANSCRIPTION_STOPPED,
    TRANSCRIPT_SEGMENT_RECEIVED,
    SET_TRANSCRIPTION_STATUS,
    TOGGLE_TRANSCRIPT_PANEL
} from './actionTypes';

/**
 * Action to start the transcription process.
 * Handled by middleware to initiate API call.
 */
export function startTranscription() {
    return {
        type: START_TRANSCRIPTION
    };
}

/**
 * Action dispatched when transcription successfully starts.
 */
export function transcriptionStarted(sessionId: string, deepgramToken: string, wsUrl: string) {
    return {
        type: TRANSCRIPTION_STARTED,
        sessionId,
        deepgramToken,
        wsUrl
    };
}

/**
 * Action to stop the transcription process.
 */
export function stopTranscription() {
    return {
        type: STOP_TRANSCRIPTION
    };
}

/**
 * Action dispatched when transcription successfully stops.
 */
export function transcriptionStopped() {
    return {
        type: TRANSCRIPTION_STOPPED
    };
}

/**
 * Action to handle an incoming segment.
 */
export function transcriptSegmentReceived(segment: any) {
    return {
        type: TRANSCRIPT_SEGMENT_RECEIVED,
        segment
    };
}

/**
 * Updates the connection status.
 */
export function setTranscriptionStatus(status: 'connecting' | 'connected' | 'disconnected' | 'error') {
    return {
        type: SET_TRANSCRIPTION_STATUS,
        status
    };
}

/**
 * Toggles the visibility of the transcript panel.
 */
export function toggleTranscriptPanel() {
    return {
        type: TOGGLE_TRANSCRIPT_PANEL
    };
}
