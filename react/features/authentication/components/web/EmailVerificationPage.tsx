import React from 'react';

import AuthLayout from './AuthLayout';
import { Button } from '@/react/components/ui/button';

const EmailVerificationPage = () => {
    return (
        <AuthLayout
            subtitle = 'Please verify your email before continuing'
            title = 'Check your inbox'>
            <div className = 'space-y-4 text-center'>
                <p className = 'text-sm text-slate-600'>
                    We sent a verification link to your email address.
                </p>
                <Button className = 'h-11 w-full rounded-full bg-rose-700 text-base hover:bg-rose-800'>
                    Resend verification email
                </Button>
            </div>
        </AuthLayout>
    );
};

export default EmailVerificationPage;
