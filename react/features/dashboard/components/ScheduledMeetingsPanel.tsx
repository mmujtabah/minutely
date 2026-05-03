import React from 'react';
import { ArrowRight, CalendarDays, Clock3, Users, Video } from 'lucide-react';

interface IProps {
    meetings?: any[];
    loading?: boolean;
    onViewAll?: () => void;
    onMeetingClick?: (id: string | number) => void;
}

const formatMeetingDate = (value?: string) => {
    if (!value) {
        return 'Date pending';
    }

    const date = new Date(value);

    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
};

const formatMeetingTime = (value?: string) => {
    if (!value) {
        return 'Time pending';
    }

    const date = new Date(value);

    return date.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit'
    });
};

const ScheduledMeetingsPanel: React.FC<IProps> = ({
    meetings = [],
    loading = false,
    onViewAll,
    onMeetingClick
}) => (
    <section className="bg-[#FFFFFF] border border-[#E4E4E7] rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-[#E4E4E7] flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <div className="p-2 rounded-lg bg-[#C01140]/10">
                        <CalendarDays className="h-5 w-5 text-[#C01140]" />
                    </div>
                    <h2 className="text-lg font-semibold text-[#18181B]">Scheduled Meetings</h2>
                </div>
                <p className="text-sm text-[#71717A]">
                    Keep upcoming sessions separate from meeting history so planning and review stay distinct.
                </p>
            </div>

            {onViewAll && (
                <button
                    onClick={onViewAll}
                    className="text-[#71717A] hover:text-[#18181B] text-sm font-medium flex items-center transition-colors"
                >
                    View All <ArrowRight className="ml-1 h-4 w-4" />
                </button>
            )}
        </div>

        {loading ? (
            <div className="grid grid-cols-1 xl:grid-cols-3 divide-y xl:divide-y-0 xl:divide-x divide-[#E4E4E7]">
                {[1, 2, 3].map(item => (
                    <div key={item} className="p-6 animate-pulse">
                        <div className="h-4 bg-[#F4F4F5] rounded w-24 mb-4"></div>
                        <div className="h-5 bg-[#F4F4F5] rounded w-2/3 mb-3"></div>
                        <div className="h-4 bg-[#F4F4F5] rounded w-full mb-4"></div>
                        <div className="flex flex-wrap gap-3">
                            <div className="h-4 bg-[#F4F4F5] rounded w-24"></div>
                            <div className="h-4 bg-[#F4F4F5] rounded w-20"></div>
                        </div>
                    </div>
                ))}
            </div>
        ) : meetings.length === 0 ? (
            <div className="p-10 flex flex-col items-center justify-center text-center">
                <div className="h-14 w-14 bg-[#F4F4F5] rounded-full flex items-center justify-center mb-4">
                    <Video className="h-7 w-7 text-[#A1A1AA]" />
                </div>
                <h3 className="text-[#18181B] font-medium text-lg mb-1">No scheduled meetings</h3>
                <p className="text-[#71717A] text-sm max-w-md">
                    Use the scheduler to plan your next session. Upcoming meetings will appear here in chronological order.
                </p>
            </div>
        ) : (
            <div className="grid grid-cols-1 xl:grid-cols-3 divide-y xl:divide-y-0 xl:divide-x divide-[#E4E4E7]">
                {meetings.map(meeting => (
                    <button
                        key={meeting.id}
                        onClick={() => onMeetingClick?.(meeting.id)}
                        className="p-6 text-left hover:bg-[#FAFAFA] transition-colors"
                    >
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F4F4F5] text-[#71717A] border border-[#E4E4E7] mb-4">
                            Scheduled
                        </span>
                        <h3 className="text-lg font-medium text-[#18181B] mb-2 line-clamp-2">
                            {meeting.title || 'Untitled Meeting'}
                        </h3>
                        <p className="text-sm text-[#71717A] mb-5 line-clamp-2">
                            {meeting.description || meeting.summary_snippet || 'Planned meeting ready for invites and transcription.'}
                        </p>
                        <div className="flex flex-wrap gap-4 text-xs text-[#71717A]">
                            <div className="flex items-center">
                                <CalendarDays className="mr-1.5 h-4 w-4 text-[#A1A1AA]" />
                                {formatMeetingDate(meeting.scheduled_for)}
                            </div>
                            <div className="flex items-center">
                                <Clock3 className="mr-1.5 h-4 w-4 text-[#A1A1AA]" />
                                {formatMeetingTime(meeting.scheduled_for)}
                            </div>
                            <div className="flex items-center">
                                <Users className="mr-1.5 h-4 w-4 text-[#A1A1AA]" />
                                {meeting.speaker_count || meeting.participants || 0} participants
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        )}
    </section>
);

export default ScheduledMeetingsPanel;
