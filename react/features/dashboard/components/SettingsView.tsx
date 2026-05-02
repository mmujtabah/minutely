import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Save, User, Bell, Shield, Cpu, Volume2, Video, Keyboard, MoreHorizontal, Image as ImageIcon } from 'lucide-react';

// Jitsi Settings Components
import AudioDevicesSelection from '../../device-selection/components/AudioDevicesSelection.web';
import VideoDeviceSelection from '../../device-selection/components/VideoDeviceSelection.web';
import VirtualBackgroundTab from '../../settings/components/web/VirtualBackgroundTab';
import NotificationsTab from '../../settings/components/web/NotificationsTab';
import ProfileTab from '../../settings/components/web/ProfileTab';
import ShortcutsTab from '../../settings/components/web/ShortcutsTab';
import MoreTab from '../../settings/components/web/MoreTab';

// Jitsi Settings Functions & Actions
import { 
    getAudioDeviceSelectionDialogProps, 
    getVideoDeviceSelectionDialogProps 
} from '../../device-selection/functions.web';
import {
    getVirtualBackgroundTabProps,
    getNotificationsTabProps,
    getShortcutsTabProps,
    getMoreTabProps,
    getProfileTabProps
} from '../../settings/functions.web';
import {
    submitAudioDeviceSelectionTab,
    submitVideoDeviceSelectionTab
} from '../../device-selection/actions.web';
import {
    submitVirtualBackgroundTab,
    submitNotificationsTab,
    submitShortcutsTab,
    submitMoreTab,
    submitProfileTab
} from '../../settings/actions.web';

