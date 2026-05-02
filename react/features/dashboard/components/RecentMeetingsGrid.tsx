import React, { useState } from 'react';
import { Calendar, Clock, Users, ArrowRight, CheckSquare, MessageSquare, Search, ChevronDown } from 'lucide-react';

interface IProps {
    meetings?: any[];
    loading?: boolean;
    onViewAll?: () => void;
    onMeetingClick?: (id: string | number) => void;
}

const RecentMeetingsGrid: React.FC<IProps> = ({ meetings = [], loading = false, onViewAll, onMeetingClick }) => {
    const isAllMeetingsMode = !onViewAll;
    const [searchQuery, setSearchQuery] = useState('');
    const [visibleCount, setVisibleCount] = useState(20);

    const filteredMeetings = meetings.filter(m => 
        m.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        m.summary_snippet?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const displayMeetings = isAllMeetingsMode ? filteredMeetings.slice(0, visibleCount) : filteredMeetings.slice(0, 4);

    const getStatusBadge = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'completed':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">Completed</span>;
            case 'in_progress':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">In Progress</span>;
            case 'scheduled':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F4F4F5] text-[#71717A] border border-[#E4E4E7]">Scheduled</span>;
            default:
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F4F4F5] text-[#71717A] border border-[#E4E4E7] capitalize">{status || 'Processed'}</span>;
        }
    };

    return (
        <div className="bg-[#FFFFFF] border border-[#E4E4E7] rounded-xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-[#E4E4E7] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-lg font-semibold text-[#18181B]">
                    {isAllMeetingsMode ? 'All Meetings' : 'Recent Meetings'}
                </h2>
                
                {isAllMeetingsMode ? (
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A1A1AA]" />
                        <input 
                            type="text" 
                            placeholder="Search meetings..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[#FAFAFA] border border-[#E4E4E7] rounded-lg pl-9 pr-4 py-2 text-sm focus:border-[#C01140] focus:ring-1 focus:ring-[#C01140] outline-none transition-all"
                        />
                    </div>
                ) : (
                    <button 
                        onClick={onViewAll}
                        className="text-[#71717A] hover:text-[#18181B] text-sm font-medium flex items-center transition-colors"
                    >
                        View All <ArrowRight className="ml-1 h-4 w-4" />
                    </button>
                )}
            </div>
            
            <div className="divide-y divide-[#E4E4E7]">
                {loading ? (
                    // Skeleton loader (3 items)
                    [1, 2, 3].map((i) => (
                        <div key={i} className="p-6 animate-pulse">
                            <div className="flex justify-between items-start mb-2">
                                <div className="h-5 bg-[#F4F4F5] rounded w-1/3"></div>
                                <div className="h-5 bg-[#F4F4F5] rounded-full w-20"></div>
                            </div>
                            <div className="h-4 bg-[#F4F4F5] rounded w-full mb-2"></div>
                            <div className="h-4 bg-[#F4F4F5] rounded w-2/3 mb-4"></div>
                            <div className="flex space-x-6">
                                <div className="h-4 bg-[#F4F4F5] rounded w-16"></div>
                                <div className="h-4 bg-[#F4F4F5] rounded w-16"></div>
                                <div className="h-4 bg-[#F4F4F5] rounded w-16"></div>
                            </div>
                        </div>
                    ))
                ) : displayMeetings.length === 0 ? (
                    // Empty state
                    <div className="p-12 flex flex-col items-center justify-center text-center">
                        <div className="h-16 w-16 bg-[#F4F4F5] rounded-full flex items-center justify-center mb-4">
                            <MessageSquare className="h-8 w-8 text-[#A1A1AA]" />
                        </div>
                        <h3 className="text-[#18181B] font-medium text-lg mb-1">
                            {searchQuery ? 'No matching meetings' : 'No meetings yet'}
                        </h3>
                        <p className="text-[#71717A] text-sm max-w-sm mb-6">
                            {searchQuery 
                                ? 'Try adjusting your search terms.' 
                                : "You haven't recorded or uploaded any meetings. Start a new meeting to generate insights."}
                        </p>
                    </div>
                ) : (
                    displayMeetings.map((meeting) => (
                        <div 
                            key={meeting.id} 
                            onClick={() => onMeetingClick?.(meeting.id)}
                            className="p-6 hover:bg-[#F4F4F5] transition-colors cursor-pointer group"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-lg font-medium text-[#18181B] group-hover:text-[#C01140] transition-colors">
                                        {meeting.title || 'Untitled Meeting'}
                                    </h3>
                                    {meeting.source && (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-[#F4F4F5] text-[#71717A]">
                                            {meeting.source}
                                        </span>
                                    )}
                                </div>
                                {getStatusBadge(meeting.status)}
                            </div>
                            
                            <p className="text-[#71717A] text-sm mb-4 line-clamp-2">
                                {meeting.summary_snippet || meeting.description || "Meeting transcript generated. No summary available."}
                            </p>
                            
                            <div className="flex items-center space-x-6 text-xs text-[#71717A]">
                                <div className="flex items-center">
                                    <Calendar className="mr-1.5 h-4 w-4 text-[#A1A1AA]" />
                                    {meeting.scheduled_for ? new Date(meeting.scheduled_for).toLocaleDateString() : new Date(meeting.created_at).toLocaleDateString()}
                                </div>
                                <div className="flex items-center">
                                    <Clock className="mr-1.5 h-4 w-4 text-[#A1A1AA]" />
                                    {meeting.duration_secs ? Math.round(meeting.duration_secs / 60) : 0} min
                                </div>
                                <div className="flex items-center">
                                    <Users className="mr-1.5 h-4 w-4 text-[#A1A1AA]" />
                                    {meeting.speaker_count || meeting.participants || 0} participants
                                </div>
                                {meeting.open_action_items > 0 && (
                                    <div className="flex items-center text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full">
                                        <CheckSquare className="mr-1.5 h-3.5 w-3.5" />
                                        {meeting.open_action_items} open task{meeting.open_action_items !== 1 ? 's' : ''}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}

                {isAllMeetingsMode && !loading && displayMeetings.length < filteredMeetings.length && (
                    <div className="p-4 border-t border-[#E4E4E7] flex justify-center">
                        <button 
                            onClick={() => setVisibleCount(v => v + 20)}
                            className="flex items-center px-4 py-2 bg-[#FAFAFA] border border-[#E4E4E7] hover:bg-[#F4F4F5] text-[#18181B] rounded-lg transition-colors text-sm font-medium shadow-sm"
                        >
                            Load More <ChevronDown className="ml-2 h-4 w-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RecentMeetingsGrid;

