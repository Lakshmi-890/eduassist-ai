'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { UserPlus, Sparkles, AlertCircle, CheckCircle, Loader2, Mail, Lock, User, Shield } from 'lucide-react';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: role,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
      } else {
        setSuccess(true);
        // Automatically log in after sign up
        setTimeout(() => {
          if (role === 'admin') {
            router.push('/admin');
          } else {
            router.push('/chat');
          }
          router.refresh();
        }, 1500);
      }
    } catch (err: any) {
      setError('An unexpected error occurred. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050811] px-4 text-[#f8fafc] font-sans relative overflow-hidden animate-fade-in">
      {/* Background Gradient Orbs */}
      <div className="absolute top-1/4 left-1/4 h-[350px] w-[350px] rounded-full bg-teal-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-[350px] w-[350px] rounded-full bg-indigo-600/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md space-y-8 rounded-2xl border border-zinc-900 bg-[#0e1726]/40 p-8 shadow-2xl backdrop-blur-md">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-500 to-indigo-600 text-white shadow-lg shadow-teal-500/10">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-white">Create Account</h2>
            <p className="text-xs text-zinc-400 mt-1 font-medium">
              Join EduAssist to start exploring university academic resources
            </p>
          </div>
        </div>

        {/* Success Alert */}
        {success && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-xs text-emerald-450 animate-fade-in">
            <CheckCircle className="h-5 w-5 shrink-0 animate-bounce" />
            <p className="font-semibold">Registration successful! Logging you in...</p>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-xs text-red-400 animate-fade-in">
            <AlertCircle className="h-5 w-5 shrink-0 animate-pulse" />
            <p className="font-semibold">{error}</p>
          </div>
        )}

        {/* Form */}
        <form className="mt-8 space-y-4" onSubmit={handleSignup}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="fullName" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Full Name
              </label>
              <div className="relative flex items-center bg-[#050811] border border-zinc-800 rounded-xl px-3 py-2.5 focus-within:border-teal-500/50">
                <User className="h-4 w-4 text-zinc-500 mr-2.5 shrink-0" />
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  className="bg-transparent text-sm placeholder-zinc-600 text-zinc-100 outline-none w-full"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Email Address
              </label>
              <div className="relative flex items-center bg-[#050811] border border-zinc-800 rounded-xl px-3 py-2.5 focus-within:border-teal-500/50">
                <Mail className="h-4 w-4 text-zinc-500 mr-2.5 shrink-0" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@university.edu"
                  className="bg-transparent text-sm placeholder-zinc-600 text-zinc-100 outline-none w-full"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Password
              </label>
              <div className="relative flex items-center bg-[#050811] border border-zinc-800 rounded-xl px-3 py-2.5 focus-within:border-teal-500/50">
                <Lock className="h-4 w-4 text-zinc-500 mr-2.5 shrink-0" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="•••••••• (min 6 chars)"
                  className="bg-transparent text-sm placeholder-zinc-600 text-zinc-100 outline-none w-full"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="role" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Account Role
              </label>
              <div className="relative flex items-center bg-[#050811] border border-zinc-800 rounded-xl px-3 py-2.5 focus-within:border-teal-500/50">
                <Shield className="h-4 w-4 text-zinc-500 mr-2.5 shrink-0" />
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="bg-transparent text-sm text-zinc-300 outline-none w-full cursor-pointer [&>option]:bg-[#070b13] [&>option]:text-zinc-300"
                >
                  <option value="student">Student</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-indigo-600 px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-teal-500/10 hover:brightness-110 focus:outline-none transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-zinc-400 font-semibold">
          Already have an account?{' '}
          <Link
            href="/login"
            className="text-teal-400 hover:text-teal-300 hover:underline transition-all"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
