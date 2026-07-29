'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  Sparkles, 
  Send, 
  BookOpen, 
  FileText, 
  GraduationCap, 
  Briefcase,
  Loader2,
  HelpCircle,
  Calendar,
  Activity,
  Brain,
  MessageSquare
} from 'lucide-react';

const SUGGESTIONS = [
  {
    icon: GraduationCap,
    title: 'Academic Regulations',
    description: 'Ask about attendance, academic policies, and regulations',
    prompt: 'What is the attendance criteria to sit for exams?',
    color: 'text-teal-400 border-teal-500/25 bg-teal-500/5 hover:border-teal-500/40',
  },
  {
    icon: Briefcase,
    title: 'Placement Assistant',
    description: 'Explore placement eligibility and recruitment guidelines',
    prompt: 'What are the placement eligibility requirements and rules?',
    color: 'text-indigo-400 border-indigo-500/25 bg-indigo-500/5 hover:border-indigo-500/40',
  },
  {
    icon: FileText,
    title: 'Examination Help',
    description: 'Get answers about exams, revaluation, and academic procedures',
    prompt: 'How can I apply for re-evaluation of my exam sheets?',
    color: 'text-violet-400 border-violet-500/25 bg-violet-500/5 hover:border-violet-500/40',
  },
  {
    icon: HelpCircle,
    title: 'Knowledge Base',
    description: 'Ask questions from uploaded academic documents',
    prompt: 'Who do I contact for scholarship inquiries?',
    color: 'text-pink-400 border-pink-500/25 bg-pink-500/5 hover:border-pink-500/40',
  },
];

