import React from 'react';

import AuthLayout from './AuthLayout';
import { Button } from '@/react/components/ui/button';
import { Input } from '@/react/components/ui/input';
import { Label } from '@/react/components/ui/label';

const ResetPasswordForm = () => {
    return (
        <AuthLayout
            subtitle = 'Choose a new password for your account'
            title = 'Reset password'>
            <div className = 'space-y-4'>
                <div className = 'space-y-2'>
                    <Label htmlFor = 'reset-password'>New password</Label>
                    <Input id = 'reset-password' placeholder = 'Enter new password' type = 'password' />
                </div>
                <div className = 'space-y-2'>
                    <Label htmlFor = 'reset-confirm-password'>Confirm password</Label>
                    <Input id = 'reset-confirm-password' placeholder = 'Confirm new password' type = 'password' />
                </div>
                <Button className = 'h-11 w-full rounded-full bg-rose-700 text-base hover:bg-rose-800'>
                    Update password
                </Button>
            </div>
        </AuthLayout>
    );
};

export default ResetPasswordForm;
