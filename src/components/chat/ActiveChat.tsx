'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  Send, 
  Loader2, 
  Sparkles, 
  AlertCircle, 
  FileText,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  Copy,
  RotateCcw,
  Check,
  User,
  ExternalLink
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: {
    sources?: Array<{
      document_id: string;
      file_name: string;
      content: string;
      similarity: number;
    }>;
  };
  created_at: string;
}

// Simple Inline Markdown Parser to render beautiful, structured typography
function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-2 text-sm leading-relaxed text-zinc-300">
      {lines.map((line, idx) => {
        // Headings
        if (line.startsWith('### ')) {
          return <h4 key={idx} className="text-xs font-bold uppercase tracking-wider text-teal-400 mt-4 mb-1">{line.slice(4)}</h4>;
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
          <p key={idx} className="text-zinc-300">
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

export default function ActiveChat({ id }: { id: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<any>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSources, setExpandedSources] = useState<{ [msgId: string]: boolean }>({});
  const [ratings, setRatings] = useState<{ [msgId: string]: 'helpful' | 'unhelpful' | undefined }>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [kbCount, setKbCount] = useState(0);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  // Scroll to bottom helper
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, generating]);

  // Load chat messages and conversation title
  useEffect(() => {
    const loadChatData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch conversation record
        const { data: convData } = await supabase
          .from('conversations')
          .select('*')
          .eq('id', id)
          .single();
        
        setConversation(convData);

        // Fetch completed knowledge base resources count
        const { count } = await supabase
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'completed');
        if (count !== null) {
          setKbCount(count);
        }

        // Fetch messages
        const { data, error: msgError } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', id)
          .order('created_at', { ascending: true });

        if (msgError) throw msgError;

        setMessages(data || []);
        
        // Auto-trigger response if the last message is from the user and no assistant reply exists
        if (data && data.length > 0) {
          const lastMsg = data[data.length - 1];
          if (lastMsg.role === 'user') {
            const hasAssistantReply = data.some(m => m.role === 'assistant' && new Date(m.created_at) > new Date(lastMsg.created_at));
            if (!hasAssistantReply) {
              triggerAiStream(lastMsg.content, data.slice(0, -1));
            }
          }
        }
      } catch (err: any) {
        console.error('Failed to load messages:', err);
        setError('Failed to load chat history. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };

    loadChatData();
  }, [id, supabase]);

  const triggerAiStream = async (userPrompt: string, history: Message[]) => {
    setGenerating(true);
    setError(null);

    // Create a temporary ID for the streaming AI response bubble
    const tempAiMsgId = 'temp-ai-msg';
    
    // Add a placeholder message for the streaming response
    setMessages(prev => [
      ...prev,
      {
        id: tempAiMsgId,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString(),
      }
    ]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userPrompt,
          conversationId: id,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to generate response');
      }

      if (!response.body) {
        throw new Error('No readable stream available');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        streamContent += chunk;

        // Update the placeholder message's content in state
        setMessages(prev => 
          prev.map(m => m.id === tempAiMsgId ? { ...m, content: streamContent } : m)
        );
      }

      // After stream finishes, fetch the final assistant message from the DB
      // which has been persisted with references/citations (metadata).
      const { data: finalMsgData, error: fetchError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', id)
        .eq('role', 'assistant')
        .order('created_at', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;

      if (finalMsgData && finalMsgData.length > 0) {
        // Replace the temporary message with the actual DB message
        setMessages(prev => 
          prev.map(m => m.id === tempAiMsgId ? finalMsgData[0] : m)
        );
      }
    } catch (err: any) {
      console.error('Streaming error:', err);
      setError(err.message || 'An error occurred during response generation.');
      // Remove temporary message on failure
      setMessages(prev => prev.filter(m => m.id !== tempAiMsgId));
    } finally {
      setGenerating(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || generating) return;

    const userText = input.trim();
    setInput('');
    setError(null);

    // Save user message to state optimistically
    const tempUserMsgId = 'temp-user-' + Date.now();
    const newUserMsg: Message = {
      id: tempUserMsgId,
      role: 'user',
      content: userText,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, newUserMsg]);

    try {
      // Save user message to database
      const { error: dbError } = await supabase
        .from('messages')
        .insert({
          conversation_id: id,
          role: 'user',
          content: userText,
        });

      if (dbError) throw dbError;

      // Trigger AI streaming response
      await triggerAiStream(userText, messages);
    } catch (err: any) {
      console.error('Failed to send message:', err);
      setError('Could not save your message. Please try again.');
      // Remove the optimistically added message
      setMessages(prev => prev.filter(m => m.id !== tempUserMsgId));
    }
  };

  const toggleSources = (msgId: string) => {
    setExpandedSources(prev => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const handleCopyText = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleRating = (msgId: string, type: 'helpful' | 'unhelpful') => {
    setRatings(prev => ({
      ...prev,
      [msgId]: prev[msgId] === type ? undefined : type,
    }));
  };

  const handleRegenerate = async (msgId: string) => {
    if (generating) return;

    // 1. Locate the AI message we want to regenerate
    const aiIndex = messages.findIndex(m => m.id === msgId);
    if (aiIndex === -1) return;

    // 2. Find the user query just before this AI response
    let userQueryIndex = -1;
    for (let i = aiIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userQueryIndex = i;
        break;
      }
    }

    if (userQueryIndex === -1) return;

    const userPrompt = messages[userQueryIndex].content;
    const history = messages.slice(0, userQueryIndex);

    // Delete the regenerated AI message from current screen state
    setMessages(prev => prev.slice(0, aiIndex));
    
    // Trigger streaming
    await triggerAiStream(userPrompt, history);
  };

  return (
    <div className="flex flex-1 flex-col h-full bg-[#050811] animate-fade-in">
      
      {/* Active Chat Header */}
      <div className="flex h-14 items-center justify-between border-b border-zinc-900/50 bg-[#070b13]/85 px-6 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/10 border border-teal-500/20 text-[#14b8a6]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="overflow-hidden">
            <span className="font-bold text-xs text-white block truncate max-w-sm">
              {conversation?.title || 'Academic Conversation'}
            </span>
            <span className="text-[9px] text-[#14b8a6] block tracking-wide -mt-0.5">
              SECURE RAG CHANNEL
            </span>
          </div>
        </div>

        <button
          onClick={() => window.dispatchEvent(new Event('open-resources'))}
          className="flex items-center gap-1.5 bg-indigo-500/5 border border-indigo-500/10 hover:border-indigo-500/25 rounded-lg px-2.5 py-1 text-[10px] font-bold text-indigo-400 transition-all cursor-pointer shadow-sm shadow-indigo-500/2"
          title="View Knowledge Sources"
        >
          📚 {kbCount} Sources
        </button>
      </div>

      {/* Message Log */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center space-y-3">
            <Loader2 className="h-6 w-6 animate-spin text-[#14b8a6]" />
            <p className="text-xs text-zinc-500 font-medium">Retrieving academic history...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0e1726]/40 border border-zinc-800 text-[#14b8a6]">
              <Sparkles className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">This workspace session is empty</p>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto mt-1 leading-relaxed">
                Enter your query below to begin querying the educational knowledge base.
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            const sources = msg.metadata?.sources || [];
            const isCopied = copiedId === msg.id;
            const messageRating = ratings[msg.id];
            
            return (
              <div
                key={msg.id}
                className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}
              >
                {isUser ? (
                  /* USER MESSAGE BUBBLE */
                  <div className="flex items-start gap-3 max-w-[80%]">
                    <div className="flex flex-col items-end space-y-1">
                      <div className="rounded-2xl px-4 py-3 bg-[#0e1726] border border-zinc-800 text-zinc-100 shadow-md text-sm leading-relaxed">
                        {msg.content}
                      </div>
                      <span className="text-[9px] text-zinc-600 font-medium">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 shrink-0 border border-zinc-700">
                      <User className="h-4 w-4" />
                    </div>
                  </div>
                ) : (
                  /* AI RESPONSE BUBBLE (RESEARCH ASSISTANT STYLE) */
                  <div className="flex items-start gap-4 max-w-[90%] w-full">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-teal-500/10 to-indigo-500/10 border border-teal-500/30 text-[#14b8a6] shrink-0 shadow-lg shadow-teal-500/5">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-3 overflow-hidden bg-[#0c111e]/40 border border-zinc-900 rounded-2xl p-5 shadow-sm">
                      <div className="flex items-center justify-between border-b border-zinc-900/60 pb-2 mb-1">
                        <span className="text-[10px] font-bold text-[#14b8a6] uppercase tracking-wider">
                          EduAssist AI Response
                        </span>
                        <span className="text-[9px] text-zinc-600 font-medium">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Render markdown formatted text */}
                      <MarkdownRenderer content={msg.content} />

                      {/* Action buttons + Cite Sources */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-900/50 mt-4">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleRating(msg.id, 'helpful')}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              messageRating === 'helpful' 
                                ? 'bg-teal-500/10 border-teal-500/25 text-teal-400' 
                                : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40'
                            }`}
                            title="Helpful"
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleRating(msg.id, 'unhelpful')}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              messageRating === 'unhelpful' 
                                ? 'bg-red-500/10 border-red-500/25 text-red-400' 
                                : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40'
                            }`}
                            title="Not Helpful"
                          >
                            <ThumbsDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleCopyText(msg.id, msg.content)}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40 transition-colors cursor-pointer flex items-center gap-1"
                            title="Copy Response"
                          >
                            {isCopied ? <Check className="h-3.5 w-3.5 text-teal-400" /> : <Copy className="h-3.5 w-3.5" />}
                            {isCopied && <span className="text-[10px] text-teal-400 font-medium">Copied</span>}
                          </button>
                          {msg.id !== 'temp-ai-msg' && (
                            <button
                              onClick={() => handleRegenerate(msg.id)}
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-[#14b8a6] hover:bg-zinc-900/40 transition-colors cursor-pointer"
                              title="Regenerate Answer"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {sources.length > 0 && (
                          <button
                            onClick={() => toggleSources(msg.id)}
                            className={`flex items-center gap-1.5 text-xs font-semibold py-1 px-2.5 rounded-lg border transition-all cursor-pointer ${
                              expandedSources[msg.id]
                                ? 'bg-teal-500/10 border-teal-500/20 text-[#14b8a6]'
                                : 'bg-zinc-900/30 border-zinc-800 text-zinc-400 hover:text-zinc-300 hover:border-zinc-700'
                            }`}
                          >
                            <BookOpen className="h-3.5 w-3.5" />
                            <span>Sources ({sources.length})</span>
                            {expandedSources[msg.id] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>
                        )}
                      </div>

                      {/* Expandable citations list */}
                      {expandedSources[msg.id] && sources.length > 0 && (
                        <div className="mt-4 border border-zinc-800 rounded-xl bg-[#050811] divide-y divide-zinc-900/80 overflow-hidden animate-fade-in max-h-72 overflow-y-auto">
                          <div className="bg-[#0e1726]/20 px-3.5 py-2 text-[10px] font-bold text-[#14b8a6] uppercase tracking-wider flex items-center justify-between">
                            <span>🔎 Knowledge Sources</span>
                            <span className="text-[9px] text-zinc-500 normal-case font-medium">ACTUAL RETRIEVED CHUNKS</span>
                          </div>
                          {sources.map((src, sIdx) => (
                            <div 
                              key={sIdx} 
                              className="p-3.5 space-y-1.5"
                            >
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="flex items-center gap-1.5 font-semibold text-zinc-200">
                                  <FileText className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                                  {src.file_name}
                                </span>
                                <span className="rounded-full bg-teal-500/5 border border-teal-500/10 px-1.5 py-0.5 text-[9px] font-bold text-[#14b8a6]">
                                  {Math.round(src.similarity * 100)}% match
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-400 leading-relaxed pl-5 font-mono italic bg-zinc-950/60 p-2 rounded-lg border border-zinc-900/60">
                                "{src.content}"
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {generating && (
          <div className="flex w-full justify-start animate-fade-in">
            <div className="flex items-center gap-3 rounded-2xl bg-[#0c111e]/60 border border-zinc-900 px-5 py-4 text-xs text-zinc-400 shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin text-[#14b8a6]" />
              <div className="space-y-0.5">
                <span className="font-bold text-zinc-300 block">EduAssist AI is researching...</span>
                <span className="text-[10px] text-zinc-500 block">Searching document chunks and formulating synthesis</span>
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

      {/* Query Bar */}
      <div className="border-t border-zinc-900/50 bg-[#070b13]/40 p-4 md:p-6 shrink-0">
        <form
          onSubmit={handleSendMessage}
          className="relative flex items-center bg-[#0e1726]/45 border border-zinc-800 rounded-2xl p-2.5 shadow-md focus-within:border-teal-500/50 focus-within:ring-1 focus-within:ring-teal-500/50"
        >
          <input
            type="text"
            required
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={generating ? "EduAssist AI is synthesizing your answer..." : "Ask a follow-up question..."}
            className="flex-1 bg-transparent px-4 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none w-full"
            disabled={loading || generating}
          />
          <button
            type="submit"
            disabled={loading || generating || !input.trim()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-[#14b8a6] to-[#0d9488] text-white shadow-md shadow-teal-500/10 hover:brightness-110 disabled:opacity-30 disabled:hover:brightness-100 transition-all cursor-pointer"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </form>
        <div className="flex items-center justify-center gap-1.5 mt-2.5">
          <span className="h-1 w-1 bg-teal-500 rounded-full animate-pulse" />
          <p className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider">
            Powered by your academic knowledge base
          </p>
        </div>
      </div>

    </div>
  );
}

