'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  Brain, 
  Send, 
  Sparkles, 
  Loader2, 
  AlertCircle, 
  ArrowLeft, 
  ChevronLeft, 
  Plus, 
  MessageSquare,
  Bookmark,
  BookOpen,
  User,
  PlusCircle,
  HelpCircle
} from 'lucide-react';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

// suggestion cards
const DOUBT_SUGGESTIONS = [
  {
    category: '📐 Mathematics',
    text: 'Explain eigenvalues step by step',
    prompt: 'Explain eigenvalues and eigenvectors step by step with an example.',
  },
  {
    category: '💻 Programming',
    text: 'Explain this Python code',
    prompt: 'Explain how recursion works in Python with a clean code example.',
  },
  {
    category: '🤖 Artificial Intelligence',
    text: 'What is supervised learning?',
    prompt: 'Explain supervised learning with a simple real-world example.',
  },
  {
    category: '🗄️ DBMS',
    text: 'Explain database normalization',
    prompt: 'Explain database normalization (1NF, 2NF, 3NF) with a simple example.',
  },
  {
    category: '☁️ Cloud Computing',
    text: 'Explain cloud computing for beginners',
    prompt: 'Explain cloud computing for a beginner and list the main deployment models.',
  },
];

// Markdown Renderer specifically for doubt solver
function DoubtMarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-2.5 text-sm leading-relaxed text-zinc-300">
      {lines.map((line, idx) => {
        // Headings
        if (line.startsWith('### ')) {
          return <h4 key={idx} className="text-xs font-bold uppercase tracking-wider text-purple-400 mt-4 mb-1">{line.slice(4)}</h4>;
        }
        if (line.startsWith('## ')) {
          return <h3 key={idx} className="text-sm font-bold text-white mt-4 mb-1.5 border-b border-zinc-800 pb-1">{line.slice(3)}</h3>;
        }
        if (line.startsWith('# ')) {
          return <h2 key={idx} className="text-base font-extrabold text-white mt-5 mb-2">{line.slice(2)}</h2>;
        }
        
        // Bullet Lists
        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
          return (
            <ul key={idx} className="list-disc list-inside ml-2.5 my-0.5 text-zinc-300 space-y-0.5">
              <li>{line.trim().slice(2)}</li>
            </ul>
          );
        }

        // Numbered Lists
        const numMatch = line.trim().match(/^(\d+)\.\s(.*)$/);
        if (numMatch) {
          return (
            <ol key={idx} className="list-decimal list-inside ml-2.5 my-0.5 text-zinc-300 space-y-0.5">
              <li>{numMatch[2]}</li>
            </ol>
          );
        }

        // Horizontal Rule
        if (line.trim() === '---') {
          return <hr key={idx} className="border-zinc-800/80 my-3" />;
        }

        // Empty Line
        if (line.trim() === '') {
          return <div key={idx} className="h-1.5" />;
        }

        // Bold text formatting inside standard lines
        const parts = line.split(/(\*\*.*?\*\*)/g);
        return (
          <p key={idx} className="text-zinc-350">
            {parts.map((part, pIdx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={pIdx} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
              }
              return part;
            })}
          </p>
        );
      })}
    </div>
  );
}

