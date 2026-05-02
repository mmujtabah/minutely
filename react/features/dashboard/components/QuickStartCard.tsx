import React, { useState } from 'react';
import { Video, ArrowRight } from 'lucide-react';
import { generateRoomWithoutSeparator } from '@jitsi/js-utils/random';

const QuickStartCard = () => {
    const [roomName, setRoomName] = useState('');

    const handleJoin = (e: React.FormEvent) => {
        e.preventDefault();
        const room = roomName.trim() || generateRoomWithoutSeparator();
        window.location.href = `/${room}`;
    };

    return (
        <div className="bg-[#FFFFFF] border border-[#E4E4E7] rounded-xl overflow-hidden shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#C01140] to-red-500"></div>
            <div className="p-6">
                <div className="flex items-center mb-4">
                    <div className="p-2 bg-[#C01140]/10 rounded-lg mr-3">
                        <Video className="h-5 w-5 text-[#C01140]" />
                    </div>
                    <h2 className="text-lg font-semibold text-[#18181B]">Start a Meeting</h2>
                </div>
                
                <p className="text-[#71717A] text-sm mb-6">
                    Join instantly or enter a room name. Live transcription and AI analysis will start automatically.
                </p>

                <form onSubmit={handleJoin} className="space-y-4">
                    <input
                        type="text"
                        placeholder="Enter room name"
                        className="w-full bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg px-4 py-3 text-[#18181B] placeholder-[#A1A1AA] focus:outline-none focus:border-[#C01140] focus:ring-1 focus:ring-[#C01140] transition-shadow"
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                        pattern="^[^?&:\u0022\u0027%#]+$"
                    />
                    
                    <button 
                        type="submit"
                        className="w-full flex items-center justify-center bg-[#C01140] hover:bg-[#A00F35] text-white font-medium py-3 px-4 rounded-lg transition-colors shadow-lg shadow-[#C01140]/20"
                    >
                        Start Meeting <ArrowRight className="ml-2 h-4 w-4" />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default QuickStartCard;
