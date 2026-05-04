import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { supabase } from '../client';
import { Auth } from './Auth.web';
import { updateSettings } from '../../base/settings/actions';

interface AuthWrapperProps {
    children: React.ReactNode;
}

export const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const dispatch = useDispatch();

    useEffect(() => {
        const syncSession = (nextSession: any) => {
            setSession(nextSession);

            if (nextSession?.user?.email) {
                dispatch(updateSettings({
                    displayName: nextSession.user.email.split('@')[0],
                    email: nextSession.user.email
                }));
            }

            setLoading(false);
        };

        supabase.auth.getSession().then(({ data: { session } }) => {
            syncSession(session);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            syncSession(session);
        });

        return () => subscription.unsubscribe();
    }, [dispatch]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f4f4f5] flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-[#c01140] border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!session) {
        return <Auth />;
    }

    return <>{children}</>;
};