function DoubtSolverContent() {
  const [user, setUser] = useState<any>(null);
  const [doubtConversations, setDoubtConversations] = useState<Conversation[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionQuery = searchParams.get('session');

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, generating]);

  // Load user session & past doubts on mount
  useEffect(() => {
    const initData = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        setUser(currentUser);
        // Load past doubt sessions (prefixed with 🧠 Doubt:)
        const { data: conversations } = await supabase
          .from('conversations')
          .select('*')
          .eq('user_id', currentUser.id)
          .like('title', '🧠 Doubt:%')
          .order('updated_at', { ascending: false });
        
        setDoubtConversations(conversations || []);
      }
    };
    initData();
  }, [supabase]);

  // Watch URL sessionQuery parameter
  useEffect(() => {
    if (sessionQuery) {
      handleOpenSession(sessionQuery);
    } else {
      setActiveSessionId(null);
      setMessages([]);
    }
  }, [sessionQuery]);

  // Load selected session's messages
  const handleOpenSession = async (sessionId: string) => {
    setActiveSessionId(sessionId);
    setLoading(true);
    setError(null);
    try {
      const { data, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', sessionId)
        .order('created_at', { ascending: true });

      if (msgError) throw msgError;
      setMessages(data || []);

      // Auto-trigger response if the last message is from the user and no assistant reply exists
      if (data && data.length > 0) {
        const lastMsg = data[data.length - 1];
        if (lastMsg.role === 'user') {
          const hasAssistantReply = data.some(
            m => m.role === 'assistant' && new Date(m.created_at) > new Date(lastMsg.created_at)
          );
          if (!hasAssistantReply) {
            triggerStream(lastMsg.content, sessionId, data.slice(0, -1));
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to load this session.');
    } finally {
      setLoading(false);
    }
  };

  const triggerStream = async (userPrompt: string, convId: string, history: Message[]) => {
    setGenerating(true);
    setError(null);
    const tempMsgId = 'temp-doubt-msg';

    setMessages(prev => {
      // Prevent duplicates if already present
      if (prev.some(m => m.id === tempMsgId)) return prev;
      return [
        ...prev,
        {
          id: tempMsgId,
          role: 'assistant',
          content: '',
          created_at: new Date().toISOString()
        }
      ];
    });

    try {
      const response = await fetch('/api/doubt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: userPrompt,
          conversationId: convId
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to stream solution.');
      }

      if (!response.body) throw new Error('No stream available.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        streamContent += chunk;

        setMessages(prev => 
          prev.map(m => m.id === tempMsgId ? { ...m, content: streamContent } : m)
        );
      }

      // Fetch the final message saved to DB
      const { data: finalMsg, error: fetchErr } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .eq('role', 'assistant')
        .order('created_at', { ascending: false })
        .limit(1);

      if (!fetchErr && finalMsg && finalMsg.length > 0) {
        setMessages(prev => 
          prev.map(m => m.id === tempMsgId ? finalMsg[0] : m)
        );
      }

      // Refresh list of doubts
      if (user) {
        const { data: conversations } = await supabase
          .from('conversations')
          .select('*')
          .eq('user_id', user.id)
          .like('title', '🧠 Doubt:%')
          .order('updated_at', { ascending: false });
        
        setDoubtConversations(conversations || []);
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error formulating academic solution.');
      setMessages(prev => prev.filter(m => m.id !== tempMsgId));
    } finally {
      setGenerating(false);
    }
  };

  const handleNewDoubtSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || generating || !user) return;

    const doubtText = input.trim();
    setInput('');
    setLoading(true);

    try {
      // 1. Create conversation record
      const title = `🧠 Doubt: ${doubtText.slice(0, 45)}${doubtText.length > 45 ? '...' : ''}`;
      const { data: conv, error: convErr } = await supabase
        .from('conversations')
        .insert({
          title,
          user_id: user.id
        })
        .select()
        .single();

      if (convErr) throw convErr;

      // 2. Insert user message
      const { error: msgErr } = await supabase
        .from('messages')
        .insert({
          conversation_id: conv.id,
          role: 'user',
          content: doubtText
        });

      if (msgErr) throw msgErr;

      // 3. Redirect to the session URL (which auto-loads and streams via useEffect)
      router.push(`/chat/doubt?session=${conv.id}`);
    } catch (err: any) {
      console.error(err);
      setError('Could not initialize doubt session.');
      setLoading(false);
    }
  };

  const handleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || generating || !activeSessionId) return;

    const text = input.trim();
    setInput('');

    const newUserMsg: Message = {
      id: 'temp-user-' + Date.now(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, newUserMsg]);

    try {
      const { error: msgErr } = await supabase
        .from('messages')
        .insert({
          conversation_id: activeSessionId,
          role: 'user',
          content: text
        });

      if (msgErr) throw msgErr;

      await triggerStream(text, activeSessionId, messages);
    } catch (err: any) {
      console.error(err);
      setError('Failed to send follow-up.');
    }
  };

  const handleSuggestionClick = async (prompt: string) => {
    if (generating || !user) return;
    setLoading(true);

    try {
      const title = `🧠 Doubt: ${prompt.slice(0, 45)}${prompt.length > 45 ? '...' : ''}`;
      const { data: conv, error: convErr } = await supabase
        .from('conversations')
        .insert({
          title,
          user_id: user.id
        })
        .select()
        .single();

      if (convErr) throw convErr;

      const { error: msgErr } = await supabase
        .from('messages')
        .insert({
          conversation_id: conv.id,
          role: 'user',
          content: prompt
        });

      if (msgErr) throw msgErr;

      router.push(`/chat/doubt?session=${conv.id}`);
    } catch (err: any) {
      console.error(err);
      setError('Could not initialize suggestion query.');
      setLoading(false);
    }
  };

  const handleBackToLanding = () => {
    router.push('/chat/doubt');
  };

  return (
    <div className="flex flex-1 flex-col h-full bg-[#050811] relative overflow-hidden animate-fade-in">
      <div className="absolute top-1/4 left-1/3 h-[300px] w-[300px] rounded-full bg-purple-500/5 blur-[90px] pointer-events-none" />

      {activeSessionId === null ? (
        /* LANDING VIEW */
        <div className="flex-1 overflow-y-auto p-6 md:p-12 space-y-10 max-w-4xl mx-auto w-full z-10">
          
          {/* Header */}
          <div className="text-center space-y-3.5 max-w-xl mx-auto">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 border border-purple-500/25 text-purple-400 shadow-md">
              <Brain className="h-6 w-6 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-extrabold text-white tracking-tight sm:text-3xl">
                🧠 AI Doubt Solver
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400">
                Ask questions, understand concepts, and learn step by step.
              </p>
            </div>
          </div>

          {/* Form Composer */}
          <form 
            onSubmit={handleNewDoubtSubmit}
            className="flex items-center bg-[#0e1726]/45 border border-zinc-800 rounded-2xl p-3 shadow-xl focus-within:border-purple-500/50 focus-within:ring-1 focus-within:ring-purple-500/50"
          >
            <input
              type="text"
              required
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your academic doubt here..."
              className="flex-1 bg-transparent px-4 py-2.5 text-sm text-zinc-150 placeholder-zinc-500 outline-none w-full"
              disabled={loading || generating}
            />
            <button
              type="submit"
              disabled={loading || generating || !input.trim()}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg hover:brightness-115 disabled:opacity-30 transition-all cursor-pointer"
            >
              {loading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Send className="h-4.5 w-4.5" />}
            </button>
          </form>

          {/* Question Suggestions */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-zinc-550 uppercase tracking-widest text-center">
              Example pathways & doubts
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-w-3xl mx-auto">
              {DOUBT_SUGGESTIONS.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionClick(s.prompt)}
                  className="flex flex-col items-start p-4 rounded-xl border border-zinc-900 bg-[#0c111e]/15 text-left transition-all hover:scale-[1.01] hover:border-purple-500/20 shadow-sm cursor-pointer"
                  disabled={loading || generating}
                >
                  <span className="text-[9px] font-extrabold text-purple-400 uppercase tracking-wider mb-1.5">
                    {s.category}
                  </span>
                  <p className="text-xs text-zinc-350 leading-relaxed font-semibold">
                    "{s.text}"
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Past Doubts Solved */}
          {doubtConversations.length > 0 && (
            <div className="space-y-4 border-t border-zinc-900/60 pt-8">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Previous Solved Doubts
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {doubtConversations.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => router.push(`/chat/doubt?session=${chat.id}`)}
                    className="flex items-center gap-3 p-3.5 rounded-xl border border-zinc-900 bg-[#0c111e]/20 hover:border-zinc-800 transition-colors text-left w-full cursor-pointer"
                  >
                    <div className="p-2 rounded-lg bg-[#0e1726]/60 border border-zinc-850 text-purple-400 shrink-0">
                      <HelpCircle className="h-4 w-4" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-semibold text-zinc-200 truncate pr-1">
                        {chat.title.startsWith('🧠 Doubt: ') ? chat.title.slice(10) : chat.title}
                      </p>
                      <p className="text-[9px] text-zinc-550 font-semibold uppercase mt-0.5">
                        Solved {new Date(chat.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ACTIVE SESSION VIEW */
        <div className="flex flex-1 flex-col h-full">
          
          {/* Header */}
          <div className="flex h-14 items-center justify-between border-b border-zinc-900/50 bg-[#070b13]/85 px-6 backdrop-blur-md shrink-0 z-10">
            <div className="flex items-center gap-3 overflow-hidden">
              <button
                onClick={handleBackToLanding}
                className="p-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="Back to Doubt Solver Home"
              >
                <ChevronLeft className="h-4.5 w-4.5" />
              </button>
              <div className="overflow-hidden">
                <span className="font-bold text-xs text-white block truncate max-w-sm">
                  {doubtConversations.find(c => c.id === activeSessionId)?.title.slice(10) || 'Academic Doubt Session'}
                </span>
                <span className="text-[9px] text-purple-400 block tracking-wide font-bold uppercase -mt-0.5">
                  DOUBT SOLVING LOG
                </span>
              </div>
            </div>
            <button
              onClick={handleBackToLanding}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-bold uppercase tracking-wider transition-all hover:bg-purple-500/20 cursor-pointer"
            >
              <Plus className="h-3 w-3" /> New Doubt
            </button>
          </div>

          {/* Message List */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            {loading ? (
              <div className="flex h-full flex-col items-center justify-center space-y-3">
                <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                <p className="text-xs text-zinc-550 font-semibold uppercase tracking-wider">Retrieving doubt history...</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div 
                    key={msg.id}
                    className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}
                  >
                    {isUser ? (
                      /* Student Message bubble */
                      <div className="flex items-start gap-3 max-w-[80%]">
                        <div className="flex flex-col items-end space-y-1">
                          <div className="rounded-2xl px-4 py-3 bg-[#0e1726] border border-zinc-800 text-zinc-150 shadow-md text-sm leading-relaxed">
                            {msg.content}
                          </div>
                          <span className="text-[9px] text-zinc-655 font-medium">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 shrink-0 border border-zinc-700">
                          <User className="h-4 w-4" />
                        </div>
                      </div>
                    ) : (
                      /* AI Explanation bubble */
                      <div className="flex items-start gap-4 max-w-[90%] w-full">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-purple-500/10 to-indigo-500/10 border border-purple-500/30 text-purple-400 shrink-0 shadow-lg shadow-purple-500/5">
                          <Brain className="h-4 w-4" />
                        </div>
                        <div className="flex-1 space-y-3 overflow-hidden bg-[#0c111e]/40 border border-zinc-900 rounded-2xl p-5 shadow-sm">
                          <div className="flex items-center justify-between border-b border-zinc-900/60 pb-2 mb-1">
                            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">
                              Academic Explanation
                            </span>
                            <span className="text-[9px] text-zinc-600 font-medium">
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <DoubtMarkdownRenderer content={msg.content} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {generating && (
              <div className="flex w-full justify-start animate-fade-in">
                <div className="flex items-center gap-3 rounded-2xl bg-[#0c111e]/60 border border-zinc-900 px-5 py-4 text-xs text-zinc-450 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-zinc-300 block">Formulating explanation...</span>
                    <span className="text-[10px] text-zinc-500 block">Analyzing concept structures and compiling step-by-step notes</span>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="flex w-full justify-center animate-fade-in">
                <div className="flex items-center gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0 animate-pulse" />
                  <span>{error}</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Follow-up composer bar */}
          <div className="border-t border-zinc-900/50 bg-[#070b13]/40 p-4 md:p-6 shrink-0">
            <form 
              onSubmit={handleFollowUpSubmit}
              className="relative flex items-center bg-[#0e1726]/45 border border-zinc-800 rounded-2xl p-2.5 shadow-md focus-within:border-purple-500/50 focus-within:ring-1 focus-within:ring-purple-500/50"
            >
              <input
                type="text"
                required
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a follow-up or clarify doubt..."
                className="flex-1 bg-transparent px-4 py-2 text-sm text-zinc-150 placeholder-zinc-500 outline-none w-full"
                disabled={generating}
              />
              <button
                type="submit"
                disabled={generating || !input.trim()}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/10 hover:brightness-110 disabled:opacity-30 transition-all cursor-pointer"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>
          </div>

        </div>
      )}
    </div>
  );
}

export default function DoubtSolverPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-1 flex-col items-center justify-center bg-[#050811] text-[#f8fafc]">
        <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
      </div>
    }>
      <DoubtSolverContent />
    </Suspense>
  );
}
