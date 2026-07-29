'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  User, 
  Mail, 
  Shield, 
  Calendar, 
  ArrowLeft, 
  Loader2,
  Sparkles,
  LogOut
} from 'lucide-react';

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      setProfile(currentProfile);
      setLoading(false);
    };

    fetchProfile();
  }, [router, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050811] text-[#f8fafc] font-sans">
        <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050811] px-4 text-[#f8fafc] font-sans relative overflow-hidden animate-fade-in">
      {/* Background Gradient Orbs */}
      <div className="absolute top-1/4 left-1/4 h-[300px] w-[300px] rounded-full bg-teal-500/5 blur-[100px] pointer-events-none" />
      
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-zinc-900 bg-[#0e1726]/40 p-8 shadow-2xl backdrop-blur-md">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-900/60 pb-4">
          <Link
            href="/chat"
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors font-semibold"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Chat
          </Link>
          <div className="flex items-center gap-1">
            <Sparkles className="h-4 w-4 text-teal-500" />
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Workspace Profile</span>
          </div>
        </div>

        {/* Profile Card details */}
        <div className="space-y-6 pt-2">
          
          {/* Avatar Icon placeholder */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-teal-500/10 border border-teal-500/20 text-[#14b8a6] shadow-lg shadow-teal-500/5">
              <User className="h-10 w-10" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white leading-tight">{profile?.full_name || 'Academic User'}</h3>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider mt-2.5 border ${
                profile?.role === 'admin' 
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
                  : 'bg-teal-500/10 border-teal-500/20 text-teal-400'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${profile?.role === 'admin' ? 'bg-amber-500' : 'bg-teal-500'}`} />
                {profile?.role || 'student'}
              </span>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-zinc-900/60">
            {/* Email */}
            <div className="flex items-start gap-3.5 text-sm bg-[#050811]/40 border border-zinc-900 rounded-xl p-3.5">
              <Mail className="h-4.5 w-4.5 text-zinc-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="text-zinc-500 text-[10px] block font-bold uppercase tracking-widest">Email Address</span>
                <span className="text-zinc-200 font-semibold">{profile?.email || 'N/A'}</span>
              </div>
            </div>

            {/* Role detail */}
            <div className="flex items-start gap-3.5 text-sm bg-[#050811]/40 border border-zinc-900 rounded-xl p-3.5">
              <Shield className="h-4.5 w-4.5 text-zinc-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="text-zinc-500 text-[10px] block font-bold uppercase tracking-widest">Account Privilege</span>
                <span className="text-zinc-200 font-semibold uppercase tracking-wide text-xs">
                  {profile?.role === 'admin' ? 'Administrator' : 'Standard Student'}
                </span>
              </div>
            </div>

            {/* Created At */}
            <div className="flex items-start gap-3.5 text-sm bg-[#050811]/40 border border-zinc-900 rounded-xl p-3.5">
              <Calendar className="h-4.5 w-4.5 text-zinc-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="text-zinc-500 text-[10px] block font-bold uppercase tracking-widest">Member Since</span>
                <span className="text-zinc-200 font-semibold">
                  {profile?.created_at ? new Date(profile.created_at).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }) : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 text-red-400 font-semibold py-3 text-xs uppercase tracking-wider transition-all cursor-pointer mt-2"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