const SettingsView = () => {
    const dispatch = useDispatch();
    const state = useSelector((state: any) => state);
    const [activeSubTab, setActiveSubTab] = useState('profile');
    const [saved, setSaved] = useState(false);
    
    // Local state to track changes in Jitsi tabs before "Submit"
    const [tabStates, setTabStates] = useState<Record<string, any>>({});

    const handleTabStateChange = (id: string, newState: any) => {
        setTabStates(prev => ({
            ...prev,
            [id]: newState
        }));
    };

    const handleSave = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        
        const currentState = tabStates[activeSubTab];
        
        // Dispatch the appropriate Jitsi submit action based on the active tab
        switch (activeSubTab) {
            case 'profile':
                if (currentState) dispatch(submitProfileTab(currentState));
                break;
            case 'devices-audio':
                if (currentState) dispatch(submitAudioDeviceSelectionTab(currentState, true));
                break;
            case 'devices-video':
                if (currentState) dispatch(submitVideoDeviceSelectionTab(currentState, true));
                break;
            case 'appearance':
                if (currentState) dispatch(submitVirtualBackgroundTab(currentState));
                break;
            case 'notifications':
                if (currentState) dispatch(submitNotificationsTab(currentState));
                break;
            case 'shortcuts':
                if (currentState) dispatch(submitShortcutsTab(currentState));
                break;
            case 'more':
                if (currentState) dispatch(submitMoreTab(currentState));
                break;
        }

        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    const renderJitsiTab = (id: string, Component: any, props: any) => {
        return (
            <div className="jitsi-settings-wrapper">
                <Component 
                    {...props} 
                    {...(tabStates[id] || {})}
                    onTabStateChange={(tabId: string, state: any) => handleTabStateChange(id, state)}
                    tabId={id}
                />
            </div>
        );
    };

    const subTabs = [
        { id: 'profile', label: 'Profile', icon: User, color: 'text-blue-500' },
        { id: 'devices-audio', label: 'Audio', icon: Volume2, color: 'text-purple-500' },
        { id: 'devices-video', label: 'Video', icon: Video, color: 'text-green-500' },
        { id: 'appearance', label: 'Appearance', icon: ImageIcon, color: 'text-pink-500' },
        { id: 'ai', label: 'AI Preferences', icon: Cpu, color: 'text-[#C01140]' },
        { id: 'notifications', label: 'Notifications', icon: Bell, color: 'text-yellow-500' },
        { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard, color: 'text-gray-500' },
        { id: 'more', label: 'More', icon: MoreHorizontal, color: 'text-indigo-500' },
    ];

    return (
        <div className="bg-[#FFFFFF] border border-[#E4E4E7] rounded-xl overflow-hidden shadow-sm flex flex-col md:flex-row min-h-[600px]">
            {/* Sidebar Navigation */}
            <div className="w-full md:w-64 bg-[#F9F9FB] border-r border-[#E4E4E7] p-4 space-y-1">
                {subTabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSubTab(tab.id)}
                        className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all ${
                            activeSubTab === tab.id 
                                ? 'bg-white shadow-sm text-[#18181B] border border-[#E4E4E7]' 
                                : 'text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#18181B]'
                        }`}
                    >
                        <tab.icon className={`h-4 w-4 mr-3 ${activeSubTab === tab.id ? tab.color : ''}`} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 p-8 flex flex-col justify-between">
                <div>
                    <header className="mb-8">
                        <h2 className="text-2xl font-bold text-[#18181B]">
                            {subTabs.find(t => t.id === activeSubTab)?.label} Settings
                        </h2>
                        <p className="text-[#71717A] mt-1 text-sm">
                            Customize your meeting experience and preferences.
                        </p>
                    </header>

                    <div className="max-w-2xl">
                        {activeSubTab === 'profile' && renderJitsiTab('profile', ProfileTab, getProfileTabProps(state))}
                        
                        {activeSubTab === 'devices-audio' && renderJitsiTab('devices-audio', AudioDevicesSelection, getAudioDeviceSelectionDialogProps(state, true))}
                        
                        {activeSubTab === 'devices-video' && renderJitsiTab('devices-video', VideoDeviceSelection, getVideoDeviceSelectionDialogProps(state, true))}
                        
                        {activeSubTab === 'appearance' && renderJitsiTab('appearance', VirtualBackgroundTab, getVirtualBackgroundTabProps(state, true))}
                        
                        {activeSubTab === 'notifications' && renderJitsiTab('notifications', NotificationsTab, getNotificationsTabProps(state, true))}
                        
                        {activeSubTab === 'shortcuts' && renderJitsiTab('shortcuts', ShortcutsTab, getShortcutsTabProps(state, true))}
                        
                        {activeSubTab === 'more' && renderJitsiTab('more', MoreTab, getMoreTabProps(state))}

                        {activeSubTab === 'ai' && (
                            <div className="space-y-6">
                                <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
                                    <p className="text-sm text-red-800 font-medium flex items-center">
                                        <Cpu className="h-4 w-4 mr-2" />
                                        Advanced AI Intelligence (Enabled)
                                    </p>
                                    <p className="text-xs text-red-600 mt-1">Minutely AI is currently using the GPT-4o model for high-precision meeting analysis.</p>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-[#18181B] mb-2">Default Summary Language</label>
                                    <select className="w-full bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg px-4 py-2.5 text-[#18181B] focus:outline-none focus:border-[#C01140] transition-shadow">
                                        <option>Auto-detect (Recommended)</option>
                                        <option>English</option>
                                        <option>Spanish</option>
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer / Save Actions */}
                <div className="mt-12 pt-6 border-t border-[#E4E4E7] flex items-center justify-between">
                    <div>
                        {saved && (
                            <span className="text-green-600 text-sm font-medium animate-pulse">
                                Changes saved successfully!
                            </span>
                        )}
                    </div>
                    <button 
                        onClick={handleSave}
                        className="flex items-center justify-center bg-[#C01140] hover:bg-[#A00F35] text-white font-medium py-2.5 px-8 rounded-lg transition-colors shadow-lg shadow-[#C01140]/20"
                    >
                        <Save className="mr-2 h-4 w-4" />
                        Apply Changes
                    </button>
                </div>
            </div>

            {/* Jitsi CSS Interop Styles */}
            <style>{`
                .jitsi-settings-wrapper input[type="text"],
                .jitsi-settings-wrapper input[type="email"],
                .jitsi-settings-wrapper input[type="password"],
                .jitsi-settings-wrapper select {
                    background-color: #F4F4F5 !important;
                    border: 1px solid #E4E4E7 !important;
                    border-radius: 8px !important;
                    padding: 8px 12px !important;
                    color: #18181B !important;
                    width: 100%;
                    margin-bottom: 16px;
                    outline: none;
                }
                .jitsi-settings-wrapper input[type="text"]:focus,
                .jitsi-settings-wrapper input[type="email"]:focus,
                .jitsi-settings-wrapper select:focus {
                    border-color: #C01140 !important;
                    box-shadow: 0 0 0 2px rgba(192,17,64,0.15) !important;
                }
                .jitsi-settings-wrapper label {
                    display: block;
                    font-size: 14px;
                    font-weight: 500;
                    margin-bottom: 8px;
                    color: #18181B;
                }

                /* ── Unified toggle for ALL checkbox variants ── */
                .jitsi-settings-wrapper input[type="checkbox"] {
                    appearance: none !important;
                    -webkit-appearance: none !important;
                    width: 40px !important;
                    min-width: 40px !important;
                    height: 22px !important;
                    border-radius: 999px !important;
                    border: none !important;
                    background-color: #D4D4D8 !important;
                    position: relative !important;
                    cursor: pointer !important;
                    transition: background-color 0.2s ease !important;
                    margin: 0 !important;
                    margin-right: 12px !important;
                    padding: 0 !important;
                    outline: none !important;
                    flex-shrink: 0 !important;
                }
                .jitsi-settings-wrapper input[type="checkbox"]::before {
                    content: '' !important;
                    position: absolute !important;
                    top: 3px !important;
                    left: 3px !important;
                    width: 16px !important;
                    height: 16px !important;
                    border-radius: 50% !important;
                    background: white !important;
                    transition: transform 0.2s ease !important;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.2) !important;
                }
                .jitsi-settings-wrapper input[type="checkbox"]:checked {
                    background-color: #C01140 !important;
                }
                .jitsi-settings-wrapper input[type="checkbox"]:checked::before {
                    transform: translateX(18px) !important;
                }
                .jitsi-settings-wrapper input[type="checkbox"]:focus-visible {
                    box-shadow: 0 0 0 2px rgba(192,17,64,0.3) !important;
                }

                /* Layout for checkbox rows */
                .jitsi-settings-wrapper .checkbox-label,
                .jitsi-settings-wrapper .jitsi-settings-checkmark-container {
                    display: flex !important;
                    align-items: center !important;
                    cursor: pointer !important;
                    margin-bottom: 16px !important;
                    gap: 0 !important;
                }
                .jitsi-settings-wrapper .checkbox-label span,
                .jitsi-settings-wrapper .jitsi-settings-checkmark-container span {
                    font-size: 14px !important;
                    color: #18181B !important;
                }
            `}</style>
        </div>
    );
};

export default SettingsView;
