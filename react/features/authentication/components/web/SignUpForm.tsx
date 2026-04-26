import React from 'react';

import AuthLayout from './AuthLayout';
import { Button } from '@/react/components/ui/button';
import { Input } from '@/react/components/ui/input';
import { Label } from '@/react/components/ui/label';

const SignUpForm = () => {
    return (
        <AuthLayout
            subtitle = 'Create your account'
            title = 'Welcome'>
            <div className = 'space-y-4'>
                <div className = 'space-y-2'>
                    <Label htmlFor = 'signup-name'>Full name</Label>
                    <Input id = 'signup-name' placeholder = 'Jane Doe' type = 'text' />
                </div>
                <div className = 'space-y-2'>
                    <Label htmlFor = 'signup-email'>Email</Label>
                    <Input id = 'signup-email' placeholder = 'user@example.com' type = 'email' />
                </div>
                <div className = 'space-y-2'>
                    <Label htmlFor = 'signup-password'>Password</Label>
                    <Input id = 'signup-password' placeholder = 'Create a password' type = 'password' />
                </div>
                <Button className = 'h-11 w-full rounded-full bg-rose-700 text-base hover:bg-rose-800'>
                    Create account
                </Button>
            </div>
        </AuthLayout>
    );
};

export default SignUpForm;
