import React, { useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { TranscriptionState } from '../reducer';
import { startTranscription, stopTranscription, toggleTranscriptPanel } from '../actions';
import { UploadRecordingModal } from './UploadRecordingModal';
import { getCurrentConference } from '../../base/conference/functions';

// shadcn-ui components
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { X, RefreshCw, Bot, Copy, Check, Maximize2, Minimize2 } from 'lucide-react';

const formatTime = (seconds?: number) => {
    if (seconds === undefined) return '00:00';
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
};

const AISkeletonLoader = () => (
    <div className="space-y-6 pb-8 animate-pulse px-4">
        <div className="space-y-2">
            <div className="h-3 w-1/4 bg-[#2E2E35] rounded"></div>
            <div className="h-24 bg-[#18181B] border border-[#2E2E35] rounded-lg"></div>
        </div>
        <div className="space-y-2">
            <div className="h-3 w-1/4 bg-[#2E2E35] rounded"></div>
            <div className="h-16 bg-[#18181B] border border-[#2E2E35] rounded-lg"></div>
            <div className="h-16 bg-[#18181B] border border-[#2E2E35] rounded-lg"></div>
        </div>
        <div className="space-y-2">
            <div className="h-3 w-1/4 bg-[#2E2E35] rounded"></div>
            <div className="h-32 bg-[#18181B] border border-[#2E2E35] rounded-lg"></div>
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
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'live' | 'ai'>('live');
    const [isExpanded, setIsExpanded] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    // AI Insights State
    const [aiInsights, setAiInsights] = useState<any>(null);
    const [isFetchingAI, setIsFetchingAI] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new segments
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
        if (!meetingId) return;
        setIsFetchingAI(true);
        setAiError(null);
        try {
            const res = await fetch(`/api/v1/meetings/${meetingId}/ai-insights`);
            if (!res.ok) throw new Error("Failed to fetch insights");
            const data = await res.json();
            if (data && data.length > 0 && data[0].result) {
                setAiInsights(data[0].result);
            } else {
                setAiError("AI Analysis is still processing or unavailable.");
            }
        } catch (err: any) {
            setAiError(err.message || "An error occurred fetching AI Insights.");
        } finally {
            setIsFetchingAI(false);
        }
    };

    // Auto-fetch AI insights when AI tab becomes active
    useEffect(() => {
        if (activeTab === 'ai' && !aiInsights && !isFetchingAI) {
            fetchAIInsights();
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
                className={`fixed right-0 top-0 h-full flex flex-col border-l shadow-xl rounded-none bg-[#0F0F11] text-[#FAFAFA] z-50 transform transition-all duration-300 ease-in-out ${
                    isTranscriptPanelOpen ? 'translate-x-0' : 'translate-x-full'
                } ${isExpanded ? 'w-[600px] border-[#2E2E35]' : 'w-80 border-[#2E2E35]'}`}
            >
                <CardHeader className="p-4 border-b border-[#2E2E35] bg-[#18181B]">
                    <CardTitle className="text-lg flex justify-between items-center text-[#FAFAFA]">
                        <span>Meeting Intelligence</span>
                        <div className="flex items-center space-x-1">
                            <Button variant="ghost" size="icon" onClick={() => setIsExpanded(!isExpanded)} className="text-[#A1A1AA] hover:text-[#FAFAFA]">
                                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={handleClose} className="text-[#A1A1AA] hover:text-[#FAFAFA]">
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                    </CardTitle>
                    
                    {/* Tabs */}
                    <div className="flex space-x-2 mt-4">
                        <Button 
                            variant="outline"
                            size="sm" 
                            className={`flex-1 transition-colors ${activeTab === 'live' ? 'bg-[#2E2E35] text-[#FAFAFA] border-[#2E2E35]' : 'bg-transparent text-[#A1A1AA] border-[#2E2E35] hover:text-[#FAFAFA]'}`}
                            onClick={() => setActiveTab('live')}
                        >
                            Live
                        </Button>
                        <Button 
                            variant="outline"
                            size="sm" 
                            className={`flex-1 transition-colors ${activeTab === 'ai' ? 'bg-[#2E2E35] text-[#FAFAFA] border-[#2E2E35]' : 'bg-transparent text-[#A1A1AA] border-[#2E2E35] hover:text-[#FAFAFA]'}`}
                            onClick={() => setActiveTab('ai')}
                        >
                            AI Insights
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="flex-1 p-0 overflow-hidden relative bg-[#0F0F11]">
                    {activeTab === 'live' && (
                        <div className="h-full flex flex-col">
                            <div className="p-2 border-b border-[#2E2E35] flex justify-between items-center bg-[#18181B]">
                                <Button 
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsUploadModalOpen(true)}
                                    className="bg-transparent border-[#2E2E35] text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-[#2E2E35]"
                                >
                                    Upload Audio
                                </Button>
                                <Button 
                                    size="sm"
                                    onClick={handleToggleTranscription}
                                    disabled={status === 'connecting'}
                                    className={`${isTranscribing ? 'bg-red-900/50 text-red-400 hover:bg-red-900/70 border border-red-900/50' : 'bg-[#C01140] text-white hover:bg-[#A00F35]'}`}
                                >
                                    {status === 'connecting' ? 'Connecting...' : 
                                     isTranscribing ? 'Stop Live' : 'Start Live'}
                                </Button>
                            </div>
                            <div className="flex-1 p-4 overflow-y-auto">
                                {segments.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-[#A1A1AA] text-sm text-center px-4">
                                        <Bot className="h-12 w-12 text-[#2E2E35] mb-4" />
                                        {isTranscribing ? (
                                            <p className="animate-pulse">Listening for audio...</p>
                                        ) : (
                                            <>
                                                <p className="mb-4">Live transcription is inactive. Start transcription to capture discussion and generate AI insights.</p>
                                                <Button 
                                                    onClick={handleToggleTranscription}
                                                    disabled={status === 'connecting'}
                                                    className="bg-[#C01140] text-white hover:bg-[#A00F35]"
                                                >
                                                    {status === 'connecting' ? 'Connecting...' : 'Start Live Transcription'}
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-6">
                                        {segments.map((seg, idx) => (
                                            <div key={idx} className={`flex group ${seg.is_partial ? 'opacity-60' : ''}`}>
                                                <div className="mr-3 mt-1 flex flex-col items-center">
                                                    <div className="h-8 w-8 rounded-full bg-[#2E2E35] flex items-center justify-center text-sm font-semibold text-[#FAFAFA]">
                                                        {seg.speaker_name ? seg.speaker_name.charAt(0).toUpperCase() : '?'}
                                                    </div>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="flex items-center space-x-2">
                                                            <span className="text-sm font-semibold text-[#FAFAFA]">
                                                                {seg.speaker_name}
                                                            </span>
                                                            <span className="text-xs text-[#A1A1AA] font-mono">
                                                                {formatTime(seg.start_secs)}
                                                            </span>
                                                            {seg.confidence && seg.confidence < 0.8 && (
                                                                <span title="Low confidence transcription" className="h-2 w-2 rounded-full bg-yellow-500/50 border border-yellow-500/80"></span>
                                                            )}
                                                        </div>
                                                        
                                                        <button 
                                                            onClick={() => handleCopy(seg.text, idx)}
                                                            className="text-[#A1A1AA] hover:text-[#FAFAFA] opacity-0 group-hover:opacity-100 transition-opacity"
                                                            title="Copy segment"
                                                        >
                                                            {copiedIndex === idx ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                                                        </button>
                                                    </div>
                                                    <div className="text-sm text-[#E4E4E7] leading-relaxed">
                                                        {seg.text}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={scrollRef} />
                                    </div>
                                )}
                            </div>
                            {status === 'error' && (
                                <div className="p-2 bg-red-900/50 text-red-200 border-t border-red-900 text-xs text-center">
                                    Connection lost or error occurred.
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'ai' && (
                        <div className="h-full p-4 overflow-y-auto flex flex-col">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-semibold text-lg flex items-center text-[#FAFAFA]">
                                    <Bot className="mr-2 h-5 w-5 text-[#C01140]" />
                                    Meeting Insights
                                </h3>
                                <Button variant="outline" size="sm" onClick={fetchAIInsights} disabled={isFetchingAI} className="bg-transparent border-[#2E2E35] text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-[#2E2E35]">
                                    <RefreshCw className={`mr-2 h-4 w-4 ${isFetchingAI ? 'animate-spin' : ''}`} /> 
                                    {isFetchingAI ? 'Loading...' : 'Refresh'}
                                </Button>
                            </div>

                            {aiError && !isFetchingAI && (
                                <div className="p-3 mb-4 text-sm text-red-200 bg-red-900/30 border border-red-900/50 rounded-md">
                                    {aiError}
                                </div>
                            )}

                            {isFetchingAI && <AISkeletonLoader />}

                            {!aiInsights && !isFetchingAI && !aiError && (
                                <div className="flex-1 flex flex-col items-center justify-center text-center text-[#A1A1AA]">
                                    <p className="mb-2">No insights available yet.</p>
                                    <p className="text-sm">End the live meeting to generate AI summaries, action items, and topic clusters.</p>
                                </div>
                            )}

                            {aiInsights && !isFetchingAI && (
                                <div className="space-y-6 pb-8">
                                    {/* Executive Summary */}
                                    {aiInsights.executive_summary && (
                                        <div className="space-y-2">
                                            <h4 className="font-medium text-xs text-[#A1A1AA] uppercase tracking-wider">Executive Summary</h4>
                                            <p className="text-sm leading-relaxed text-[#E4E4E7] bg-[#18181B] border border-[#2E2E35] p-4 rounded-lg">
                                                {aiInsights.executive_summary}
                                            </p>
                                        </div>
                                    )}

                                    {/* Action Items */}
                                    {aiInsights.action_items && aiInsights.action_items.length > 0 && (
                                        <div className="space-y-2">
                                            <h4 className="font-medium text-xs text-[#A1A1AA] uppercase tracking-wider">Action Items</h4>
                                            <ul className="space-y-2">
                                                {aiInsights.action_items.map((item: any, i: number) => (
                                                    <li key={i} className="text-sm bg-[#18181B] border border-[#2E2E35] p-3 rounded-lg flex flex-col">
                                                        <span className="font-medium mb-2 text-[#FAFAFA]">{item.task}</span>
                                                        <div className="flex items-center text-xs text-[#A1A1AA]">
                                                            <div className="flex items-center bg-[#2E2E35] px-2 py-1 rounded">
                                                                <span className="w-4 h-4 rounded-full bg-[#0F0F11] flex items-center justify-center mr-1.5 font-bold">
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

                                    {/* Topic Clusters */}
                                    {aiInsights.topics && aiInsights.topics.length > 0 && (
                                        <div className="space-y-2">
                                            <h4 className="font-medium text-xs text-[#A1A1AA] uppercase tracking-wider">Key Topics Discussed</h4>
                                            <div className="space-y-3">
                                                {aiInsights.topics.map((topic: any, i: number) => (
                                                    <div key={i} className="text-sm bg-[#18181B] border border-[#2E2E35] rounded-lg p-4">
                                                        <div className="font-medium mb-2 text-[#FAFAFA]">{topic.title}</div>
                                                        <div className="text-xs text-[#A1A1AA] mb-3 flex flex-wrap gap-1.5">
                                                            {topic.keywords?.map((kw: string, j: number) => (
                                                                <span key={j} className="bg-[#2E2E35] text-[#E4E4E7] px-2 py-0.5 rounded-full">
                                                                    {kw}
                                                                </span>
                                                            ))}
                                                        </div>
                                                        <p className="text-sm text-[#A1A1AA] leading-relaxed">{topic.summary}</p>
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
                
                {meetingId && (
                    <UploadRecordingModal 
                        isOpen={isUploadModalOpen} 
                        onClose={() => setIsUploadModalOpen(false)} 
                        meetingId={meetingId}
                    />
                )}
            </Card>
        </>
    );
};
