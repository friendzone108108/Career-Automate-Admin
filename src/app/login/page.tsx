'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';

export default function LoginPage() {
    const { user, loading, signIn } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!loading && user) {
            router.push('/dashboard');
        }
    }, [user, loading, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email || !password) {
            toast.error('Please enter both email and password');
            return;
        }

        setIsSubmitting(true);

        const { error } = await signIn(email, password);

        if (error) {
            toast.error(error.message || 'Invalid credentials');
            setIsSubmitting(false);
        } else {
            toast.success('Welcome back!');
            router.push('/dashboard');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg shadow-blue-500/30 mb-4">
                        <span className="text-white font-bold text-2xl">CA</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">CareerAutoMate</h1>
                    <p className="text-gray-500 mt-1">Admin Portal</p>
                </div>

                {/* Login Card */}
                <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8">
                    <div className="text-center mb-6">
                        <h2 className="text-xl font-semibold text-gray-900">Welcome back</h2>
                        <p className="text-gray-500 text-sm mt-1">Sign in to your admin account</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <Input
                            type="email"
                            label="Email address"
                            placeholder="admin@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isSubmitting}
                        />

                        <Input
                            type="password"
                            label="Password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isSubmitting}
                        />

                        <Button
                            type="submit"
                            className="w-full h-12 text-base"
                            loading={isSubmitting}
                        >
                            Sign in
                        </Button>
                    </form>
                </div>

                <p className="text-center text-sm text-gray-500 mt-6">
                    Protected admin access only
                </p>
            </div>
        </div>
    );
}
