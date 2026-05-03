import React, { useState } from 'react';
import { Video, ArrowRight } from 'lucide-react';
import { generateRoomWithoutSeparator } from '@jitsi/js-utils/random';
import { supabase } from '../../supabase-auth/client';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '../../../components/ui/select';

interface IProps {
    onMeetingScheduled?: () => Promise<void> | void;
}

const QuickStartCard: React.FC<IProps> = ({ onMeetingScheduled }) => {
    const [roomName, setRoomName] = useState('');
    const [mode, setMode] = useState<'start' | 'schedule'>('start');
    const [title, setTitle] = useState('');
    const now = new Date();
    const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
    const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
    const [selectedDay, setSelectedDay] = useState(String(now.getDate()).padStart(2, '0'));
    const [selectedHour, setSelectedHour] = useState(String(now.getHours()).padStart(2, '0'));
    const [selectedMinute, setSelectedMinute] = useState(String(Math.floor(now.getMinutes() / 5) * 5).padStart(2, '0'));
    const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    const [inviteEmails, setInviteEmails] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const timezones = [
        'UTC',
        'Asia/Karachi',
        'America/New_York',
        'America/Los_Angeles',
        'Europe/London',
        'Europe/Berlin',
        'Asia/Dubai',
        'Asia/Kolkata'
    ];
    const months = [
        { value: '01', label: 'January' },
        { value: '02', label: 'February' },
        { value: '03', label: 'March' },
        { value: '04', label: 'April' },
        { value: '05', label: 'May' },
        { value: '06', label: 'June' },
        { value: '07', label: 'July' },
        { value: '08', label: 'August' },
        { value: '09', label: 'September' },
        { value: '10', label: 'October' },
        { value: '11', label: 'November' },
        { value: '12', label: 'December' }
    ];
    const years = Array.from({ length: 6 }, (_, i) => String(now.getFullYear() + i));
    const daysInMonth = new Date(Number(selectedYear), Number(selectedMonth), 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, '0'));
    const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

    const handleJoin = (e: React.FormEvent) => {
        e.preventDefault();
        const room = roomName.trim() || generateRoomWithoutSeparator();
        window.location.href = `/${room}`;
    };

    const handleSchedule = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !selectedYear || !selectedMonth || !selectedDay || !selectedHour || !selectedMinute) {
            setStatusMessage('Please provide title, date, and time.');
            return;
        }

        setSubmitting(true);
        setStatusMessage(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setStatusMessage('Please sign in again to schedule a meeting.');
                return;
            }

            const scheduledAt = new Date(`${selectedYear}-${selectedMonth}-${selectedDay}T${selectedHour}:${selectedMinute}:00`);
            const meetingRes = await fetch('/api/v1/meetings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    title,
                    status: 'scheduled',
                    scheduled_for: scheduledAt.toISOString(),
                    description: `Scheduled via dashboard (${timezone})`
                })
            });
            if (!meetingRes.ok) {
                throw new Error('Failed to create meeting');
            }
            const meeting = await meetingRes.json();

            const emails = inviteEmails
                .split(',')
                .map(s => s.trim())
                .filter(Boolean);
            if (emails.length > 0) {
                await fetch(`/api/v1/meetings/${meeting.id}/invites`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({
                        invites: emails.map(email => ({ email }))
                    })
                });
            }

            await onMeetingScheduled?.();
            setStatusMessage('Meeting scheduled successfully. Invites created.');
            setTitle('');
            setInviteEmails('');
        } catch (err) {
            setStatusMessage('Unable to schedule meeting right now.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="bg-[#FFFFFF] border border-[#E4E4E7] rounded-xl overflow-hidden shadow-sm relative h-full">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#C01140] to-red-500"></div>
            <div className="p-6 flex h-full flex-col">
                <div className="flex items-start justify-between gap-4 mb-5">
                    <div className="flex items-center">
                        <div className="p-2 bg-[#C01140]/10 rounded-lg mr-3">
                            <Video className="h-5 w-5 text-[#C01140]" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-[#18181B]">Start or Schedule</h2>
                            <p className="text-sm text-[#71717A]">Choose the next meeting action without leaving the dashboard.</p>
                        </div>
                    </div>
                    <span className="inline-flex items-center rounded-full border border-[#E4E4E7] bg-[#FAFAFA] px-2.5 py-1 text-[11px] font-medium text-[#71717A]">
                        Planning
                    </span>
                </div>

                <div className="mb-5 flex rounded-lg border border-[#E4E4E7] p-1 bg-[#FAFAFA]">
                    <button
                        onClick={() => setMode('start')}
                        className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${mode === 'start' ? 'bg-white text-[#18181B] shadow-sm' : 'text-[#71717A] hover:text-[#18181B]'}`}
                    >
                        Start instantly
                    </button>
                    <button
                        onClick={() => setMode('schedule')}
                        className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${mode === 'schedule' ? 'bg-white text-[#18181B] shadow-sm' : 'text-[#71717A] hover:text-[#18181B]'}`}
                    >
                        Schedule ahead
                    </button>
                </div>

                {mode === 'start' ? (
                    <>
                        <div className="mb-6 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-4">
                            <p className="text-sm font-medium text-[#18181B] mb-1">Launch a live room</p>
                            <p className="text-sm text-[#71717A]">
                                Start a room now and begin live transcription immediately. Leave the room name blank to auto-generate one.
                            </p>
                        </div>

                        <form onSubmit={handleJoin} className="space-y-4 mt-auto">
                            <label className="block text-sm font-medium text-[#18181B]">
                                Room name
                            </label>
                            <input
                                type="text"
                                placeholder="Optional custom room name"
                                className="w-full bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg px-4 py-3 text-[#18181B] placeholder-[#A1A1AA] focus:outline-none focus:border-[#C01140] focus:ring-1 focus:ring-[#C01140] transition-shadow"
                                value={roomName}
                                onChange={(e) => setRoomName(e.target.value)}
                                pattern="^[^?&:\u0022\u0027%#]+$"
                            />
                            
                            <button
                                type="submit"
                                className="w-full flex items-center justify-center bg-[#C01140] hover:bg-[#A00F35] text-white font-medium py-3 px-4 rounded-lg transition-colors shadow-lg shadow-[#C01140]/20"
                            >
                                Start Live Meeting <ArrowRight className="ml-2 h-4 w-4" />
                            </button>
                        </form>
                    </>
                ) : (
                    <>
                        <div className="mb-6 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-4">
                            <p className="text-sm font-medium text-[#18181B] mb-1">Prepare an upcoming session</p>
                            <p className="text-sm text-[#71717A]">
                                Create the meeting first, then share invites. It will appear in Scheduled Meetings as soon as it is saved.
                            </p>
                        </div>

                        <form onSubmit={handleSchedule} className="space-y-3">
                            <input
                                type="text"
                                placeholder="Meeting title"
                                className="w-full bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg px-4 py-2.5 text-[#18181B] placeholder-[#A1A1AA] focus:outline-none focus:border-[#C01140]"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                required
                            />
                            <div className="grid grid-cols-3 gap-2">
                                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                    <SelectTrigger className="w-full bg-[#F4F4F5] border-[#E4E4E7] text-[#18181B]">
                                        <SelectValue placeholder="Month" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {months.map(m => (
                                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select value={selectedDay} onValueChange={setSelectedDay}>
                                    <SelectTrigger className="w-full bg-[#F4F4F5] border-[#E4E4E7] text-[#18181B]">
                                        <SelectValue placeholder="Day" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {days.map(day => (
                                            <SelectItem key={day} value={day}>{day}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select value={selectedYear} onValueChange={setSelectedYear}>
                                    <SelectTrigger className="w-full bg-[#F4F4F5] border-[#E4E4E7] text-[#18181B]">
                                        <SelectValue placeholder="Year" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {years.map(year => (
                                            <SelectItem key={year} value={year}>{year}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <Select value={selectedHour} onValueChange={setSelectedHour}>
                                    <SelectTrigger className="w-full bg-[#F4F4F5] border-[#E4E4E7] text-[#18181B]">
                                        <SelectValue placeholder="Hour" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {hours.map(hour => (
                                            <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select value={selectedMinute} onValueChange={setSelectedMinute}>
                                    <SelectTrigger className="w-full bg-[#F4F4F5] border-[#E4E4E7] text-[#18181B]">
                                        <SelectValue placeholder="Minute" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {minutes.map(minute => (
                                            <SelectItem key={minute} value={minute}>{minute}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Select value={timezone} onValueChange={setTimezone}>
                                <SelectTrigger className="w-full bg-[#F4F4F5] border-[#E4E4E7] text-[#18181B]">
                                    <SelectValue placeholder="Select timezone" />
                                </SelectTrigger>
                                <SelectContent>
                                    {timezones.map(tz => (
                                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <textarea
                                placeholder="Invite emails (comma separated)"
                                className="w-full bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg px-4 py-2.5 text-[#18181B] placeholder-[#A1A1AA] focus:outline-none focus:border-[#C01140] min-h-[76px]"
                                value={inviteEmails}
                                onChange={(e) => setInviteEmails(e.target.value)}
                            />
                            {statusMessage && (
                                <p className={`text-xs ${statusMessage.includes('successfully') ? 'text-green-700' : 'text-[#71717A]'}`}>
                                    {statusMessage}
                                </p>
                            )}
                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-[#18181B] hover:bg-black text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-70"
                            >
                                {submitting ? 'Scheduling...' : 'Save Scheduled Meeting'}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
};

export default QuickStartCard;