function ChatIndexContent() {
  const [input, setInput] = useState('');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [currentDate, setCurrentDate] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode');
  const supabase = createClient();

  const [kbCount, setKbCount] = useState(0);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
    };
    fetchUser();

    const fetchKbCount = async () => {
      const { count } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');
      if (count !== null) {
        setKbCount(count);
      }
    };
    fetchKbCount();

    // Format current date nicely
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    setCurrentDate(new Date().toLocaleDateString('en-US', options));
  }, [supabase]);

  const handleSubmit = async (textToSend: string) => {
    if (!textToSend.trim() || !user || loading) return;
    setLoading(true);

    try {
      // 1. Create a new conversation
      const title = textToSend.trim().slice(0, 40) + (textToSend.trim().length > 40 ? '...' : '');
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          title,
          user_id: user.id,
        })
        .select()
        .single();

      if (convError) throw convError;

      // 2. Insert the user message
      const { error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          role: 'user',
          content: textToSend.trim(),
        });

      if (msgError) throw msgError;

      // 3. Redirect to the newly created conversation with trigger=true
      router.push(`/chat/${conversation.id}?trigger=true`);
    } catch (err) {
      console.error('Failed to create new conversation:', err);
      alert('Failed to start a new chat. Please try again.');
      setLoading(false);
    }
  };

  if (mode !== 'workspace') {
    /* START NEW CONVERSATION SELECTION VIEW */
    return (
      <div className="flex flex-1 flex-col justify-center items-center bg-[#050811] p-6 md:p-12 relative overflow-hidden animate-fade-in w-full h-full">
        <div className="absolute top-1/4 left-1/3 h-[300px] w-[300px] rounded-full bg-teal-500/5 blur-[90px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 h-[250px] w-[250px] rounded-full bg-purple-500/5 blur-[90px] pointer-events-none" />
        
        <div className="w-full max-w-2xl text-center space-y-3.5 mb-10 shrink-0 z-10">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/10 border border-teal-500/25 text-teal-400 shadow-md">
            <Sparkles className="h-6 w-6 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-extrabold text-white tracking-tight sm:text-3xl uppercase">
              Start a New Conversation
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              Choose how you want to use EduAssist AI:
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl z-10">
          {/* Chat Workspace Card */}
          <div className="flex flex-col justify-between p-6 rounded-2xl border border-zinc-900 bg-[#0c111e]/15 shadow-xl transition-all hover:scale-[1.01] hover:border-teal-500/20 text-left">
            <div className="space-y-4">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 border border-teal-500/25 text-teal-400">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">💬 Chat Workspace</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Ask college-related questions, search the academic knowledge base, and get answers using RAG.
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push('/chat?mode=workspace')}
              className="mt-8 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-semibold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
            >
              💬 Start Chat Workspace
            </button>
          </div>

          {/* Doubt Solver Card */}
          <div className="flex flex-col justify-between p-6 rounded-2xl border border-zinc-900 bg-[#0c111e]/15 shadow-xl transition-all hover:scale-[1.01] hover:border-purple-500/20 text-left">
            <div className="space-y-4">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/25 text-purple-400">
                <Brain className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">🧠 Doubt Solver</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Ask academic doubts, understand concepts, and get step-by-step explanations.
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push('/chat/doubt')}
              className="mt-8 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
            >
              🧠 Start Doubt Solver
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ORIGINAL CHAT WORKSPACE LANDING VIEW */
  return (
    <div className="flex flex-1 flex-col justify-between bg-[#050811] p-6 md:p-12 relative overflow-hidden animate-fade-in w-full h-full">
      {/* Background Gradient Blurs */}
      <div className="absolute top-1/4 left-1/3 h-[300px] w-[300px] rounded-full bg-teal-500/5 blur-[90px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-[250px] w-[250px] rounded-full bg-indigo-500/5 blur-[90px] pointer-events-none" />
      
      {/* Top Welcome / Status Section */}
      <div className="w-full max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-zinc-900/50 pb-6 mb-4 shrink-0 gap-4">
        <div className="space-y-1 text-left">
          <div className="flex items-center gap-2 text-xs text-[#14b8a6] font-semibold uppercase tracking-wider">
            <Calendar className="h-3.5 w-3.5" />
            {currentDate}
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            Academic RAG Workspace
          </h2>
          <p className="text-zinc-400 text-xs sm:text-sm">
            Your university companion. Search policy handbooks and resources.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-center">
          <button
            onClick={() => window.dispatchEvent(new Event('open-resources'))}
            className="flex items-center gap-2 bg-indigo-500/5 border border-indigo-500/10 hover:border-indigo-500/25 rounded-full px-3.5 py-1.5 text-xs text-indigo-400 font-bold transition-all cursor-pointer shadow-sm shadow-indigo-500/2 animate-fade-in"
            title="View Knowledge Base"
          >
            📚 {kbCount} Knowledge Sources
          </button>
          
          <div className="flex items-center gap-2 bg-teal-500/5 border border-teal-500/10 rounded-full px-3 py-1.5 text-xs text-[#14b8a6]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
            </span>
            EduAssist AI is ready
          </div>
        </div>
      </div>

      {/* Suggestion Cards Container */}
      <div className="my-auto max-w-4xl w-full mx-auto space-y-8 z-10 py-6">
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <h3 className="text-2xl font-semibold text-white tracking-tight sm:text-3xl">
            How can I assist you today?
          </h3>
          <p className="text-xs text-zinc-550">
            Click one of the pathways below to query our semantic indexed data store instantly.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 max-w-2xl mx-auto">
          {SUGGESTIONS.map((s, index) => {
            const Icon = s.icon;
            return (
              <button
                key={index}
                onClick={() => handleSubmit(s.prompt)}
                className={`group flex flex-col items-start p-5 rounded-2xl border text-left outline-none transition-all duration-300 hover:scale-[1.015] shadow-sm cursor-pointer ${s.color}`}
              >
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="flex p-2 rounded-lg bg-zinc-950/40 border border-zinc-800/80 group-hover:border-current/20 transition-colors">
                    <Icon className="h-4.5 w-4.5 shrink-0" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-white">
                    {s.title}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                  {s.description}
                </p>
                <span className="text-[10px] text-zinc-600 group-hover:text-zinc-400 mt-3 font-semibold flex items-center gap-1 transition-colors">
                  Run query: "{s.prompt}"
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Query Bar */}
      <div className="w-full max-w-3xl mx-auto z-10 pt-6 border-t border-zinc-900/50">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(input);
          }}
          className="relative flex items-center bg-[#0e1726]/45 border border-zinc-800 rounded-2xl p-2.5 shadow-2xl backdrop-blur-md focus-within:border-teal-500/50 focus-within:ring-1 focus-within:ring-teal-500/50"
        >
          <input
            type="text"
            required
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask EduAssist anything about your academics (e.g., placement eligibility)..."
            className="flex-1 bg-transparent px-4 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none w-full"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-[#14b8a6] to-[#0d9488] text-white shadow-md shadow-teal-500/10 hover:brightness-110 disabled:opacity-30 disabled:hover:brightness-100 transition-all cursor-pointer"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </form>
        <div className="flex items-center justify-center gap-1.5 mt-3">
          <span className="h-1 w-1 bg-teal-500 rounded-full animate-pulse" />
          <p className="text-[10px] text-zinc-550 font-medium uppercase tracking-wider">
            Powered by your academic knowledge base
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ChatIndexPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-1 flex-col items-center justify-center bg-[#050811] text-[#f8fafc]">
        <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
      </div>
    }>
      <ChatIndexContent />
    </Suspense>
  );
}
