import React, { useState } from 'react';
import { supabase } from '../client';

export const Auth: React.FC = () => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (isSignUp) {
                const { error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (signUpError) throw signUpError;
                // If sign up is successful, we can just switch to login or notify user to check email.
                // For simplicity, we assume auto-login if email confirmations are disabled in Supabase.
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (signInError) throw signInError;
            } else {
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (signInError) throw signInError;
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred during authentication.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f4f4f5] flex flex-col justify-center items-center p-4">
            


            {/* Logo */}
            <div className="mb-8 text-center">
                <img 
                    src="/images/minutely-logo.png" 
                    alt="Minutely Logo" 
                    className="h-12 w-auto mx-auto"
                />
            </div>

            {/* Auth Card */}
            <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-8 w-full max-w-md">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                        {isSignUp ? 'Create an account' : 'Welcome back'}
                    </h2>
                    <p className="text-sm text-gray-500">
                        {isSignUp ? 'Enter your details below to create your account' : 'Login to your account'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                            {error}
                        </div>
                    )}
                    
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-900 block" htmlFor="email">Email</label>
                        <input 
                            id="email"
                            type="email" 
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="user@example.com"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#c01140]/20 focus:border-[#c01140] transition-colors"
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-medium text-gray-900 block" htmlFor="password">Password</label>
                            {!isSignUp && (
                                <a href="#" className="text-xs text-gray-500 hover:text-gray-900 transition-colors">
                                    Forgot your password?
                                </a>
                            )}
                        </div>
                        <input 
                            id="password"
                            type="password" 
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#c01140]/20 focus:border-[#c01140] transition-colors"
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-[#c01140] hover:bg-[#a00f35] text-white font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                    >
                        {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Login')}
                    </button>
                </form>

                <div className="mt-6 text-center flex flex-row justify-center items-baseline gap-1">
                    <span className="text-sm text-gray-500">
                        {isSignUp ? "Already have an account?" : "Don't have an account?"}
                    </span>
                    <button 
                        type="button"
                        onClick={() => {
                            setIsSignUp(!isSignUp);
                            setError(null);
                        }} 
                        className="text-gray-500 text-sm font-bold hover:underline underline focus:outline-none"
                    >
                        {isSignUp ? 'Login' : 'Sign up'}
                    </button>
                </div>
            </div>

            {/* Footer text */}
            <div className="mt-8 text-center max-w-xs">
                <p className="text-xs text-gray-400 leading-relaxed">
                    By clicking continue, you agree to our{' '}
                    <a href="#" className="text-gray-500 hover:text-gray-900 underline underline-offset-2">Terms of Service</a>
                    {' '}and{' '}
                    <a href="#" className="text-gray-500 hover:text-gray-900 underline underline-offset-2">Privacy Policy</a>.
                </p>
            </div>
        </div>
    );
};
