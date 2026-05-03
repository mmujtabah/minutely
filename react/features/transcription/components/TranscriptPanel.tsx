import React, { useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { TranscriptionState } from '../reducer';
import { startTranscription, stopTranscription, toggleTranscriptPanel } from '../actions';
import { getCurrentConference } from '../../base/conference/functions';

import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { X, RefreshCw, Bot, Copy, Check, Maximize2, Minimize2 } from 'lucide-react';

const formatTime = (seconds?: number) => {
    if (seconds === undefined) {
        return '00:00';
    }

    const h = Math.floor(seconds / 3600);
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');

    if (h > 0) {
        return `${h.toString().padStart(2, '0')}:${Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')}:${s}`;
    }

    return `${m}:${s}`;
};

const AISkeletonLoader = () => (
    <div className="space-y-6 pb-8 animate-pulse px-4">
        <div className="space-y-2">
            <div className="h-3 w-1/4 bg-[#E4E4E7] rounded"></div>
            <div className="h-24 bg-[#FAFAFA] border border-[#E4E4E7] rounded-lg"></div>
        </div>
        <div className="space-y-2">
            <div className="h-3 w-1/4 bg-[#E4E4E7] rounded"></div>
            <div className="h-16 bg-[#FAFAFA] border border-[#E4E4E7] rounded-lg"></div>
            <div className="h-16 bg-[#FAFAFA] border border-[#E4E4E7] rounded-lg"></div>
        </div>
        <div className="space-y-2">
            <div className="h-3 w-1/4 bg-[#E4E4E7] rounded"></div>
            <div className="h-32 bg-[#FAFAFA] border border-[#E4E4E7] rounded-lg"></div>
        </div>
    </div>
);

export const TranscriptPanel: React.FC = () => {
    const dispatch = useDispatch();
    const {
        isTranscribing,
        status,
        segments,
        isTranscriptPanelOpen
    } = useSelector((state: any) => state['features/transcription'] as TranscriptionState);

    const meetingId = useSelector((state: any) => getCurrentConference(state)?.getName());
    const [activeTab, setActiveTab] = useState<'live' | 'ai'>('live');
    const [isExpanded, setIsExpanded] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [aiInsights, setAiInsights] = useState<any>(null);
    const [isFetchingAI, setIsFetchingAI] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const hasSegments = segments.length > 0;
    const liveState = status === 'error'
        ? 'error'
        : isTranscribing
            ? (status === 'connecting' ? 'connecting' : 'live')
            : 'idle';

    const liveStateLabel = liveState === 'live'
        ? 'Listening live'
        : liveState === 'connecting'
            ? 'Connecting'
            : liveState === 'error'
                ? 'Connection issue'
                : 'Ready to capture';

    const liveStateClasses = liveState === 'live'
        ? 'bg-green-50 text-green-700 border-green-200'
        : liveState === 'connecting'
            ? 'bg-amber-50 text-amber-700 border-amber-200'
            : liveState === 'error'
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-[#F4F4F5] text-[#71717A] border-[#E4E4E7]';

    useEffect(() => {
        if (activeTab === 'live' && scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [segments, activeTab]);

    const handleToggleTranscription = () => {
        if (isTranscribing) {
            dispatch(stopTranscription());
        } else {
            dispatch(startTranscription());
        }
    };

    const handleClose = () => {
        dispatch(toggleTranscriptPanel());
    };

    const fetchAIInsights = async () => {
        if (!meetingId) {
            return;
        }

        setIsFetchingAI(true);
        setAiError(null);

        try {
            const res = await fetch(`/api/v1/meetings/${meetingId}/ai-insights`);
            if (!res.ok) {
                throw new Error('Failed to fetch insights');
            }

            const data = await res.json();
            if (data && data.length > 0 && data[0].result) {
                setAiInsights(data[0].result);
            } else {
                setAiError('AI analysis is still processing or unavailable.');
            }
        } catch (err: any) {
            setAiError(err.message || 'An error occurred fetching AI insights.');
        } finally {
            setIsFetchingAI(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'ai' && !aiInsights && !isFetchingAI) {
            void fetchAIInsights();
        }
    }, [activeTab]);

    const handleCopy = (text: string, index: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    return (
        <>
            <Card
                className={`fixed right-0 top-0 h-full flex flex-col border-l shadow-xl rounded-none bg-[#FFFFFF] text-[#18181B] z-50 transform transition-all duration-300 ease-in-out ${
                    isTranscriptPanelOpen ? 'translate-x-0' : 'translate-x-full'
                } ${isExpanded ? 'w-[640px] border-[#E4E4E7]' : 'w-[360px] border-[#E4E4E7]'}`}
            >
                <CardHeader className="p-4 border-b border-[#E4E4E7] bg-[#FFFFFF]">
                    <CardTitle className="text-lg flex justify-between items-center text-[#18181B]">
                        <span>Meeting Intelligence</span>
                        <div className="flex items-center space-x-1">
                            <Button variant="ghost" size="icon" onClick={() => setIsExpanded(!isExpanded)} className="text-[#71717A] hover:text-[#18181B]">
                                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={handleClose} className="text-[#71717A] hover:text-[#18181B]">
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                    </CardTitle>

                    <div className="mt-4 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-1 flex gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            className={`flex-1 transition-colors ${activeTab === 'live' ? 'bg-white text-[#18181B] shadow-sm border border-[#E4E4E7]' : 'bg-transparent text-[#71717A] hover:text-[#18181B]'}`}
                            onClick={() => setActiveTab('live')}
                        >
                            Live
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className={`flex-1 transition-colors ${activeTab === 'ai' ? 'bg-white text-[#18181B] shadow-sm border border-[#E4E4E7]' : 'bg-transparent text-[#71717A] hover:text-[#18181B]'}`}
                            onClick={() => setActiveTab('ai')}
                        >
                            AI Insights
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="flex-1 p-0 overflow-hidden relative bg-[#FFFFFF]">
                    {activeTab === 'live' && (
                        <div className="h-full flex flex-col">
                            <div className="p-4 border-b border-[#E4E4E7] bg-[#FAFAFA]">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#71717A] mb-2">
                                            Live Capture
                                        </p>
                                        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${liveStateClasses}`}>
                                            <span className={`h-2 w-2 rounded-full ${
                                                liveState === 'live'
                                                    ? 'bg-green-500'
                                                    : liveState === 'connecting'
                                                        ? 'bg-amber-500 animate-pulse'
                                                        : liveState === 'error'
                                                            ? 'bg-red-500'
                                                            : 'bg-[#A1A1AA]'
                                            }`}></span>
                                            {liveStateLabel}
                                        </div>
                                        <p className="mt-2 text-sm text-[#71717A]">
                                            {hasSegments
                                                ? `${segments.length} transcript update${segments.length === 1 ? '' : 's'} captured in this session.`
                                                : liveState === 'live'
                                                    ? 'Waiting for the first spoken segment.'
                                                    : 'Start a live session to generate notes and insights.'}
                                        </p>
                                    </div>

                                    {isTranscribing ? (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleToggleTranscription}
                                            disabled={status === 'connecting'}
                                            className="border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                        >
                                            Stop Live
                                        </Button>
                                    ) : null}
                                </div>
                            </div>

                            <div className="flex-1 p-4 overflow-y-auto bg-[#FFFFFF]">
                                {!hasSegments ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center px-5">
                                        <div className={`mb-5 flex h-16 w-16 items-center justify-center rounded-full border ${
                                            liveState === 'live' || liveState === 'connecting'
                                                ? 'border-[#FECACA] bg-[#FFF1F2]'
                                                : 'border-[#E4E4E7] bg-[#FAFAFA]'
                                        }`}>
                                            <Bot className={`h-8 w-8 ${
                                                liveState === 'live' || liveState === 'connecting'
                                                    ? 'text-[#C01140]'
                                                    : 'text-[#D4D4D8]'
                                            }`} />
                                        </div>

                                        {liveState === 'live' || liveState === 'connecting' ? (
                                            <>
                                                <h3 className="text-lg font-semibold text-[#18181B] mb-2">
                                                    {liveState === 'connecting' ? 'Connecting to live transcription' : 'Listening for audio'}
                                                </h3>
                                                <p className="text-sm text-[#71717A] max-w-xs">
                                                    As soon as people speak, transcript segments will appear here and the AI tab will become useful after capture ends.
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <h3 className="text-lg font-semibold text-[#18181B] mb-2">Start live transcription</h3>
                                                <p className="mb-5 text-sm text-[#71717A] max-w-xs">
                                                    Capture the meeting in real time, then review transcript segments and AI insights from the same panel.
                                                </p>
                                                <Button
                                                    onClick={handleToggleTranscription}
                                                    disabled={status === 'connecting'}
                                                    className="bg-[#C01140] px-5 text-white hover:bg-[#A00F35]"
                                                >
                                                    {status === 'connecting' ? 'Connecting...' : 'Start Live Transcription'}
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-4">
                                        {segments.map((seg, idx) => (
                                            <div key={idx} className={`group rounded-2xl border border-[#E4E4E7] bg-[#FFFFFF] p-4 shadow-sm ${seg.is_partial ? 'opacity-70' : ''}`}>
                                                <div className="flex">
                                                    <div className="mr-3 mt-1 flex flex-col items-center">
                                                        <div className="h-8 w-8 rounded-full bg-[#F4F4F5] flex items-center justify-center text-sm font-semibold text-[#18181B]">
                                                            {seg.speaker_name ? seg.speaker_name.charAt(0).toUpperCase() : '?'}
                                                        </div>
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <div className="flex items-center space-x-2">
                                                                <span className="text-sm font-semibold text-[#18181B]">
                                                                    {seg.speaker_name}
                                                                </span>
                                                                <span className="text-xs text-[#71717A] font-mono">
                                                                    {formatTime(seg.start_secs)}
                                                                </span>
                                                                {seg.confidence && seg.confidence < 0.8 && (
                                                                    <span title="Low confidence transcription" className="h-2 w-2 rounded-full bg-yellow-500/50 border border-yellow-500/80"></span>
                                                                )}
                                                            </div>

                                                            <button
                                                                onClick={() => handleCopy(seg.text, idx)}
                                                                className="text-[#71717A] hover:text-[#18181B] opacity-0 group-hover:opacity-100 transition-opacity"
                                                                title="Copy segment"
                                                            >
                                                                {copiedIndex === idx ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                                                            </button>
                                                        </div>
                                                        <div className="text-sm text-[#3F3F46] leading-relaxed">
                                                            {seg.text}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={scrollRef} />
                                    </div>
                                )}
                            </div>

                            {status === 'error' && (
                                <div className="p-3 bg-red-50 text-red-700 border-t border-red-200 text-xs text-center">
                                    Connection lost or an audio-stream error occurred.
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'ai' && (
                        <div className="h-full p-4 overflow-y-auto flex flex-col">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-semibold text-lg flex items-center text-[#18181B]">
                                    <Bot className="mr-2 h-5 w-5 text-[#C01140]" />
                                    Meeting Insights
                                </h3>
                                <Button variant="outline" size="sm" onClick={fetchAIInsights} disabled={isFetchingAI} className="bg-transparent border-[#E4E4E7] text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5]">
                                    <RefreshCw className={`mr-2 h-4 w-4 ${isFetchingAI ? 'animate-spin' : ''}`} />
                                    {isFetchingAI ? 'Loading...' : 'Refresh'}
                                </Button>
                            </div>

                            <div className="mb-4 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-4">
                                <p className="text-sm font-medium text-[#18181B] mb-1">How insights appear</p>
                                <p className="text-sm text-[#71717A]">
                                    AI summaries are most reliable after a live session ends and the transcript finishes processing.
                                </p>
                            </div>

                            {aiError && !isFetchingAI && (
                                <div className="p-3 mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
                                    {aiError}
                                </div>
                            )}

                            {isFetchingAI && <AISkeletonLoader />}

                            {!aiInsights && !isFetchingAI && !aiError && (
                                <div className="flex-1 flex flex-col items-center justify-center text-center text-[#71717A] px-4">
                                    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-[#E4E4E7] bg-[#FAFAFA]">
                                        <Bot className="h-8 w-8 text-[#D4D4D8]" />
                                    </div>
                                    <p className="mb-2 text-lg font-semibold text-[#18181B]">No insights available yet</p>
                                    <p className="text-sm max-w-xs">Finish the live session, then refresh this tab for summaries, action items, and topic clusters.</p>
                                </div>
                            )}

                            {aiInsights && !isFetchingAI && (
                                <div className="space-y-6 pb-8">
                                    {aiInsights.executive_summary && (
                                        <div className="space-y-2">
                                            <h4 className="font-medium text-xs text-[#71717A] uppercase tracking-wider">Executive Summary</h4>
                                            <p className="text-sm leading-relaxed text-[#3F3F46] bg-[#FAFAFA] border border-[#E4E4E7] p-4 rounded-lg">
                                                {aiInsights.executive_summary}
                                            </p>
                                        </div>
                                    )}

                                    {aiInsights.action_items && aiInsights.action_items.length > 0 && (
                                        <div className="space-y-2">
                                            <h4 className="font-medium text-xs text-[#71717A] uppercase tracking-wider">Action Items</h4>
                                            <ul className="space-y-2">
                                                {aiInsights.action_items.map((item: any, i: number) => (
                                                    <li key={i} className="text-sm bg-[#FAFAFA] border border-[#E4E4E7] p-3 rounded-lg flex flex-col">
                                                        <span className="font-medium mb-2 text-[#18181B]">{item.task}</span>
                                                        <div className="flex items-center text-xs text-[#71717A]">
                                                            <div className="flex items-center bg-white border border-[#E4E4E7] px-2 py-1 rounded">
                                                                <span className="w-4 h-4 rounded-full bg-[#F4F4F5] flex items-center justify-center mr-1.5 font-bold">
                                                                    {item.assignee ? item.assignee.charAt(0).toUpperCase() : '?'}
                                                                </span>
                                                                {item.assignee || 'Unassigned'}
                                                            </div>
                                                            {item.deadline && <span className="ml-3">Due: {item.deadline}</span>}
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {aiInsights.topics && aiInsights.topics.length > 0 && (
                                        <div className="space-y-2">
                                            <h4 className="font-medium text-xs text-[#71717A] uppercase tracking-wider">Key Topics Discussed</h4>
                                            <div className="space-y-3">
                                                {aiInsights.topics.map((topic: any, i: number) => (
                                                    <div key={i} className="text-sm bg-[#FAFAFA] border border-[#E4E4E7] rounded-lg p-4">
                                                        <div className="font-medium mb-2 text-[#18181B]">{topic.title}</div>
                                                        <div className="text-xs text-[#71717A] mb-3 flex flex-wrap gap-1.5">
                                                            {topic.keywords?.map((kw: string, j: number) => (
                                                                <span key={j} className="bg-white border border-[#E4E4E7] text-[#52525B] px-2 py-0.5 rounded-full">
                                                                    {kw}
                                                                </span>
                                                            ))}
                                                        </div>
                                                        <p className="text-sm text-[#52525B] leading-relaxed">{topic.summary}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>

            </Card>
        </>
    );
};
