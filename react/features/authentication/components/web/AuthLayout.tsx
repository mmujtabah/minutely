import React from 'react';

import { Card } from '@/react/components/ui/card';

interface IProps {
    children: React.ReactNode;
    subtitle?: string;
    title: string;
}

/**
 * Shared authentication layout that applies the new Phase 2 look.
 */
const AuthLayout = ({ children, subtitle, title }: IProps) => {
    return (
        <div className = 'min-h-[520px] w-full bg-gradient-to-b from-slate-50 via-slate-100 to-slate-200 p-6 sm:p-8'>
            <div className = 'mx-auto max-w-md pt-6 sm:pt-10'>
                <div className = 'mb-6 text-center'>
                    <div className = 'text-3xl font-medium tracking-tight text-slate-900'>
                        Minutely<span className = 'text-rose-700'>.</span>
                    </div>
                </div>
                <Card className = 'rounded-[2rem] border-slate-200/80 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.12)] sm:p-8'>
                    <h2 className = 'text-center text-3xl font-semibold tracking-tight text-slate-900'>
                        {title}
                    </h2>
                    {subtitle && (
                        <p className = 'mt-2 text-center text-sm text-slate-500'>
                            {subtitle}
                        </p>
                    )}
                    <div className = 'mt-6'>
                        {children}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default AuthLayout;
