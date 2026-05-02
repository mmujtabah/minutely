import React, { useEffect, useState } from 'react';
import { connect } from 'react-redux';
import { translate } from '../../base/i18n/functions';
import Sidebar from './Sidebar';
import QuickStartCard from './QuickStartCard';
import StatsRow from './StatsRow';
import RecentMeetingsGrid from './RecentMeetingsGrid';
import UploadZoneCard from './UploadZoneCard';
import ActionItemsList from './ActionItemsList';
import SettingsView from './SettingsView';
import MeetingDetailPage from './MeetingDetailPage';
import { useDashboardData } from '../hooks/useDashboardData';

interface IProps {
    t: Function;
}

const DashboardPage: React.FC<IProps> = ({ t }) => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [selectedMeetingId, setSelectedMeetingId] = useState<string | number | null>(null);
    const { meetings, stats, actionItems, loading, error } = useDashboardData();

    const handleMeetingClick = (id: string | number) => {
        setSelectedMeetingId(id);
    };

    const handleBackToDashboard = () => {
        setSelectedMeetingId(null);
    };

    return (
        <div className="flex h-screen w-full bg-[#FAFAFA] text-[#18181B] font-sans overflow-hidden">
            <Sidebar 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
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
                                    
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                        <div className="col-span-1 lg:col-span-2 space-y-8">
                                            <RecentMeetingsGrid 
                                                meetings={meetings}
                                                loading={loading}
                                                onViewAll={() => setActiveTab('meetings')}
                                                onMeetingClick={handleMeetingClick}
                                            />
                                        </div>
                                        
                                        <div className="col-span-1 space-y-8">
                                            <QuickStartCard />
                                            <UploadZoneCard />
                                        </div>
                                    </div>
                                </>
                            )}

                            {activeTab === 'meetings' && (
                                <>
                                    <header className="flex justify-between items-end mb-8">
                                        <div>
                                            <h1 className="text-3xl font-bold tracking-tight">All Meetings</h1>
                                            <p className="text-[#71717A] mt-1">Browse, search, and review your past meeting transcripts.</p>
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
