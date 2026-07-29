'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  Sparkles, 
  Search, 
  Pin, 
  Trash2, 
  MessageSquare, 
  Brain, 
  Plus, 
  Loader2, 
  Calendar,
  ChevronRight,
  HelpCircle
} from 'lucide-react';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

function ConversationsContent() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [user, setUser] = useState<any>(null);

  const supabase = createClient();
  const router = useRouter();

  // Load session and conversations
  useEffect(() => {
    const loadSession = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        router.push('/login');
        return;
      }
      setUser(currentUser);

      // Fetch conversations
      const { data } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('updated_at', { ascending: false });

      setConversations(data || []);
      setLoading(false);
    };

    loadSession();

    // Pinned states
    const pinned = localStorage.getItem('eduassist_pinned_chats');
    if (pinned) {
      try {
        setPinnedIds(JSON.parse(pinned));
      } catch (e) {
        console.error('Error loading pinned conversations:', e);
      }
    }
  }, [router, supabase]);

  // Subscribe to changes in conversations to keep grid in sync
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('conversations-grid-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `user_id=eq.${user.id}`,
        },
        async () => {
          const { data } = await supabase
            .from('conversations')
            .select('*')
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

  const togglePin = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    setPinnedIds(prev => {
      const next = prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id];
      localStorage.setItem('eduassist_pinned_chats', JSON.stringify(next));
      return next;
    });
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    try {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setConversations(prev => prev.filter(c => c.id !== id));
      setPinnedIds(prev => prev.filter(pId => pId !== id));
      
      const updatedPinned = pinnedIds.filter(pId => pId !== id);
      localStorage.setItem('eduassist_pinned_chats', JSON.stringify(updatedPinned));
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      alert('Could not delete the conversation.');
    }
  };

  const filtered = conversations.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinnedConversations = filtered.filter(c => pinnedIds.includes(c.id));
  const recentConversations = filtered.filter(c => !pinnedIds.includes(c.id));

  return (
    <div className="flex-1 overflow-y-auto bg-[#050811] p-6 md:p-12 relative overflow-hidden animate-fade-in w-full h-full">
      <div className="absolute top-1/4 left-1/3 h-[300px] w-[300px] rounded-full bg-teal-500/5 blur-[90px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-[250px] w-[250px] rounded-full bg-indigo-500/5 blur-[90px] pointer-events-none" />

      <div className="max-w-4xl mx-auto space-y-8 z-10 relative">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-900 pb-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-extrabold text-white tracking-tight sm:text-3xl">
              🕘 My Conversations
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              Manage your academic workspace sessions and saved doubt workflows.
            </p>
          </div>
          <button
            onClick={() => router.push('/chat')}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-indigo-600 py-2.5 px-5 text-xs font-bold uppercase tracking-wider text-white shadow-lg transition-all hover:brightness-110 cursor-pointer self-start sm:self-center"
          >
            <Plus className="h-4 w-4" /> New Conversation
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-3.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search past conversations..."
            className="w-full rounded-xl border border-zinc-800 bg-[#0c111e]/15 py-3 pl-11 pr-4 text-sm text-zinc-200 placeholder-zinc-500 outline-none focus:border-teal-500/50"
          />
        </div>

        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center space-y-3">
            <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
            <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Loading history...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-zinc-800 rounded-2xl bg-[#0c111e]/5">
            <HelpCircle className="h-8 w-8 text-zinc-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-zinc-400">No conversations found</p>
            <p className="text-xs text-zinc-650 mt-1">Start a new Chat Workspace or Doubt Solver session above.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Pinned Grid */}
            {pinnedConversations.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#14b8a6]">
                  📌 Pinned Conversations
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {pinnedConversations.map((chat) => {
                    const isDoubt = chat.title.startsWith('🧠 Doubt:');
                    const displayTitle = isDoubt ? chat.title.slice(10) : chat.title;
                    return (
                      <div
                        key={chat.id}
                        onClick={() => router.push(isDoubt ? `/chat/doubt?session=${chat.id}` : `/chat/${chat.id}`)}
                        className={`group p-4 rounded-xl border bg-[#0c111e]/15 shadow-sm transition-all hover:scale-[1.01] cursor-pointer flex flex-col justify-between gap-4 ${
                          isDoubt ? 'border-purple-500/20 hover:border-purple-500/40' : 'border-teal-500/20 hover:border-teal-500/40'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className={`text-[9px] font-extrabold uppercase tracking-widest ${isDoubt ? 'text-purple-400' : 'text-teal-400'}`}>
                              {isDoubt ? '🧠 Doubt Solver' : '💬 Chat Workspace'}
                            </span>
                            <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => togglePin(e, chat.id)}
                                className="p-1 rounded-md text-teal-400 hover:bg-[#0e1726]/40 cursor-pointer"
                                title="Unpin"
                              >
                                <Pin className="h-3.5 w-3.5 fill-current" />
                              </button>
                              <button
                                onClick={(e) => handleDelete(e, chat.id)}
                                className="p-1 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          <p className="text-sm font-semibold text-zinc-200 line-clamp-2 pr-2">
                            {displayTitle}
                          </p>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-zinc-550 border-t border-zinc-900/60 pt-2.5">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(chat.updated_at).toLocaleDateString()}
                          </span>
                          <span className={`flex items-center gap-0.5 text-[9px] font-extrabold uppercase tracking-wider transition-all group-hover:translate-x-0.5 ${isDoubt ? 'text-purple-400' : 'text-teal-400'}`}>
                            Open <ChevronRight className="h-3 w-3" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent Grid */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                Recent Conversations
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {recentConversations.map((chat) => {
                  const isDoubt = chat.title.startsWith('🧠 Doubt:');
                  const displayTitle = isDoubt ? chat.title.slice(10) : chat.title;
                  return (
                    <div
                      key={chat.id}
                      onClick={() => router.push(isDoubt ? `/chat/doubt?session=${chat.id}` : `/chat/${chat.id}`)}
                      className={`group p-4 rounded-xl border bg-[#0c111e]/15 shadow-sm transition-all hover:scale-[1.01] cursor-pointer flex flex-col justify-between gap-4 ${
                        isDoubt ? 'border-zinc-850 hover:border-purple-500/30' : 'border-zinc-850 hover:border-teal-500/30'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] font-extrabold uppercase tracking-widest ${isDoubt ? 'text-purple-400/80' : 'text-teal-400/80'}`}>
                            {isDoubt ? '🧠 Doubt Solver' : '💬 Chat Workspace'}
                          </span>
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={(e) => togglePin(e, chat.id)}
                                className="p-1 rounded-md text-zinc-500 hover:text-teal-400 hover:bg-[#0e1726]/40 cursor-pointer"
                                title="Pin"
                              >
                                <Pin className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={(e) => handleDelete(e, chat.id)}
                                className="p-1 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                          </div>
                        </div>
                        <p className="text-sm font-semibold text-zinc-200 line-clamp-2 pr-2">
                          {displayTitle}
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-zinc-555 border-t border-zinc-900/60 pt-2.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(chat.updated_at).toLocaleDateString()}
                        </span>
                        <span className={`flex items-center gap-0.5 text-[9px] font-extrabold uppercase tracking-wider transition-all group-hover:translate-x-0.5 ${isDoubt ? 'text-purple-400' : 'text-teal-400'}`}>
                          Open <ChevronRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ConversationsPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-1 flex-col items-center justify-center bg-[#050811] text-[#f8fafc]">
        <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
      </div>
    }>
      <ConversationsContent />
    </Suspense>
  );
}
