import React from 'react';

import { Button } from '@/react/components/ui/button';
import { Input } from '@/react/components/ui/input';
import { Label } from '@/react/components/ui/label';

interface IProps {
    connecting: boolean;
    message?: React.ReactNode;
    onForgotPassword?: () => void;
    onLogin: () => void;
    onPasswordChange: (value: string) => void;
    onSignUp?: () => void;
    onUsernameChange: (value: string) => void;
    password: string;
    username: string;
}

const LoginForm = ({
    connecting,
    message,
    onForgotPassword,
    onLogin,
    onPasswordChange,
    onSignUp,
    onUsernameChange,
    password,
    username
}: IProps) => {
    const canSubmit = Boolean(username && password) && !connecting;

    return (
        <div className = 'space-y-5'>
            <div className = 'space-y-2'>
                <Label htmlFor = 'login-dialog-username-modern'>Email</Label>
                <Input
                    autoFocus = { true }
                    id = 'login-dialog-username-modern'
                    onChange = { e => onUsernameChange(e.target.value) }
                    placeholder = 'user@example.com'
                    type = 'email'
                    value = { username } />
            </div>

            <div className = 'space-y-2'>
                <div className = 'flex items-center justify-between'>
                    <Label htmlFor = 'login-dialog-password-modern'>Password</Label>
                    <button
                        className = 'text-sm text-slate-500 underline-offset-4 hover:text-slate-700 hover:underline'
                        onClick = { onForgotPassword }
                        type = 'button'>
                        Forgot your password?
                    </button>
                </div>
                <Input
                    id = 'login-dialog-password-modern'
                    onChange = { e => onPasswordChange(e.target.value) }
                    placeholder = 'Enter your password'
                    type = 'password'
                    value = { password } />
            </div>

            {message && (
                <div className = 'rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900'>
                    {message}
                </div>
            )}

            <Button
                className = 'h-11 w-full rounded-full bg-rose-700 text-base font-semibold hover:bg-rose-800'
                disabled = { !canSubmit }
                onClick = { onLogin }
                type = 'button'>
                {connecting ? 'Logging in...' : 'Login'}
            </Button>

            <p className = 'text-center text-sm text-slate-600'>
                Don&apos;t have an account?{' '}
                <button
                    className = 'font-semibold text-slate-700 underline-offset-4 hover:underline'
                    onClick = { onSignUp }
                    type = 'button'>
                    Sign up
                </button>
            </p>
        </div>
    );
};

export default LoginForm;
