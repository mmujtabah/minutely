import React, { useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { TranscriptionState } from '../reducer';
import { startTranscription, stopTranscription, toggleTranscriptPanel } from '../actions';
import { UploadRecordingModal } from './UploadRecordingModal';
import { getCurrentConference } from '../../base/conference/functions';

// shadcn-ui components
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { X, RefreshCw, Bot } from 'lucide-react';

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

    return (
        <Card 
            className={`fixed right-0 top-0 h-full w-80 flex flex-col border-l shadow-xl rounded-none bg-background z-50 transform transition-transform duration-300 ease-in-out ${
                isTranscriptPanelOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
        >
            <CardHeader className="p-4 border-b">
                <CardTitle className="text-lg flex justify-between items-center">
                    <span>Meeting Intelligence</span>
                    <Button variant="ghost" size="icon" onClick={handleClose}>
                        <X className="h-5 w-5" />
                    </Button>
                </CardTitle>
                
                {/* Tabs */}
                <div className="flex space-x-2 mt-4">
                    <Button 
                        variant={activeTab === 'live' ? 'default' : 'outline'} 
                        size="sm" 
                        className="flex-1"
                        onClick={() => setActiveTab('live')}
                    >
                        Live
                    </Button>
                    <Button 
                        variant={activeTab === 'ai' ? 'default' : 'outline'} 
                        size="sm" 
                        className="flex-1"
                        onClick={() => setActiveTab('ai')}
                    >
                        AI Insights
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="flex-1 p-0 overflow-hidden relative">
                {activeTab === 'live' && (
                    <div className="h-full flex flex-col">
                        <div className="p-2 border-b flex justify-between items-center bg-muted/30">
                            <Button 
                                variant="outline"
                                size="sm"
                                onClick={() => setIsUploadModalOpen(true)}
                            >
                                Upload Audio
                            </Button>
                            <Button 
                                variant={isTranscribing ? "destructive" : "default"} 
                                size="sm"
                                onClick={handleToggleTranscription}
                                disabled={status === 'connecting'}
                            >
                                {status === 'connecting' ? 'Connecting...' : 
                                 isTranscribing ? 'Stop Live' : 'Start Live'}
                            </Button>
                        </div>
                        <div className="flex-1 p-4 overflow-y-auto">
                            {segments.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-muted-foreground text-sm italic">
                                    {isTranscribing ? 'Listening...' : 'Live transcription is inactive.'}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    {segments.map((seg, idx) => (
                                        <div key={idx} className={`flex flex-col ${seg.is_partial ? 'opacity-70' : ''}`}>
                                            <span className="text-xs font-semibold text-primary mb-1">
                                                {seg.speaker_name}
                                            </span>
                                            <span className="text-sm">
                                                {seg.text}
                                            </span>
                                        </div>
                                    ))}
                                    <div ref={scrollRef} />
                                </div>
                            )}
                        </div>
                        {status === 'error' && (
                            <div className="p-2 bg-destructive text-destructive-foreground text-xs text-center">
                                Connection lost or error occurred.
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'ai' && (
                    <div className="h-full p-4 overflow-y-auto flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-semibold text-lg flex items-center">
                                <Bot className="mr-2 h-5 w-5 text-primary" />
                                Meeting Insights
                            </h3>
                            <Button variant="outline" size="sm" onClick={fetchAIInsights} disabled={isFetchingAI}>
                                <RefreshCw className={`mr-2 h-4 w-4 ${isFetchingAI ? 'animate-spin' : ''}`} /> 
                                {isFetchingAI ? 'Loading...' : 'Refresh'}
                            </Button>
                        </div>

                        {aiError && (
                            <div className="p-3 mb-4 text-sm text-destructive bg-destructive/10 rounded-md">
                                {aiError}
                            </div>
                        )}

                        {!aiInsights && !isFetchingAI && !aiError && (
                            <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground">
                                <p className="mb-2">No insights available yet.</p>
                                <p className="text-sm">End the live meeting to generate AI summaries, action items, and topic clusters.</p>
                            </div>
                        )}

                        {aiInsights && (
                            <div className="space-y-6 pb-8">
                                {/* Executive Summary */}
                                {aiInsights.executive_summary && (
                                    <div className="space-y-2">
                                        <h4 className="font-medium text-sm text-primary uppercase tracking-wider">Executive Summary</h4>
                                        <p className="text-sm leading-relaxed text-card-foreground bg-muted/30 p-3 rounded-md">
                                            {aiInsights.executive_summary}
                                        </p>
                                    </div>
                                )}

                                {/* Action Items */}
                                {aiInsights.action_items && aiInsights.action_items.length > 0 && (
                                    <div className="space-y-2">
                                        <h4 className="font-medium text-sm text-primary uppercase tracking-wider">Action Items</h4>
                                        <ul className="space-y-2">
                                            {aiInsights.action_items.map((item: any, i: number) => (
                                                <li key={i} className="text-sm bg-muted/30 p-3 rounded-md flex flex-col">
                                                    <span className="font-medium mb-1">{item.task}</span>
                                                    <div className="flex justify-between text-xs text-muted-foreground">
                                                        <span>Assignee: {item.assignee}</span>
                                                        <span>Due: {item.deadline}</span>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Topic Clusters */}
                                {aiInsights.topics && aiInsights.topics.length > 0 && (
                                    <div className="space-y-2">
                                        <h4 className="font-medium text-sm text-primary uppercase tracking-wider">Key Topics Discussed</h4>
                                        <div className="space-y-3">
                                            {aiInsights.topics.map((topic: any, i: number) => (
                                                <div key={i} className="text-sm border rounded-md p-3">
                                                    <div className="font-medium mb-1">{topic.title}</div>
                                                    <div className="text-xs text-muted-foreground mb-2 flex flex-wrap gap-1">
                                                        {topic.keywords?.map((kw: string, j: number) => (
                                                            <span key={j} className="bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                                                {kw}
                                                            </span>
                                                        ))}
                                                    </div>
                                                    <p className="text-xs">{topic.summary}</p>
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
    );
};
