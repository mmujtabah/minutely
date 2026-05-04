import { useState, useEffect } from 'react';
import { supabase } from '../../supabase-auth/client';

export const useDashboardData = () => {
    const [state, setState] = useState({ 
        meetings: [], 
        stats: null, 
        actionItems: [],
        loading: true, 
        error: null as string | null 
    });

    const refresh = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setState(s => ({ ...s, loading: false, error: 'No active session' }));
                return;
            }

            const headers = { 'Authorization': `Bearer ${session.access_token}` };

            const [meetingsRes, statsRes, actionItemsRes] = await Promise.all([
                fetch('/api/v1/meetings/summaries', { headers }),
                fetch('/api/v1/stats', { headers }),
                fetch('/api/v1/action-items', { headers })
            ]);

            if (!meetingsRes.ok || !statsRes.ok || !actionItemsRes.ok) {
                throw new Error('Failed to fetch dashboard data');
            }

            const meetings = await meetingsRes.json() || [];
            const stats = await statsRes.json();
            const actionItems = await actionItemsRes.json() || [];

            setState({ meetings, stats, actionItems, loading: false, error: null });
        } catch (err: any) {
            setState(s => ({ ...s, loading: false, error: err.message }));
        }
    };
    
    useEffect(() => {
        void refresh();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                void refresh();
            } else {
                setState({
                    meetings: [],
                    stats: null,
                    actionItems: [],
                    loading: false,
                    error: 'No active session'
                });
            }
        });

        return () => subscription.unsubscribe();
    }, []);
    
    return {
        ...state,
        refresh
    };
};
