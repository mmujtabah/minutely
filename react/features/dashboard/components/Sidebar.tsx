import React, { useState, useEffect } from 'react';
import { Home, Video, CheckSquare, UploadCloud, Settings, LogOut, ChevronLeft, ChevronRight, Menu, X, Users, MessageSquare } from 'lucide-react';
import { supabase } from '../../supabase-auth/client';

interface SidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    isCollapsed: boolean;
    setIsCollapsed: (collapsed: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isCollapsed, setIsCollapsed }) => {
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [userProfile, setUserProfile] = useState<any>(null);

    useEffect(() => {
        const getFallbackProfile = (session: any) => {
            const fullName = session?.user?.user_metadata?.full_name
                || session?.user?.user_metadata?.name
                || session?.user?.email?.split('@')[0]
                || 'User';

            return {
                full_name: fullName,
                email: session?.user?.email || ''
            };
        };

        const syncProfile = async (session: any) => {
            if (!session) {
                setUserProfile(null);
                return;
            }

            setUserProfile(getFallbackProfile(session));

            try {
                const res = await fetch('/api/v1/users/me', {
                    headers: { 'Authorization': `Bearer ${session.access_token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setUserProfile({
                        ...getFallbackProfile(session),
                        ...data
                    });
                }
            } catch (err) {
                console.error("Failed to fetch profile:", err);
            }
        };

        supabase.auth.getSession().then(({ data: { session } }) => {
            void syncProfile(session);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            void syncProfile(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Helper to close mobile menu on tab switch
    const handleTabClick = (id: string) => {
        setActiveTab(id);
        setIsMobileOpen(false);
    };

    const sidebarContent = (
        <>
            <div>
                <div className={`p-6 flex ${isCollapsed && !isMobileOpen ? 'justify-center' : 'justify-start'} items-center`}>
                    {isCollapsed && !isMobileOpen ? (
                        <div className="h-8 w-8 bg-[#C01140] rounded-lg flex items-center justify-center font-bold text-white">M</div>
                    ) : (
                        <img src="/images/minutely-logo.png" alt="Minutely" className="h-8" />
                    )}
                </div>
                
                <nav className="mt-2 px-3 space-y-2">
                    <NavItem icon={Home} label="Dashboard" id="dashboard" activeTab={activeTab} setActiveTab={handleTabClick} isCollapsed={isCollapsed && !isMobileOpen} />
                    <NavItem icon={Video} label="Meetings" id="meetings" activeTab={activeTab} setActiveTab={handleTabClick} isCollapsed={isCollapsed && !isMobileOpen} />
                    <NavItem icon={CheckSquare} label="Action Items" id="action-items" activeTab={activeTab} setActiveTab={handleTabClick} isCollapsed={isCollapsed && !isMobileOpen} />
                    <NavItem icon={UploadCloud} label="Recordings" id="recordings" activeTab={activeTab} setActiveTab={handleTabClick} isCollapsed={isCollapsed && !isMobileOpen} />
                    <NavItem icon={Users} label="Teams" id="teams" activeTab={activeTab} setActiveTab={handleTabClick} isCollapsed={isCollapsed && !isMobileOpen} />
                    <NavItem icon={MessageSquare} label="Team Chat" id="team-chat" activeTab={activeTab} setActiveTab={handleTabClick} isCollapsed={isCollapsed && !isMobileOpen} />
                </nav>
            </div>
            
            <div className="p-3 border-t border-[#E4E4E7] space-y-2">
                <NavItem icon={Settings} label="Settings" id="settings" activeTab={activeTab} setActiveTab={handleTabClick} isCollapsed={isCollapsed && !isMobileOpen} />
                
                {/* User Profile Avatar */}
                {userProfile && (
                    <div className={`flex items-center ${isCollapsed && !isMobileOpen ? 'justify-center' : 'px-4'} py-3 mt-2`}>
                        <div className="h-8 w-8 rounded-full bg-[#E4E4E7] flex-shrink-0 flex items-center justify-center font-bold text-[#18181B] text-xs">
                            {(userProfile.full_name || userProfile.email || '?').charAt(0).toUpperCase()}
                        </div>
                        {(!isCollapsed || isMobileOpen) && (
                            <div className="ml-3 truncate">
                                <p className="text-sm font-medium text-[#18181B] truncate">{userProfile.full_name || 'User'}</p>
                                <p className="text-xs text-[#71717A] truncate">{userProfile.email}</p>
                            </div>
                        )}
                    </div>
                )}

                <button 
                    onClick={() => supabase.auth.signOut().then(() => window.location.reload())}
                    className={`w-full flex items-center ${isCollapsed && !isMobileOpen ? 'justify-center px-0' : 'px-4'} py-3 text-sm font-medium rounded-lg text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5] transition-colors`}
                    title={isCollapsed && !isMobileOpen ? "Sign Out" : ""}
                >
                    <LogOut className={`h-5 w-5 ${isCollapsed && !isMobileOpen ? 'mr-0' : 'mr-3'}`} />
                    {(!isCollapsed || isMobileOpen) && <span>Sign Out</span>}
                </button>
            </div>
        </>
    );

    return (
        <>
            {/* Mobile Hamburger Button */}
            <button 
                onClick={() => setIsMobileOpen(true)}
                className="md:hidden fixed top-6 left-6 z-20 p-2 bg-white border border-[#E4E4E7] rounded-lg shadow-sm"
            >
                <Menu className="h-5 w-5 text-[#18181B]" />
            </button>

            {/* Mobile Drawer Overlay */}
            {isMobileOpen && (
                <div 
                    className="md:hidden fixed inset-0 bg-black/20 z-40 backdrop-blur-sm"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* Mobile Sidebar */}
            <aside 
                className={`md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-[#FFFFFF] border-r border-[#E4E4E7] flex flex-col justify-between transform transition-transform duration-300 ease-in-out ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                <button 
                    onClick={() => setIsMobileOpen(false)}
                    className="absolute top-6 right-4 p-2 text-[#71717A] hover:text-[#18181B]"
                >
                    <X className="h-5 w-5" />
                </button>
                {sidebarContent}
            </aside>

            {/* Desktop Sidebar */}
            <aside className={`${isCollapsed ? 'w-20' : 'w-64'} transition-all duration-300 bg-[#FFFFFF] border-r border-[#E4E4E7] flex-col justify-between hidden md:flex relative z-30`}>
                {/* Collapse Toggle Button */}
                <button 
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="absolute -right-3 top-8 bg-[#FFFFFF] border border-[#E4E4E7] rounded-full p-1 text-[#71717A] hover:text-[#18181B] shadow-sm z-10"
                >
                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </button>

                {sidebarContent}
            </aside>
        </>
    );
};

interface NavItemProps {
    icon: any;
    label: string;
    id: string;
    activeTab: string;
    setActiveTab: (tab: string) => void;
    isCollapsed: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ icon: Icon, label, id, activeTab, setActiveTab, isCollapsed }) => {
    const active = activeTab === id;
    return (
        <button 
            onClick={() => setActiveTab(id)}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'px-4'} py-3 text-sm font-medium rounded-lg transition-all relative ${
                active 
                    ? 'bg-[#C01140]/5 text-[#C01140] font-semibold' 
                    : 'text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5]'
            }`}
            title={isCollapsed ? label : ""}
        >
            {/* Active Indicator Line */}
            {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-[#C01140] rounded-r-md" />
            )}
            
            <Icon className={`h-5 w-5 ${isCollapsed ? 'mr-0' : 'mr-3'}`} />
            {!isCollapsed && <span>{label}</span>}
        </button>
    );
};

export default Sidebar;
