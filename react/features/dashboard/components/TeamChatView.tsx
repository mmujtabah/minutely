import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase-auth/client';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '../../../components/ui/select';

interface Team {
    id: string;
    name: string;
}

interface Channel {
    id: string;
    name: string;
}

interface Message {
    id: string;
    body: string;
    sender_name?: string;
    created_at: string;
}

interface Props {
    mode: 'teams' | 'chat';
}

const TeamChatView = ({ mode }: Props) => {
    const [teams, setTeams] = useState<Team[]>([]);
    const [channels, setChannels] = useState<Channel[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [selectedTeam, setSelectedTeam] = useState<string>('');
    const [selectedChannel, setSelectedChannel] = useState<string>('');
    const [newTeamName, setNewTeamName] = useState('');
    const [newChannelName, setNewChannelName] = useState('');
    const [newMessage, setNewMessage] = useState('');
    const [status, setStatus] = useState<string>('');
    const [busy, setBusy] = useState(false);
    const [backendHint, setBackendHint] = useState<string>('');

    const readErrorMessage = async (res: Response, fallback: string) => {
        try {
            const data = await res.json();
            return data?.error || fallback;
        } catch {
            return fallback;
        }
    };

    const backendRouteHint = () => {
        setBackendHint(
            'The /api/v1/teams route is not available on the server currently responding at this origin. ' +
            'Restart the updated Minutely API and ensure the web app is proxied to it.'
        );
    };

    const apiFetch = async (path: string, init?: RequestInit) => {
        const res = await fetch(path, init);
        if (res.status === 404 && path.startsWith('/api/v1/teams')) {
            backendRouteHint();
        } else if (res.ok) {
            setBackendHint('');
        }
        return res;
    };

    const authHeaders = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || ''}`
        };
    };

    const loadTeams = async () => {
        const headers = await authHeaders();
        const res = await apiFetch('/api/v1/teams', { headers });
        if (res.ok) {
            const data = await res.json();
            setTeams(data || []);
            if (!selectedTeam && data?.length) {
                setSelectedTeam(data[0].id);
            }
        }
    };

    const loadChannels = async (teamId: string) => {
        if (!teamId) {
            setChannels([]);
            return;
        }
        const headers = await authHeaders();
        const res = await apiFetch(`/api/v1/teams/${teamId}/channels`, { headers });
        if (res.ok) {
            const data = await res.json();
            setChannels(data || []);
            if (data?.length) {
                setSelectedChannel(data[0].id);
            } else {
                setSelectedChannel('');
            }
        }
    };

    const loadMessages = async (teamId: string, channelId: string) => {
        if (!teamId || !channelId) {
            setMessages([]);
            return;
        }
        const headers = await authHeaders();
        const res = await apiFetch(`/api/v1/teams/${teamId}/channels/${channelId}/messages`, { headers });
        if (res.ok) {
            const data = await res.json();
            setMessages((data || []).slice().reverse());
        }
    };

    useEffect(() => {
        loadTeams();
    }, []);

    useEffect(() => {
        loadChannels(selectedTeam);
    }, [selectedTeam]);

    useEffect(() => {
        loadMessages(selectedTeam, selectedChannel);
    }, [selectedTeam, selectedChannel]);

    const createTeam = async () => {
        if (!newTeamName.trim()) {
            return;
        }
        setBusy(true);
        setStatus('');
        const headers = await authHeaders();
        const res = await apiFetch('/api/v1/teams', {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: newTeamName.trim() })
        });
        if (res.ok) {
            setNewTeamName('');
            setStatus('Team created.');
            await loadTeams();
        } else {
            setStatus(await readErrorMessage(res, 'Unable to create team.'));
        }
        setBusy(false);
    };

    const createChannel = async () => {
        if (!selectedTeam || !newChannelName.trim()) {
            return;
        }
        setBusy(true);
        setStatus('');
        const headers = await authHeaders();
        const res = await apiFetch(`/api/v1/teams/${selectedTeam}/channels`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: newChannelName.trim() })
        });
        if (res.ok) {
            setNewChannelName('');
            setStatus('Channel created.');
            await loadChannels(selectedTeam);
        } else {
            setStatus(await readErrorMessage(res, 'Unable to create channel.'));
        }
        setBusy(false);
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTeam || !selectedChannel || !newMessage.trim()) {
            return;
        }
        const headers = await authHeaders();
        const res = await apiFetch(`/api/v1/teams/${selectedTeam}/channels/${selectedChannel}/messages`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ body: newMessage })
        });
        if (res.ok) {
            setNewMessage('');
            await loadMessages(selectedTeam, selectedChannel);
        } else {
            setStatus(await readErrorMessage(res, 'Unable to send message.'));
        }
    };

    return (
        <div className="bg-white border border-[#E4E4E7] rounded-xl shadow-sm p-6 space-y-4">
            {backendHint && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2 text-xs">
                    {backendHint}
                </div>
            )}
            {mode === 'teams' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-[#71717A] uppercase tracking-wide">Teams</label>
                        <Select value={selectedTeam || undefined} onValueChange={setSelectedTeam}>
                            <SelectTrigger className="w-full border-[#E4E4E7] bg-[#FAFAFA] text-[#18181B]">
                                <SelectValue placeholder="Select team" />
                            </SelectTrigger>
                            <SelectContent>
                                {teams.map(t => (
                                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="flex gap-2">
                            <input className="flex-1 border border-[#E4E4E7] rounded-lg px-3 py-2" placeholder="New team name" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} />
                            <button disabled={busy} onClick={createTeam} className="px-3 py-2 rounded-lg bg-[#18181B] text-white text-sm disabled:opacity-60">Create</button>
                        </div>
                    </div>
                    <div className="text-xs text-[#71717A] flex items-end">{status}</div>
                </div>
            )}

            {mode === 'chat' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                    <label className="text-xs font-semibold text-[#71717A] uppercase tracking-wide">Teams</label>
                    <Select value={selectedTeam || undefined} onValueChange={setSelectedTeam}>
                        <SelectTrigger className="w-full border-[#E4E4E7] bg-[#FAFAFA] text-[#18181B]">
                            <SelectValue placeholder="Select team" />
                        </SelectTrigger>
                        <SelectContent>
                            {teams.map(t => (
                                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                        <input className="flex-1 border border-[#E4E4E7] rounded-lg px-3 py-2" placeholder="New team name" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} />
                        <button disabled={busy} onClick={createTeam} className="px-3 py-2 rounded-lg bg-[#18181B] text-white text-sm disabled:opacity-60">Create</button>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-semibold text-[#71717A] uppercase tracking-wide">Channels</label>
                    <Select value={selectedChannel || undefined} onValueChange={setSelectedChannel} disabled={!selectedTeam || channels.length === 0}>
                        <SelectTrigger className="w-full border-[#E4E4E7] bg-[#FAFAFA] text-[#18181B]">
                            <SelectValue placeholder="Select channel" />
                        </SelectTrigger>
                        <SelectContent>
                            {channels.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                        <input className="flex-1 border border-[#E4E4E7] rounded-lg px-3 py-2" placeholder="New channel name" value={newChannelName} onChange={e => setNewChannelName(e.target.value)} />
                        <button disabled={busy} onClick={createChannel} className="px-3 py-2 rounded-lg bg-[#18181B] text-white text-sm disabled:opacity-60">Create</button>
                    </div>
                </div>

                <div className="text-xs text-[#71717A] flex items-end">{status}</div>
                </div>
            )}

            {mode === 'teams' && (
                <div className="border border-[#E4E4E7] bg-[#FAFAFA] rounded-xl p-4 min-h-[200px] space-y-2">
                    <h3 className="text-sm font-semibold text-[#18181B]">Team Overview</h3>
                    <p className="text-sm text-[#71717A]">Use this page to create teams and channels. Chat messages are in the Team Chat tab.</p>
                    {teams.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                            {teams.map(team => (
                                <div key={team.id} className="border border-[#E4E4E7] rounded-lg bg-white p-3 text-sm text-[#18181B]">
                                    {team.name}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {mode === 'chat' && (
                <div className="border border-[#E4E4E7] bg-[#FAFAFA] rounded-xl p-4 min-h-[320px] max-h-[420px] overflow-y-auto space-y-3">
                {messages.length === 0 ? (
                    <p className="text-sm text-[#71717A]">No messages yet in this channel.</p>
                ) : messages.map(m => (
                    <div key={m.id} className="bg-white border border-[#E4E4E7] rounded-lg p-3">
                        <div className="text-xs text-[#71717A] mb-1">{m.sender_name || 'Member'} • {new Date(m.created_at).toLocaleString()}</div>
                        <div className="text-sm text-[#18181B]">{m.body}</div>
                    </div>
                ))}
                </div>
            )}

            {mode === 'chat' && <form onSubmit={sendMessage} className="flex gap-2">
                <input className="flex-1 border border-[#E4E4E7] rounded-lg px-3 py-2.5" placeholder="Send a message..." value={newMessage} onChange={e => setNewMessage(e.target.value)} />
                <button type="submit" className="px-4 py-2.5 rounded-lg bg-[#C01140] text-white font-medium">Send</button>
            </form>}
        </div>
    );
};

export default TeamChatView;
