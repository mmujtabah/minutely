/**
 * The type of Redux action which signals that live transcription should start.
 *
 * {
 *     type: START_TRANSCRIPTION
 * }
 */
export const START_TRANSCRIPTION = 'START_TRANSCRIPTION';

/**
 * The type of Redux action which signals that a new live session was successfully started.
 *
 * {
 *     type: TRANSCRIPTION_STARTED,
 *     sessionId: string,
 *     deepgramToken: string,
 *     wsUrl: string
 * }
 */
export const TRANSCRIPTION_STARTED = 'TRANSCRIPTION_STARTED';

/**
 * The type of Redux action which signals that live transcription should stop.
 *
 * {
 *     type: STOP_TRANSCRIPTION
 * }
 */
export const STOP_TRANSCRIPTION = 'STOP_TRANSCRIPTION';

/**
 * The type of Redux action which signals that the live session ended.
 *
 * {
 *     type: TRANSCRIPTION_STOPPED
 * }
 */
export const TRANSCRIPTION_STOPPED = 'TRANSCRIPTION_STOPPED';

/**
 * The type of Redux action which signals that a new transcript segment was received.
 *
 * {
 *     type: TRANSCRIPT_SEGMENT_RECEIVED,
 *     segment: Object
 * }
 */
export const TRANSCRIPT_SEGMENT_RECEIVED = 'TRANSCRIPT_SEGMENT_RECEIVED';

/**
 * The type of Redux action to update the transcription connection status.
 *
 * {
 *     type: SET_TRANSCRIPTION_STATUS,
 *     status: 'connecting' | 'connected' | 'disconnected' | 'error'
 * }
 */
export const SET_TRANSCRIPTION_STATUS = 'SET_TRANSCRIPTION_STATUS';

/**
 * The type of Redux action which toggles the visibility of the transcript panel.
 *
 * {
 *     type: TOGGLE_TRANSCRIPT_PANEL
 * }
 */
export const TOGGLE_TRANSCRIPT_PANEL = 'TOGGLE_TRANSCRIPT_PANEL';
