import React, { useEffect, useState } from 'react';
import { connect } from 'react-redux';
import { translate } from '../../base/i18n/functions';
import Sidebar from './Sidebar';
import QuickStartCard from './QuickStartCard';
import ScheduledMeetingsPanel from './ScheduledMeetingsPanel';
import StatsRow from './StatsRow';
import RecentMeetingsGrid from './RecentMeetingsGrid';
import UploadZoneCard from './UploadZoneCard';
import ActionItemsList from './ActionItemsList';
import SettingsView from './SettingsView';
import MeetingDetailPage from './MeetingDetailPage';
import TeamChatView from './TeamChatView';
import { useDashboardData } from '../hooks/useDashboardData';

interface IProps {
    t: Function;
}

const DashboardPage: React.FC<IProps> = ({ t }) => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [selectedMeetingId, setSelectedMeetingId] = useState<string | number | null>(null);
    const { meetings, stats, actionItems, loading, error, refresh } = useDashboardData();

    const getMeetingTimestamp = (value?: string | null) => {
        if (!value) {
            return 0;
        }

        const timestamp = new Date(value).getTime();

        return Number.isNaN(timestamp) ? 0 : timestamp;
    };

    const scheduledMeetings = [...meetings]
        .filter((meeting: any) => meeting.status?.toLowerCase() === 'scheduled')
        .sort((a: any, b: any) => getMeetingTimestamp(a.scheduled_for) - getMeetingTimestamp(b.scheduled_for))
        .slice(0, 3);

    const recentMeetings = [...meetings]
        .filter((meeting: any) => meeting.status?.toLowerCase() !== 'scheduled')
        .sort((a: any, b: any) => {
            const aTimestamp = getMeetingTimestamp(a.updated_at || a.created_at || a.scheduled_for);
            const bTimestamp = getMeetingTimestamp(b.updated_at || b.created_at || b.scheduled_for);

            return bTimestamp - aTimestamp;
        });

    const handleMeetingClick = (id: string | number) => {
        setSelectedMeetingId(id);
    };

    const handleBackToDashboard = () => {
        setSelectedMeetingId(null);
    };

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        // Leaving detail page should happen automatically when user navigates
        // via sidebar to another section.
        setSelectedMeetingId(null);
    };

    return (
        <div className="flex h-screen w-full bg-[#FAFAFA] text-[#18181B] font-sans overflow-hidden">
            <Sidebar 
                activeTab={activeTab} 
                setActiveTab={handleTabChange} 
                isCollapsed={isSidebarCollapsed} 
                setIsCollapsed={setIsSidebarCollapsed} 
            />
            
            <main className="flex-1 overflow-y-auto p-8 lg:p-12">
                <div className="max-w-7xl mx-auto space-y-8">
                    {selectedMeetingId ? (
                        <MeetingDetailPage 
                            meetingId={selectedMeetingId} 
                            onBack={handleBackToDashboard} 
                        />
                    ) : (
                        <>
                            {activeTab === 'dashboard' && (
                                <>
                                    <header className="flex justify-between items-end mb-8">
                                        <div>
                                            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                                            <p className="text-[#71717A] mt-1">Welcome back. Here's what's happening with your meetings.</p>
                                        </div>
                                    </header>
                                    
                                    <StatsRow statsData={stats} loading={loading} />

                                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
                                        <div className="xl:col-span-2">
                                            <ScheduledMeetingsPanel
                                                meetings={scheduledMeetings}
                                                loading={loading}
                                                onViewAll={() => setActiveTab('meetings')}
                                                onMeetingClick={handleMeetingClick}
                                            />
                                        </div>

                                        <div className="xl:col-span-1">
                                            <QuickStartCard onMeetingScheduled={refresh} />
                                        </div>
                                    </div>

                                    <RecentMeetingsGrid 
                                        meetings={recentMeetings}
                                        loading={loading}
                                        onViewAll={() => setActiveTab('meetings')}
                                        onMeetingClick={handleMeetingClick}
                                        emptyTitle="No recent meetings"
                                        emptyDescription="Completed and active sessions will show up here once you start recording or transcription begins."
                                    />

                                    <div className="max-w-md">
                                        <UploadZoneCard />
                                    </div>
                                </>
                            )}

                            {activeTab === 'meetings' && (
                                <>
                                    <header className="flex justify-between items-end mb-8">
                                        <div>
                                            <h1 className="text-3xl font-bold tracking-tight">All Meetings</h1>
                                            <p className="text-[#71717A] mt-1">Browse, search, and review both upcoming and past meetings.</p>
                                        </div>
                                    </header>
                                    <RecentMeetingsGrid 
                                        meetings={meetings}
                                        loading={loading}
                                        onMeetingClick={handleMeetingClick}
                                    />
                                </>
                            )}

                            {activeTab === 'action-items' && (
                                <>
                                    <header className="flex justify-between items-end mb-8">
                                        <div>
                                            <h1 className="text-3xl font-bold tracking-tight">Action Items</h1>
                                            <p className="text-[#71717A] mt-1">Manage and track action items extracted from your meetings.</p>
                                        </div>
                                    </header>
                                    <ActionItemsList items={actionItems} loading={loading} />
                                </>
                            )}

                            {activeTab === 'recordings' && (
                                <>
                                    <header className="flex justify-between items-end mb-8">
                                        <div>
                                            <h1 className="text-3xl font-bold tracking-tight">Recordings</h1>
                                            <p className="text-[#71717A] mt-1">Upload and manage raw audio/video files.</p>
                                        </div>
                                    </header>
                                    <div className="max-w-md mx-auto mt-12">
                                        <UploadZoneCard />
                                    </div>
                                </>
                            )}

                            {(activeTab === 'teams' || activeTab === 'team-chat') && (
                                <>
                                    <header className="flex justify-between items-end mb-8">
                                        <div>
                                            <h1 className="text-3xl font-bold tracking-tight">{activeTab === 'teams' ? 'Teams' : 'Team Chat'}</h1>
                                            <p className="text-[#71717A] mt-1">Create teams, organize channels, and collaborate in persistent chats.</p>
                                        </div>
                                    </header>
                                    <TeamChatView mode={activeTab === 'teams' ? 'teams' : 'chat'} />
                                </>
                            )}
                            
                            {activeTab === 'settings' && (
                                <>
                                    <header className="flex justify-between items-end mb-8">
                                        <div>
                                            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                                            <p className="text-[#71717A] mt-1">Configure your account and AI preferences.</p>
                                        </div>
                                    </header>
                                    <SettingsView />
                                </>
                            )}
                        </>
                    )}
                </div>
            </main>


            {/* Runtime Style Overrides for Light Mode */}
            <style>{`
                .bg-\\[\\#FAFAFA\\] { background-color: #FAFAFA; }
                .text-\\[\\#18181B\\] { color: #18181B; }
                .text-\\[\\#71717A\\] { color: #71717A; }
                .bg-\\[\\#FFFFFF\\] { background-color: #FFFFFF; }
                .border-\\[\\#E4E4E7\\] { border-color: #E4E4E7; }
            `}</style>
        </div>
    );
};

export default translate(connect()(DashboardPage));
