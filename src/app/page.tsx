'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Sparkles, 
  MessageSquare, 
  Database, 
  Search, 
  ChevronRight, 
  ArrowRight, 
  BookOpen, 
  ShieldAlert, 
  FileText,
  HelpCircle,
  Cpu
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#050811] text-[#f8fafc] font-sans relative overflow-hidden animate-fade-in">
      {/* Background blur effects */}
      <div className="absolute top-0 right-1/4 h-[500px] w-[500px] rounded-full bg-teal-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 h-[400px] w-[400px] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />

      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 border-b border-zinc-900/50 bg-[#050811]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl h-16 items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-teal-500 to-indigo-600 text-white shadow-lg shadow-teal-500/20">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">
              EduAssist AI
            </span>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-xs font-semibold uppercase tracking-wider text-zinc-300 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-[#0e1726]/40 border border-transparent hover:border-zinc-800"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-r from-teal-500 to-indigo-600 px-4 py-2.5 rounded-xl shadow-lg shadow-teal-500/10 hover:brightness-110 transition-all cursor-pointer"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative flex flex-1 flex-col items-center justify-center py-20 px-6 text-center lg:py-32 lg:px-8 z-10">
        <div className="max-w-4xl space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/5 px-4.5 py-1.5 text-xs font-bold uppercase tracking-wider text-teal-400">
            <Sparkles className="h-3.5 w-3.5 animate-pulse" /> Next-Gen RAG Educational Platform
          </div>
          
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl leading-[1.1] max-w-3xl mx-auto">
            Ask. Retrieve. <br />
            <span className="bg-gradient-to-r from-teal-450 via-cyan-400 to-indigo-400 bg-clip-text text-transparent">
              Understand. Learn.
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-sm sm:text-base text-zinc-400 leading-relaxed font-medium">
            An intelligent context-aware educational assistant that retrieves facts directly from course schedules, academic FAQs, and placement guidelines to guarantee reliable answers without hallucinations.
          </p>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
            <Link
              href="/signup"
              className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-indigo-600 px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-teal-500/10 hover:brightness-110 transition-all cursor-pointer"
            >
              Launch Chatbot
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#how-rag-works"
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-300 hover:text-white transition-all py-3.5 px-6 rounded-xl border border-zinc-850 bg-[#0e1726]/40 hover:bg-[#0e1726]/80 cursor-pointer"
            >
              See How It Works
            </a>
          </div>
        </div>
      </section>

      {/* Features Matrix Section */}
      <section className="border-t border-zinc-900/50 bg-[#070b13]/25 py-20 px-6 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Engineered for Academic Precision
            </h2>
            <p className="text-xs text-zinc-450 max-w-md mx-auto leading-relaxed">
              EduAssist AI couples conversational design with a rigorous data pipeline to support students and administration alike.
            </p>
          </div>

          <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <div className="relative rounded-2xl border border-zinc-900 bg-[#0c111e]/20 p-8 hover:border-zinc-800 transition-colors shadow-sm">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/5 text-teal-400 border border-teal-500/10">
                <Database className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-bold text-white">Pinecone Vector Search</h3>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed font-medium">
                Queries are encoded into vector embeddings and matched using semantic similarity against academic files.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="relative rounded-2xl border border-zinc-900 bg-[#0c111e]/20 p-8 hover:border-zinc-800 transition-colors shadow-sm">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/5 text-indigo-400 border border-indigo-500/10">
                <Cpu className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-bold text-white">Groq LLM Integration</h3>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed font-medium">
                Harness the lightning-fast speed of Llama 3 models hosted on Groq for sub-second, intelligent chat responses.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="relative rounded-2xl border border-zinc-900 bg-[#0c111e]/20 p-8 hover:border-zinc-800 transition-colors shadow-sm">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/5 text-red-450 border border-red-500/10">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-bold text-white">Hallucination Blockers</h3>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed font-medium">
                Restricts the LLM to verified document contexts. If information isn't found, the chatbot clearly flags it.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="relative rounded-2xl border border-zinc-900 bg-[#0c111e]/20 p-8 hover:border-zinc-800 transition-colors shadow-sm">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/5 text-teal-400 border border-teal-500/10">
                <FileText className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-bold text-white">Document Management</h3>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed font-medium">
                Admins upload university PDF documents. The backend automatically extracts, cleans, chunks, and indexes files.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="relative rounded-2xl border border-zinc-900 bg-[#0c111e]/20 p-8 hover:border-zinc-800 transition-colors shadow-sm">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/5 text-indigo-400 border border-indigo-500/10">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-bold text-white">Conversational Memory</h3>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed font-medium">
                Maintains multi-turn context. The chatbot understands follow-up questions referencing previous answers.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="relative rounded-2xl border border-zinc-900 bg-[#0c111e]/20 p-8 hover:border-zinc-800 transition-colors shadow-sm">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/5 text-violet-400 border border-violet-500/10">
                <Search className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-bold text-white">Clear Citations</h3>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed font-medium">
                Every generated response cites its matching source document, enabling students to verify the underlying records.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* RAG Workflow Visualizer */}
      <section id="how-rag-works" className="border-t border-zinc-900/50 bg-[#050811] py-20 px-6 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Retrieval-Augmented Generation Architecture
            </h2>
            <p className="text-xs text-zinc-450 max-w-md mx-auto leading-relaxed">
              Unlike standard bots that invent answers, EduAssist AI retrieves source data first before compiling answers.
            </p>
          </div>

          <div className="mt-16 bg-[#0c111e]/15 border border-zinc-900 rounded-3xl p-8 lg:p-12 max-w-5xl mx-auto shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              
              {/* Step 1 */}
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/5 border border-teal-500/25 text-teal-400 shadow-md">
                  <Database className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">Phase 1</div>
                  <h3 className="text-sm font-bold text-white">1. Vector Ingestion</h3>
                  <p className="text-xs text-zinc-450 max-w-xs leading-relaxed font-medium">
                    Academic files are parsed, chunked, and embedded into high-dimensional vectors stored in Pinecone database.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/5 border border-indigo-500/25 text-indigo-400 shadow-md">
                  <Search className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Phase 2</div>
                  <h3 className="text-sm font-bold text-white">2. Semantic Querying</h3>
                  <p className="text-xs text-zinc-450 max-w-xs leading-relaxed font-medium">
                    When you ask a question, the application generates a query embedding and runs a cosine similarity match against vectors.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/5 border border-violet-500/25 text-violet-400 shadow-md">
                  <Cpu className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">Phase 3</div>
                  <h3 className="text-sm font-bold text-white">3. Context Synthesis</h3>
                  <p className="text-xs text-zinc-450 max-w-xs leading-relaxed font-medium">
                    The top matching content is packaged with your query and history, prompting the Groq LLM to stream a factual, cited response.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="border-t border-zinc-900/50 bg-gradient-to-b from-[#050811] to-[#070b13]/60 py-20 text-center">
        <div className="mx-auto max-w-4xl px-6 space-y-6">
          <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
            Empower Students with Factual AI
          </h2>
          <p className="mx-auto max-w-md text-xs text-zinc-450 font-medium leading-relaxed">
            Deploy a reliable assistant for academic guidelines, FAQ lookup, course policies, and placement rules.
          </p>
          <div className="pt-4">
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-indigo-600 px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-teal-500/10 hover:brightness-110 transition-all hover:scale-102 cursor-pointer"
            >
              Sign Up Now
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900/50 bg-[#050811] py-8 px-6 text-center text-[10px] font-semibold text-zinc-500 tracking-wider">
        <p>&copy; {new Date().getFullYear()} EduAssist AI. Built for the OnlyAI Academy LLMs & RAG Systems Capstone Project.</p>
      </footer>
    </div>
  );
}
