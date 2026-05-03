import React, { useEffect, useState } from 'react';
import { ArrowLeft, Clock, Users, Calendar, Download, Search, Loader2 } from 'lucide-react';
import { supabase } from '../../supabase-auth/client';

interface IProps {
    meetingId: string | number;
    onBack: () => void;
}

const MeetingDetailPage: React.FC<IProps> = ({ meetingId, onBack }) => {
    const [activeTab, setActiveTab] = useState<'summary' | 'transcript' | 'actionItems' | 'topics'>('summary');
    const [searchQuery, setSearchQuery] = useState('');
    const [meeting, setMeeting] = useState<any>(null);
    const [transcript, setTranscript] = useState<any>(null);
    const [insights, setInsights] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;

                const headers = { 'Authorization': `Bearer ${session.access_token}` };

                // Fetch everything in parallel
                const [meetingRes, transcriptRes, insightsRes] = await Promise.all([
                    fetch(`/api/v1/meetings/${meetingId}`, { headers }),
                    fetch(`/api/v1/meetings/${meetingId}/transcript`, { headers }),
                    fetch(`/api/v1/meetings/${meetingId}/ai-insights`, { headers })
                ]);

                if (meetingRes.ok) {
                    setMeeting(await meetingRes.json());
                }
                if (transcriptRes.ok) {
                    setTranscript(await transcriptRes.json());
                }
                if (insightsRes.ok) {
                    setInsights((await insightsRes.json()) || []);
                }
            } catch (err) {
                console.error("Failed to fetch meeting details:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [meetingId]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-[#71717A]">
                <Loader2 className="h-8 w-8 animate-spin mb-4 text-[#C01140]" />
                <p className="text-lg font-medium">Analyzing meeting data...</p>
            </div>
        );
    }

    if (!meeting) {
        return (
            <div className="p-8 text-center bg-white border border-[#E4E4E7] rounded-xl shadow-sm">
                <p className="text-[#71717A] mb-4">Meeting not found or still being processed.</p>
                <button 
                    onClick={onBack}
                    className="text-[#C01140] hover:underline font-medium inline-flex items-center"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
                </button>
            </div>
        );
    }

    // Extract data from insights
    // The backend saves all AI results (summary, topics, action items) into a single 'summary' output record
    const combinedOutput = insights.find(i => i.output_type === 'summary');
    
    let summary = combinedOutput?.result?.executive_summary || meeting.summary;
    if (!summary || summary === "") {
        // Fallback to reconstruct from transcript if available
        if (transcript?.segments?.length > 0) {
            summary = transcript.segments.slice(0, 3).map((s: any) => s.text).join(' ') + "...";
        } else {
            summary = "No executive summary available for this meeting yet.";
        }
    }
    const topics = combinedOutput?.result?.topics || [];
    const actionItems = combinedOutput?.result?.action_items || [];
    const participants = transcript?.participants || [];

    const filteredTranscript = transcript?.segments?.filter((seg: any) => 
        seg.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        seg.speaker_name.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <button 
                    onClick={onBack}
                    className="inline-flex items-center text-[#71717A] hover:text-[#18181B] mb-6 transition-colors text-sm font-medium"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
                </button>
                
                <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <h1 className="text-3xl font-bold tracking-tight text-[#18181B]">{meeting.title}</h1>
                            {meeting.source && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-[#F4F4F5] text-[#71717A]">
                                    {meeting.source}
                                </span>
                            )}
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                                {meeting.status || 'Processed'}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-sm text-[#71717A]">
                            <div className="flex items-center"><Calendar className="h-4 w-4 mr-2 text-[#A1A1AA]" /> {new Date(meeting.created_at).toLocaleDateString()}</div>
                            <div className="flex items-center"><Clock className="h-4 w-4 mr-2 text-[#A1A1AA]" /> {transcript?.duration_secs ? Math.round(transcript.duration_secs / 60) : 0} min</div>
                            <div className="flex items-center"><Users className="h-4 w-4 mr-2 text-[#A1A1AA]" /> {participants.length} participants</div>
                        </div>
                    </div>
                    
                    <button className="flex items-center px-4 py-2 bg-white border border-[#E4E4E7] hover:bg-[#F4F4F5] text-[#18181B] rounded-lg shadow-sm transition-all text-sm font-medium">
                        <Download className="h-4 w-4 mr-2" /> Export Insights
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[#E4E4E7] overflow-x-auto no-scrollbar">
                {(['summary', 'transcript', 'actionItems', 'topics'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-4 font-semibold text-sm transition-all relative whitespace-nowrap ${
                            activeTab === tab 
                            ? 'text-[#C01140]' 
                            : 'text-[#71717A] hover:text-[#18181B]'
                        }`}
                    >
                        {tab === 'actionItems' ? 'Action Items' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                        {activeTab === tab && (
                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#C01140] rounded-full" />
                        )}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="bg-[#FFFFFF] border border-[#E4E4E7] rounded-2xl p-8 shadow-sm min-h-[500px]">
                
                {activeTab === 'summary' && (
                    <div className="space-y-10">
                        <div>
                            <h2 className="text-xl font-bold mb-6 text-[#18181B] flex items-center">
                                <div className="w-1.5 h-6 bg-[#C01140] rounded-full mr-3" />
                                Executive Summary
                            </h2>
                            <p className="text-[#3F3F46] leading-relaxed text-lg max-w-4xl">
                                {summary}
                            </p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-10 border-t border-[#F4F4F5]">
                            <div>
                                <h3 className="text-sm font-bold text-[#18181B] mb-6 uppercase tracking-wider">Discussion Highlights</h3>
                                <ul className="space-y-4">
                                    {topics.length > 0 ? topics.map((topic: string, i: number) => (
                                        <li key={i} className="flex items-start text-[#3F3F46]">
                                            <div className="h-2 w-2 rounded-full bg-[#C01140] mt-2 mr-4 shrink-0" />
                                            <span className="text-md">{typeof topic === 'string' ? topic : (topic as any).title || "Topic"}</span>
                                        </li>
                                    )) : (
                                        <li className="text-[#A1A1AA] italic">Topics are being extracted...</li>
                                    )}
                                </ul>
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-[#18181B] mb-6 uppercase tracking-wider">Participants & Contributions</h3>
                                <ul className="space-y-4">
                                    {participants.length > 0 ? participants.map((p: string, i: number) => {
                                        const name = p.split(' <')[0];
                                        return (
                                            <li key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-[#FAFAFA] transition-colors border border-transparent hover:border-[#F4F4F5]">
                                                <div className="flex items-center">
                                                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#C01140] to-[#E11D48] flex items-center justify-center text-sm font-bold text-white mr-4 shadow-sm">
                                                        {name.charAt(0)}
                                                    </div>
                                                    <span className="font-medium text-[#18181B]">{name}</span>
                                                </div>
                                                <span className="text-xs font-medium text-[#71717A] bg-[#F4F4F5] px-2 py-1 rounded">Contributor</span>
                                            </li>
                                        );
                                    }) : (
                                        <li className="text-[#A1A1AA] italic">Participant data unavailable.</li>
                                    )}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'transcript' && (
                    <div className="space-y-6">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A1A1AA]" />
                            <input 
                                type="text" 
                                placeholder="Search in transcript..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-[#FAFAFA] border border-[#E4E4E7] rounded-xl pl-12 pr-4 py-3 text-sm text-[#18181B] focus:border-[#C01140] focus:ring-2 focus:ring-[#C01140]/10 outline-none transition-all shadow-inner"
                            />
                        </div>
                        
                        <div className="space-y-8 pt-4 overflow-y-auto max-h-[600px] pr-4 custom-scrollbar">
                            {filteredTranscript.length > 0 ? filteredTranscript.map((line: any, i: number) => (
                                <div key={i} className="flex group gap-6">
                                    <div className="w-16 pt-1 text-xs text-[#A1A1AA] font-mono shrink-0 text-right opacity-60 group-hover:opacity-100 transition-opacity">
                                        {new Date((line.start_secs || 0) * 1000).toISOString().substr(14, 5)}
                                    </div>
                                    <div className="flex-1 pb-4 border-b border-[#F4F4F5] group-last:border-0">
                                        <div className="text-sm font-bold text-[#18181B] mb-1.5 flex items-center">
                                            {line.speaker_name}
                                            {line.sentiment === 'positive' && <span className="ml-2 w-2 h-2 rounded-full bg-green-500" title="Positive sentiment" />}
                                        </div>
                                        <div className="text-[#3F3F46] leading-relaxed text-[15px]">{line.text}</div>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-20 text-[#A1A1AA]">
                                    {searchQuery ? "No matches found for your search." : "Transcript is not available yet."}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'actionItems' && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-bold text-[#18181B] mb-4">Identified Tasks</h2>
                        {actionItems.length > 0 ? actionItems.map((item: any, i: number) => (
                            <div key={i} className="flex items-start p-5 bg-[#FAFAFA] border border-[#E4E4E7] rounded-xl hover:shadow-md transition-all group">
                                <div className="mt-1 w-6 h-6 rounded-md border-2 border-[#D1D1D6] mr-5 flex-shrink-0 cursor-pointer hover:border-[#C01140] transition-colors group-hover:bg-white flex items-center justify-center">
                                    {/* Checkmark icon could go here if completed */}
                                </div>
                                <div className="flex-1">
                                    <p className="text-[#18181B] font-medium text-lg mb-3 leading-snug">{item.task}</p>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center bg-white border border-[#E4E4E7] px-2.5 py-1 rounded-full text-xs font-semibold text-[#71717A]">
                                            <span className="w-4 h-4 rounded-full bg-[#C01140] flex items-center justify-center mr-2 text-[10px] text-white">
                                                {item.assignee?.charAt(0) || 'A'}
                                            </span>
                                            {item.assignee || 'Assigned to team'}
                                        </div>
                                        {item.due_date || item.deadline ? (
                                            <span className="text-xs text-[#A1A1AA] font-medium">Due: {item.due_date || item.deadline}</span>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-20 bg-[#FAFAFA] rounded-xl border border-dashed border-[#E4E4E7]">
                                <p className="text-[#A1A1AA]">No specific action items were detected in this meeting.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'topics' && (
                    <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {topics.map((topic: string, i: number) => (
                                <div key={i} className="p-6 bg-white border border-[#E4E4E7] rounded-xl shadow-sm hover:border-[#C01140] transition-all group">
                                    <div className="text-[#C01140] font-bold text-2xl mb-2 opacity-10 group-hover:opacity-30 transition-opacity">0{i+1}</div>
                                    <h3 className="font-bold text-[#18181B] text-lg mb-2">{typeof topic === 'string' ? topic : (topic as any).title}</h3>
                                    <p className="text-sm text-[#71717A]">{typeof topic === 'string' ? "AI extracted topic with detailed context." : (topic as any).summary}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
            </div>
        </div>
    );
};

export default MeetingDetailPage;
