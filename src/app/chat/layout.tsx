'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  Sparkles, 
  MessageSquare, 
  Plus, 
  LogOut, 
  LayoutDashboard, 
  User, 
  Trash2, 
  Loader2,
  Menu,
  X,
  Search,
  Pin,
  BookOpen,
  History,
  FileText,
  CheckCircle,
  Brain
} from 'lucide-react';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleUrlChange = () => {
        const params = new URLSearchParams(window.location.search);
        setCurrentSessionId(params.get('session'));
      };
      handleUrlChange();
      window.addEventListener('popstate', handleUrlChange);
      return () => window.removeEventListener('popstate', handleUrlChange);
    }
  }, [pathname]);

  const [isResourcesOpen, setIsResourcesOpen] = useState(false);
  const [kbDocs, setKbDocs] = useState<any[]>([]);
  const [kbCount, setKbCount] = useState(0);

  const fetchKbDocs = async () => {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('status', 'completed')
      .order('created_at', { ascending: false });
    
    if (data) {
      setKbDocs(data);
      setKbCount(data.length);
    }
  };

  useEffect(() => {
    fetchKbDocs();

    const handleOpenResources = () => setIsResourcesOpen(true);
    window.addEventListener('open-resources', handleOpenResources);

    const channel = supabase
      .channel('student-layout-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, () => {
        fetchKbDocs();
      })
      .subscribe();

    return () => {
      window.removeEventListener('open-resources', handleOpenResources);
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        router.push('/login');
        return;
      }
      setUser(currentUser);

      // Fetch user profile to get full name and role
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
      
      setProfile(currentProfile);

      // Fetch user conversations
      const { data: conversationsData } = await supabase
        .from('conversations')
        .select('id, title, created_at')
        .eq('user_id', currentUser.id)
        .order('updated_at', { ascending: false });

      setConversations(conversationsData || []);
      setLoading(false);
    };

    fetchSession();

    // Load pinned conversation IDs from localStorage
    const pinned = localStorage.getItem('eduassist_pinned_chats');
    if (pinned) {
      try {
        setPinnedIds(JSON.parse(pinned));
      } catch (e) {
        console.error('Error loading pinned chats:', e);
      }
    }
  }, [router, supabase]);

  // Subscribe to changes in conversations to keep sidebar in sync
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('conversations-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `user_id=eq.${user.id}`,
        },
        async () => {
          // Re-fetch conversations on any database change
          const { data } = await supabase
            .from('conversations')
            .select('id, title, created_at')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });
          setConversations(data || []);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();

    if (!confirm('Are you sure you want to delete this conversation?')) return;

    try {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Update local state
      setConversations(prev => prev.filter(c => c.id !== id));
      setPinnedIds(prev => prev.filter(pId => pId !== id));
      
      // Update localStorage
      const updatedPinned = pinnedIds.filter(pId => pId !== id);
      localStorage.setItem('eduassist_pinned_chats', JSON.stringify(updatedPinned));
      
      // If deleted active chat, redirect to general chat page
      if (pathname.includes(id)) {
        router.push('/chat');
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      alert('Could not delete the conversation. Please try again.');
    }
  };

  const handleNewChat = () => {
    router.push('/chat');
    setSidebarOpen(false);
  };

  const togglePinConversation = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    setPinnedIds(prev => {
      const next = prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id];
      localStorage.setItem('eduassist_pinned_chats', JSON.stringify(next));
      return next;
    });
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Filter conversations based on search query, and exclude Doubt Solver conversations
  const filteredConversations = conversations.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinnedConversations = filteredConversations.filter(c => pinnedIds.includes(c.id));
  const recentConversations = filteredConversations.filter(c => !pinnedIds.includes(c.id));

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050811] text-[#f8fafc] font-sans">
      
      {/* Mobile Top Navbar */}
      <div className="flex md:hidden absolute top-0 left-0 right-0 h-14 items-center justify-between border-b border-zinc-900 bg-[#060b13] px-4 z-40">
        <button
          onClick={toggleSidebar}
          className="text-zinc-400 hover:text-white focus:outline-none"
        >
          <Menu className="h-6 w-6" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-teal-500 to-indigo-600 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="font-bold text-sm tracking-tight">EduAssist AI</span>
        </div>
        <button 
          onClick={handleNewChat}
          className="text-zinc-400 hover:text-white focus:outline-none"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {/* Sidebar - Desktop and Mobile overlay */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-zinc-900/80 bg-[#070b13] transition-transform duration-300 md:static md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex h-16 flex-col justify-center border-b border-zinc-900/50 px-6 py-2">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-teal-500 to-indigo-600 text-white shadow-lg shadow-teal-500/20">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <span className="font-bold tracking-tight text-white block text-sm">
                  EduAssist AI
                </span>
                <span className="text-[10px] text-zinc-500 block -mt-0.5">
                  Academic Workspace
                </span>
              </div>
            </Link>
            <button
              onClick={toggleSidebar}
              className="text-zinc-400 hover:text-white md:hidden focus:outline-none"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Global Navigation */}
        <div className="px-4 pt-4 pb-2 space-y-1">
          <Link
            href="/chat"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
              pathname === '/chat' || (pathname.startsWith('/chat/') && !pathname.includes('/doubt'))
                ? 'text-[#14b8a6] bg-teal-500/5 border border-teal-500/10 font-bold'
                : 'text-zinc-400 hover:text-white border border-transparent'
            }`}
          >
            <MessageSquare className="h-4 w-4 text-zinc-500" />
            💬 Chat Workspace
          </Link>
          <Link
            href="/chat/doubt"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
              pathname.includes('/chat/doubt')
                ? 'text-[#a855f7] bg-purple-500/5 border border-purple-500/10 font-bold'
                : 'text-zinc-400 hover:text-white border border-transparent'
            }`}
          >
            <Brain className="h-4 w-4 text-zinc-500" />
            🧠 Doubt Solver
          </Link>
          <button
            onClick={() => {
              setIsResourcesOpen(true);
              setSidebarOpen(false);
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 hover:text-white border border-transparent transition-colors cursor-pointer text-left"
          >
            <BookOpen className="h-4 w-4 text-zinc-500" />
            📚 Knowledge Base ({kbCount})
          </button>
          <Link
            href="/chat/conversations"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 hover:text-white border border-transparent transition-colors"
          >
            <History className="h-4 w-4 text-zinc-500" />
            🕘 Chat History
          </Link>
        </div>

        {/* New Chat Button */}
        <div className="px-4 py-2">
          <button
            onClick={handleNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-[#0e1726]/40 py-2.5 px-4 text-sm font-medium text-white transition-all hover:bg-[#0e1726]/80 hover:border-zinc-700 shadow-sm"
          >
            <Plus className="h-4 w-4 text-teal-400" />
            New Conversation
          </button>
        </div>

        {/* Search Conversations */}
        <div className="px-4 py-2">
          <div className="relative flex items-center bg-[#050811] border border-zinc-800/80 rounded-lg px-2.5 py-1.5 focus-within:border-teal-500/50">
            <Search className="h-3.5 w-3.5 text-zinc-500 mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs text-zinc-200 placeholder-zinc-500 outline-none w-full"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="text-zinc-500 hover:text-zinc-300 text-[10px]"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto px-3 space-y-4 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-8 px-4 text-xs text-zinc-600">
              No conversations found.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Pinned Section */}
              {pinnedConversations.length > 0 && (
                <div className="space-y-1">
                  <span className="px-3 text-[10px] font-bold text-[#14b8a6] uppercase tracking-wider block mb-1">
                    Pinned
                  </span>
                  {pinnedConversations.map((chat) => {
                    const isDoubt = chat.title.startsWith('🧠 Doubt:');
                    const displayTitle = isDoubt ? chat.title.slice(10) : chat.title;
                    const isActive = isDoubt
                      ? pathname.includes('/chat/doubt') && currentSessionId === chat.id
                      : pathname.endsWith(`/chat/${chat.id}`);

                    return (
                      <Link
                        key={chat.id}
                        href={isDoubt ? `/chat/doubt?session=${chat.id}` : `/chat/${chat.id}`}
                        onClick={() => setSidebarOpen(false)}
                        className={`group flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                          isActive
                            ? 'bg-[#0e1726] border border-teal-500/30 text-teal-300'
                            : 'text-zinc-400 border border-transparent hover:bg-[#0e1726]/40 hover:text-white'
                        }`}
                      >
                        <div className="flex flex-col overflow-hidden w-full pr-1 text-left">
                          <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider mb-0.5 shrink-0">
                            {isDoubt ? (
                              <span className="text-purple-400 flex items-center gap-1 leading-none">
                                <Brain className="h-2.5 w-2.5 shrink-0" /> Doubt Solver
                              </span>
                            ) : (
                              <span className="text-teal-400 flex items-center gap-1 leading-none">
                                <MessageSquare className="h-2.5 w-2.5 shrink-0 text-teal-550" /> Chat Workspace
                              </span>
                            )}
                          </div>
                          <span className="truncate text-zinc-300 group-hover:text-white block w-full">{displayTitle}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => togglePinConversation(e, chat.id)}
                            className="p-0.5 text-teal-400 hover:text-teal-300 cursor-pointer"
                            title="Unpin Conversation"
                          >
                            <Pin className="h-3 w-3 fill-current" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteConversation(e, chat.id)}
                            className="p-0.5 text-zinc-500 hover:text-red-400 cursor-pointer"
                            title="Delete Conversation"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Recent Section */}
              <div className="space-y-1">
                <span className="px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                  Recent Conversations
                </span>
                {recentConversations.map((chat) => {
                  const isDoubt = chat.title.startsWith('🧠 Doubt:');
                  const displayTitle = isDoubt ? chat.title.slice(10) : chat.title;
                  const isActive = isDoubt
                    ? pathname.includes('/chat/doubt') && currentSessionId === chat.id
                    : pathname.endsWith(`/chat/${chat.id}`);

                  return (
                    <Link
                      key={chat.id}
                      href={isDoubt ? `/chat/doubt?session=${chat.id}` : `/chat/${chat.id}`}
                      onClick={() => setSidebarOpen(false)}
                      className={`group flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-[#0e1726] border border-teal-500/30 text-teal-300'
                          : 'text-zinc-400 border border-transparent hover:bg-[#0e1726]/40 hover:text-white'
                      }`}
                    >
                      <div className="flex flex-col overflow-hidden w-full pr-1 text-left">
                        <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider mb-0.5 shrink-0">
                          {isDoubt ? (
                            <span className="text-purple-400 flex items-center gap-1 leading-none">
                              <Brain className="h-2.5 w-2.5 shrink-0" /> Doubt Solver
                            </span>
                          ) : (
                            <span className="text-teal-400 flex items-center gap-1 leading-none">
                              <MessageSquare className="h-2.5 w-2.5 shrink-0 text-zinc-650" /> Chat Workspace
                            </span>
                          )}
                        </div>
                        <span className="truncate text-zinc-300 group-hover:text-white block w-full">{displayTitle}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => togglePinConversation(e, chat.id)}
                          className="p-0.5 text-zinc-500 hover:text-teal-400 cursor-pointer"
                          title="Pin Conversation"
                        >
                          <Pin className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteConversation(e, chat.id)}
                          className="p-0.5 text-zinc-500 hover:text-red-400 cursor-pointer"
                          title="Delete Conversation"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="border-t border-zinc-900/50 p-4 space-y-3">
          {profile?.role === 'admin' && (
            <Link
              href="/admin"
              className="flex w-full items-center justify-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-amber-400 bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/10 hover:border-amber-500/25 transition-all shadow-sm"
            >
              <LayoutDashboard className="h-3.5 w-3.5 shrink-0" />
              Knowledge Center
            </Link>
          )}

          <div className="flex items-center justify-between rounded-xl bg-[#0e1726]/45 p-3 border border-zinc-900">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-teal-500/10 to-indigo-500/10 text-teal-400 border border-teal-500/20 shrink-0">
                <User className="h-4 w-4" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold truncate text-white leading-tight">
                  {profile?.full_name || 'User'}
                </p>
                <p className="text-[10px] text-zinc-400 truncate flex items-center gap-1 mt-0.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${profile?.role === 'admin' ? 'bg-amber-500 animate-pulse' : 'bg-teal-500'}`} />
                  {profile?.role === 'admin' ? 'Administrator' : 'Student'}
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

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden pt-14 md:pt-0">
        {/* Overlay to close sidebar on mobile */}
        {sidebarOpen && (
          <div
            onClick={toggleSidebar}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
          />
        )}
        {children}
      </main>

      {/* Slide-over Drawer for Knowledge Base */}
      {isResourcesOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            onClick={() => setIsResourcesOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-fade-in"
          />
          
          {/* Drawer Panel */}
          <div className="relative z-10 w-full max-w-lg bg-[#070b13] border-l border-zinc-900 h-full flex flex-col shadow-2xl p-6 md:p-8 animate-slide-in-right overflow-hidden">
            
            {/* Drawer Header */}
            <div className="flex items-start justify-between border-b border-zinc-900/60 pb-5 mb-5 shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-[#14b8a6] uppercase tracking-widest">
                  <BookOpen className="h-4 w-4" />
                  Academic Resources
                </div>
                <h3 className="text-lg font-extrabold text-white tracking-tight mt-1">
                  📚 EduAssist AI Knowledge Base
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                  EduAssist AI can answer questions using {kbCount} academic knowledge resources.
                </p>
              </div>
              <button
                onClick={() => setIsResourcesOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-905 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Subtitle / Available Count Badge */}
            <div className="mb-6 space-y-2 shrink-0">
              <div className="inline-flex items-center gap-1.5 bg-teal-500/10 border border-teal-500/20 rounded-full px-3 py-1 text-xs font-bold text-[#14b8a6]">
                📚 {kbCount} Knowledge Sources Available
              </div>
              <p className="text-xs text-zinc-500 font-medium">
                EduAssist AI uses these resources to provide contextual answers.
              </p>
            </div>

            {/* List / Grid of Processed Documents */}
            <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 min-h-0">
              {kbDocs.length === 0 ? (
                <div className="text-center py-12 text-xs text-zinc-500 font-medium">
                  No academic resources have been indexed in the database yet.
                </div>
              ) : (
                kbDocs.map((doc) => (
                  <div 
                    key={doc.id}
                    className="group rounded-xl border border-zinc-900 bg-[#0c111e]/20 p-4 hover:border-zinc-800 transition-all shadow-sm flex flex-col justify-between space-y-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-lg bg-[#0e1726]/60 border border-zinc-800 text-zinc-400 group-hover:text-teal-400 transition-colors shrink-0">
                        <FileText className="h-4.5 w-4.5" />
                      </div>
                      <div className="overflow-hidden space-y-0.5">
                        <h4 className="text-xs font-bold text-zinc-200 truncate leading-snug" title={doc.file_name}>
                          {doc.file_name}
                        </h4>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-semibold uppercase">
                          <span>{doc.file_type || 'PDF'}</span>
                          <span>•</span>
                          <span>Uploaded {new Date(doc.created_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-zinc-900/60 text-[10px] font-bold uppercase tracking-wider">
                      <span className="text-zinc-500">Processing Status</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-450 border border-emerald-500/10">
                        <CheckCircle className="h-2 w-2" /> Completed & Available
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bottom info banner */}
            <div className="mt-6 border border-zinc-800/80 bg-[#0e1726]/20 rounded-xl p-4 text-center shrink-0">
              <p className="text-xs text-zinc-400 leading-relaxed font-semibold">
                Ask EduAssist AI questions about your academic resources, examinations, placements, curriculum, certifications, and career preparation.
              </p>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

