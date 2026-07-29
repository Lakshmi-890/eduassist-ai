'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  Sparkles, 
  LayoutDashboard, 
  FileText, 
  HelpCircle, 
  MessageSquare, 
  LogOut, 
  User, 
  Loader2,
  Menu,
  X
} from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: currentProfile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileErr) {
        console.error('AdminLayout checkAdmin error:', profileErr);
      }

      if (!currentProfile || currentProfile.role !== 'admin') {
        console.warn('Unauthorized admin access attempt. Profile:', currentProfile);
        router.push('/chat');
        return;
      }

      setProfile(currentProfile);
      setLoading(false);
    };

    checkAdmin();
  }, [router, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#050811] text-[#f8fafc] font-sans">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Checking permissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050811] text-[#f8fafc] font-sans">
      
      {/* Mobile Top Header */}
      <div className="flex md:hidden absolute top-0 left-0 right-0 h-14 items-center justify-between border-b border-zinc-900 bg-[#060b13] px-4 z-40">
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-zinc-400 hover:text-white focus:outline-none"
        >
          <Menu className="h-6 w-6" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-500 to-yellow-600 text-black">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="font-bold text-sm text-white tracking-tight">EduAssist Admin</span>
        </div>
        <div className="w-6" />
      </div>

      {/* Sidebar - Desktop and Mobile overlay */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-zinc-900/80 bg-[#070b13] transition-transform duration-300 md:static md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex h-16 flex-col justify-center border-b border-zinc-900/50 px-6 py-2">
          <div className="flex items-center justify-between">
            <Link href="/admin" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-lg shadow-amber-500/5">
                <Sparkles className="h-4.5 w-4.5" />
              </div>
              <div>
                <span className="font-bold tracking-tight text-white block text-sm">
                  Knowledge Hub
                </span>
                <span className="text-[10px] text-amber-500 block -mt-0.5 font-bold uppercase tracking-wider">
                  Admin Console
                </span>
              </div>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-zinc-400 hover:text-white md:hidden focus:outline-none"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Navigation Items */}
        <Suspense fallback={
          <div className="flex-1 px-6 py-6 text-xs text-zinc-500">Loading menu...</div>
        }>
          <AdminSidebarNav setSidebarOpen={setSidebarOpen} />
        </Suspense>

        {/* Footer */}
        <div className="border-t border-zinc-900/50 p-4">
          <div className="flex items-center justify-between rounded-xl bg-[#0e1726]/45 p-3 border border-zinc-900">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                <User className="h-4 w-4" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold truncate text-white leading-tight">
                  {profile?.full_name || 'Admin'}
                </p>
                <p className="text-[10px] text-zinc-400 truncate flex items-center gap-1 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Administrator
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-all focus:outline-none"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden pt-14 md:pt-0">
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
          />
        )}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

function AdminSidebarNav({ setSidebarOpen }: { setSidebarOpen: (open: boolean) => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') || 'overview';

  return (
    <nav className="flex-1 space-y-1 px-3 py-6 overflow-y-auto">
      <span className="px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-3">
        Management
      </span>

      <Link
        href="/admin?tab=overview"
        onClick={() => setSidebarOpen(false)}
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all ${
          pathname === '/admin' && currentTab === 'overview'
            ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400 font-semibold shadow-sm shadow-amber-500/5'
            : 'text-zinc-400 border border-transparent hover:bg-[#0e1726]/40 hover:text-white'
        }`}
      >
        <LayoutDashboard className="h-4.5 w-4.5 shrink-0 text-zinc-500" />
        Overview
      </Link>

      <Link
        href="/admin?tab=documents"
        onClick={() => setSidebarOpen(false)}
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all ${
          pathname === '/admin' && currentTab === 'documents'
            ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400 font-semibold shadow-sm shadow-amber-500/5'
            : 'text-zinc-400 border border-transparent hover:bg-[#0e1726]/40 hover:text-white'
        }`}
      >
        <FileText className="h-4.5 w-4.5 shrink-0 text-zinc-500" />
        Documents
      </Link>

      <Link
        href="/admin?tab=faqs"
        onClick={() => setSidebarOpen(false)}
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all ${
          pathname === '/admin' && currentTab === 'faqs'
            ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400 font-semibold shadow-sm shadow-amber-500/5'
            : 'text-zinc-400 border border-transparent hover:bg-[#0e1726]/40 hover:text-white'
        }`}
      >
        <HelpCircle className="h-4.5 w-4.5 shrink-0 text-zinc-500" />
        FAQs
      </Link>

      <span className="px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest block pt-6 mb-3">
        Exit Panel
      </span>

      <Link
        href="/chat"
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-400 border border-transparent hover:bg-[#0e1726]/40 hover:text-white transition-all"
      >
        <MessageSquare className="h-4.5 w-4.5 shrink-0 text-zinc-500" />
        Back to Chat Portal
      </Link>
    </nav>
  );
}
