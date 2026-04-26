import React from 'react';

import AuthLayout from './AuthLayout';
import { Button } from '@/react/components/ui/button';
import { Input } from '@/react/components/ui/input';
import { Label } from '@/react/components/ui/label';

const ForgotPasswordForm = () => {
    return (
        <AuthLayout
            subtitle = 'We will send a reset link to your email'
            title = 'Forgot password'>
            <div className = 'space-y-4'>
                <div className = 'space-y-2'>
                    <Label htmlFor = 'forgot-email'>Email</Label>
                    <Input id = 'forgot-email' placeholder = 'user@example.com' type = 'email' />
                </div>
                <Button className = 'h-11 w-full rounded-full bg-rose-700 text-base hover:bg-rose-800'>
                    Send reset link
                </Button>
            </div>
        </AuthLayout>
    );
};

export default ForgotPasswordForm;
