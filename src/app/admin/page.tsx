'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  FileText, 
  HelpCircle, 
  Layers, 
  MessageSquare,
  Sparkles, 
  Loader2,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Upload,
  Plus,
  Edit,
  Trash2,
  Save,
  Search,
  X,
  Database,
  ArrowLeft,
  Calendar
} from 'lucide-react';

interface Document {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message: string | null;
  created_at: string;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  created_at: string;
}

function AdminDashboardContent() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  const [stats, setStats] = useState({
    totalDocuments: 0,
    processedDocuments: 0,
    failedDocuments: 0,
    totalFaqs: 0,
  });
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Ingestion / PDF upload states
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>(''); // "Extracting...", "Chunking...", "Embedding...", "Completed", "Failed"
  const [uploadError, setUploadError] = useState<string | null>(null);

  // FAQ CRUD form states
  const [showFaqForm, setShowFaqForm] = useState(false);
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');
  const [faqSaving, setFaqSaving] = useState(false);
  const [faqError, setFaqError] = useState<string | null>(null);
  const [faqSuccess, setFaqSuccess] = useState<string | null>(null);

  // Search states
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [faqSearchQuery, setFaqSearchQuery] = useState('');

  const supabase = createClient();

  const loadData = async () => {
    try {
      // 1. Fetch total document count
      const { count: totalDocs, error: totalDocsErr } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true });
      if (totalDocsErr) throw totalDocsErr;

      // 2. Fetch processed document count (status = 'completed')
      const { count: processedDocs, error: processedErr } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');
      if (processedErr) throw processedErr;

      // 3. Fetch failed document count (status = 'failed')
      const { count: failedDocs, error: failedErr } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed');
      if (failedErr) throw failedErr;

      // 4. Fetch FAQs count
      const { count: totalFaqs, error: totalFaqsErr } = await supabase
        .from('faqs')
        .select('*', { count: 'exact', head: true });
      if (totalFaqsErr) throw totalFaqsErr;

      // 5. Fetch documents list
      const { data: docList, error: docListErr } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });
      if (docListErr) throw docListErr;

      // 6. Fetch FAQs list
      const { data: faqList, error: faqListErr } = await supabase
        .from('faqs')
        .select('*')
        .order('created_at', { ascending: false });
      if (faqListErr) throw faqListErr;

      setStats({
        totalDocuments: totalDocs || 0,
        processedDocuments: processedDocs || 0,
        failedDocuments: failedDocs || 0,
        totalFaqs: totalFaqs || 0,
      });
      setDocuments(docList || []);
      setFaqs(faqList || []);
    } catch (err: any) {
      console.error('Error loading admin dashboard metrics:', err);
      setError('Failed to retrieve statistics and knowledge base lists.');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      await loadData();
      setLoading(false);
    };

    fetchData();

    // Subscribe to realtime updates for documents & faqs
    const channel = supabase
      .channel('admin-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, () => {
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'faqs' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Upload handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadFile(e.target.files[0]);
      setUploadError(null);
      setUploadStatus('');
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Please select a PDF file first.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadStatus('Extracting...');

    const timer1 = setTimeout(() => setUploadStatus('Chunking...'), 1200);
    const timer2 = setTimeout(() => setUploadStatus('Embedding...'), 2800);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      clearTimeout(timer1);
      clearTimeout(timer2);

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      setUploadStatus('Completed');
      setUploadFile(null);
      setSuccess(`Ingested "${uploadFile.name}" into Pinecone vector store successfully!`);
      
      const fileInput = document.getElementById('pdf-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      await loadData();
    } catch (err: any) {
      console.error('File upload error:', err);
      setUploadError(err.message || 'Failed to complete PDF ingestion.');
      setUploadStatus('Failed');
    } finally {
      setUploading(false);
    }
  };

  // Delete Document handler
  const handleDeleteDocument = async (id: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"? This will delete the raw file, Supabase metadata, and all vector chunks from Pinecone.`)) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/admin/documents/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Failed to delete document');
      }

      setSuccess(`Document "${fileName}" deleted successfully.`);
      await loadData();
    } catch (err: any) {
      console.error('Delete document error:', err);
      setError(`Failed to delete document: ${err.message}`);
    }
  };

  // FAQ CRUD handlers
  const handleFaqCreateOpen = () => {
    setEditingFaqId(null);
    setFaqQuestion('');
    setFaqAnswer('');
    setShowFaqForm(true);
    setFaqError(null);
    setFaqSuccess(null);
  };

  const handleFaqEditOpen = (faq: FAQ) => {
    setEditingFaqId(faq.id);
    setFaqQuestion(faq.question);
    setFaqAnswer(faq.answer);
    setShowFaqForm(true);
    setFaqError(null);
    setFaqSuccess(null);
  };

  const handleFaqCloseForm = () => {
    setShowFaqForm(false);
    setEditingFaqId(null);
    setFaqQuestion('');
    setFaqAnswer('');
  };

  const handleFaqSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!faqQuestion.trim() || !faqAnswer.trim()) {
      setFaqError('Please fill in both fields.');
      return;
    }

    setFaqSaving(true);
    setFaqError(null);
    setFaqSuccess(null);

    try {
      const res = await fetch('/api/admin/faqs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingFaqId,
          question: faqQuestion.trim(),
          answer: faqAnswer.trim(),
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Failed to save FAQ');
      }

      setFaqSuccess(editingFaqId ? 'FAQ updated successfully!' : 'FAQ created successfully!');
      handleFaqCloseForm();
      await loadData();
    } catch (err: any) {
      console.error('Save FAQ error:', err);
      setFaqError(err.message || 'An error occurred while saving the FAQ.');
    } finally {
      setFaqSaving(false);
    }
  };

  const handleFaqDelete = async (id: string, qText: string) => {
    if (!confirm(`Are you sure you want to delete this FAQ: "${qText.slice(0, 40)}..."?`)) {
      return;
    }

    setFaqError(null);
    setFaqSuccess(null);

    try {
      const res = await fetch('/api/admin/faqs', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Failed to delete FAQ');
      }

      setFaqSuccess('FAQ deleted successfully.');
      await loadData();
    } catch (err: any) {
      console.error('Delete FAQ error:', err);
      setFaqError(`Failed to delete FAQ: ${err.message}`);
    }
  };

  // Filters
  const filteredDocs = documents.filter(doc => 
    doc.file_name.toLowerCase().includes(docSearchQuery.toLowerCase())
  );

  const filteredFaqs = faqs.filter(faq => 
    faq.question.toLowerCase().includes(faqSearchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(faqSearchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center space-y-3">
        <Loader2 className="h-7 w-7 animate-spin text-amber-500" />
        <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Syncing Admin metrics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl animate-fade-in pb-16">
      
      {/* Title / Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-zinc-900/50 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-500 uppercase tracking-widest">
            <Database className="h-4 w-4" />
            Workspace Storage Control
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl mt-1">
            Knowledge Management Center
          </h2>
          <p className="text-zinc-400 text-xs sm:text-sm mt-0.5">
            Ingest PDFs, build index databases, and define direct semantic search assets.
          </p>
        </div>
        
        <Link 
          href="/chat"
          className="inline-flex items-center gap-1.5 self-start md:self-center px-3.5 py-2 rounded-xl bg-[#0e1726]/40 border border-zinc-800 hover:border-zinc-700 text-xs font-semibold text-zinc-300 hover:text-white transition-all shadow-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Student Portal
        </Link>
      </div>

      {/* RAG Notification Alerts */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-xs text-red-400 animate-fade-in">
          <AlertCircle className="h-5 w-5 shrink-0 animate-pulse" />
          <p className="font-medium">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-xs text-emerald-450 animate-fade-in">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <p className="font-medium">{success}</p>
        </div>
      )}

      {/* Grid Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Documents */}
        <div className="rounded-xl border border-zinc-900 bg-[#0c111e]/40 p-5 space-y-4 hover:border-zinc-800 transition-colors shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              Total Documents
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-500/5 text-indigo-400 border border-indigo-500/10">
              <FileText className="h-4.5 w-4.5" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-extrabold text-white leading-none">{stats.totalDocuments}</span>
            <span className="text-[10px] text-zinc-500 block mt-1 font-semibold">Registered in Supabase DB</span>
          </div>
        </div>

        {/* Processed (completed) */}
        <div className="rounded-xl border border-zinc-900 bg-[#0c111e]/40 p-5 space-y-4 hover:border-zinc-800 transition-colors shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              Processed Docs
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-500/5 text-emerald-400 border border-emerald-500/10">
              <CheckCircle className="h-4.5 w-4.5" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-extrabold text-white leading-none">{stats.processedDocuments}</span>
            <span className="text-[10px] text-zinc-500 block mt-1 font-semibold">Synced with Pinecone</span>
          </div>
        </div>

        {/* Failed */}
        <div className="rounded-xl border border-zinc-900 bg-[#0c111e]/40 p-5 space-y-4 hover:border-zinc-800 transition-colors shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              Failed Runs
            </span>
            <div className="p-1.5 rounded-lg bg-red-500/5 text-red-400 border border-red-500/10">
              <XCircle className="h-4.5 w-4.5" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-extrabold text-white leading-none">{stats.failedDocuments}</span>
            <span className="text-[10px] text-zinc-500 block mt-1 font-semibold">Errors during parsing/indexing</span>
          </div>
        </div>

        {/* FAQs */}
        <div className="rounded-xl border border-zinc-900 bg-[#0c111e]/40 p-5 space-y-4 hover:border-zinc-800 transition-colors shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              Total FAQs
            </span>
            <div className="p-1.5 rounded-lg bg-amber-500/5 text-amber-400 border border-amber-500/10">
              <HelpCircle className="h-4.5 w-4.5" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-extrabold text-white leading-none">{stats.totalFaqs}</span>
            <span className="text-[10px] text-zinc-500 block mt-1 font-semibold">Direct Q&A structured entries</span>
          </div>
        </div>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Recent upload history */}
          <div className="lg:col-span-2 rounded-xl border border-zinc-900 bg-[#0c111e]/20 p-6 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Recent Knowledge Uploads</h3>
            
            <div className="divide-y divide-zinc-900/60 mt-4">
              {documents.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-650">
                  No documents synced with Pinecone yet.
                </div>
              ) : (
                documents.slice(0, 5).map((doc) => {
                  const isPending = doc.status === 'pending';
                  const isProcessing = doc.status === 'processing';
                  const isCompleted = doc.status === 'completed';
                  const isFailed = doc.status === 'failed';

                  return (
                    <div key={doc.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-2 rounded-lg bg-[#0e1726] border border-zinc-800 shrink-0 text-zinc-400">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-semibold truncate text-zinc-100">
                            {doc.file_name}
                          </p>
                          <p className="text-[9px] text-zinc-500 font-semibold uppercase mt-0.5">
                            Uploaded {new Date(doc.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isPending && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-900 px-2 py-0.5 text-[9px] font-bold text-zinc-500 border border-zinc-800">
                            <Clock className="h-2 w-2" /> Pending
                          </span>
                        )}
                        {isProcessing && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[9px] font-bold text-indigo-400 border border-indigo-500/10 animate-pulse">
                            <Loader2 className="h-2 w-2 animate-spin" /> Processing
                          </span>
                        )}
                        {isCompleted && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-450 border border-emerald-500/10">
                            <CheckCircle className="h-2 w-2" /> Completed
                          </span>
                        )}
                        {isFailed && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[9px] font-bold text-red-400 border border-red-500/10">
                            <XCircle className="h-2 w-2" /> Failed
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Knowledge Base Status Card */}
          <div className="rounded-xl border border-zinc-900 bg-[#0c111e]/20 p-6 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Engine Status</h3>
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between text-xs border-b border-zinc-900/60 pb-2.5">
                <span className="text-zinc-400 font-medium">Pinecone Index</span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </span>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-zinc-900/60 pb-2.5">
                <span className="text-zinc-400 font-medium">Embedding Model</span>
                <span className="font-semibold text-zinc-300">Xenova all-MiniLM</span>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-zinc-900/60 pb-2.5">
                <span className="text-zinc-400 font-medium">Dimensions</span>
                <span className="font-semibold text-zinc-300">384d Dense</span>
              </div>
              <div className="flex items-center justify-between text-xs pb-1">
                <span className="text-zinc-400 font-medium">RAG Query Mode</span>
                <span className="font-semibold text-amber-500 uppercase tracking-wide">Context Search</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Documents */}
      {activeTab === 'documents' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Upload Zone */}
          <div className="md:col-span-1 rounded-xl border border-zinc-900 bg-[#0c111e]/20 p-6 space-y-5 flex flex-col justify-between h-fit shadow-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-white">
                <Upload className="h-4.5 w-4.5 text-amber-500" />
                <h3 className="text-sm font-bold uppercase tracking-wider">Upload Resources</h3>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                Upload academic PDFs to chunk, embed, and sync directly with the Pinecone vector index.
              </p>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Select PDF Document
                </label>
                <div className="relative border border-zinc-800 bg-[#050811] rounded-xl p-3 flex items-center justify-center transition-all hover:border-zinc-700">
                  <input
                    id="pdf-file-input"
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileChange}
                    disabled={uploading}
                    className="block w-full text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#0e1726] file:text-zinc-300 hover:file:bg-zinc-800 cursor-pointer disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Status Display */}
              {uploadStatus && (
                <div className="rounded-xl bg-[#050811] p-3 border border-zinc-900 text-xs">
                  <div className="flex items-center gap-2">
                    {uploading && uploadStatus !== 'Completed' && uploadStatus !== 'Failed' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
                    ) : uploadStatus === 'Completed' ? (
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-red-400" />
                    )}
                    <span className="font-semibold text-zinc-200">
                      Status: {uploadStatus}
                    </span>
                  </div>
                </div>
              )}

              {uploadError && (
                <div className="flex items-start gap-2 text-[11px] text-red-400 bg-red-950/15 border border-red-900/25 rounded-xl p-3">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span className="break-all">{uploadError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={uploading || !uploadFile}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:brightness-95 text-zinc-950 font-bold py-3 text-xs transition duration-200 disabled:bg-zinc-900 disabled:text-zinc-650 disabled:border-zinc-800 disabled:cursor-not-allowed cursor-pointer shadow-md"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Ingesting RAG Database...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Sync with Pinecone
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Search and List */}
          <div className="md:col-span-2 rounded-xl border border-zinc-900 bg-[#0c111e]/20 p-6 space-y-4 flex flex-col justify-between shadow-sm">
            <div className="flex items-center bg-[#050811] border border-zinc-800/80 rounded-xl px-3.5 py-2">
              <Search className="h-4.5 w-4.5 text-zinc-500 mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Search indexed college documents..."
                value={docSearchQuery}
                onChange={(e) => setDocSearchQuery(e.target.value)}
                className="bg-transparent text-xs placeholder-zinc-500 text-zinc-200 outline-none w-full"
              />
            </div>

            <div className="flex-1 min-h-[260px] overflow-y-auto max-h-[380px] border border-zinc-900 rounded-xl bg-[#050811] divide-y divide-zinc-900 mt-2">
              {filteredDocs.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-600">
                  {docSearchQuery ? 'No documents match your query.' : 'No documents indexed yet.'}
                </div>
              ) : (
                filteredDocs.map((doc) => {
                  const isPending = doc.status === 'pending';
                  const isProcessing = doc.status === 'processing';
                  const isCompleted = doc.status === 'completed';
                  const isFailed = doc.status === 'failed';

                  return (
                    <div key={doc.id} className="flex items-center justify-between p-4 hover:bg-[#0e1726]/10">
                      <div className="flex items-center gap-3 overflow-hidden pr-4">
                        <div className="p-2 rounded-lg bg-[#0e1726]/60 border border-zinc-800 shrink-0 text-zinc-400">
                          <FileText className="h-4.5 w-4.5" />
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-semibold truncate text-white">
                            {doc.file_name}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-zinc-500 mt-0.5">
                            <span className="font-semibold uppercase">Uploaded {new Date(doc.created_at).toLocaleDateString()}</span>
                            {doc.error_message && (
                              <span className="text-red-400 font-semibold truncate max-w-[200px]" title={doc.error_message}>
                                • Error: {doc.error_message}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {/* Status tag */}
                        {isPending && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-900 px-2.5 py-0.5 text-[9px] font-bold text-zinc-500 border border-zinc-800">
                            <Clock className="h-2 w-2" /> Pending
                          </span>
                        )}
                        {isProcessing && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[9px] font-bold text-indigo-400 border border-indigo-500/10 animate-pulse">
                            <Loader2 className="h-2.5 w-2.5 animate-spin" /> Processing
                          </span>
                        )}
                        {isCompleted && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[9px] font-bold text-emerald-450 border border-emerald-500/10">
                            <CheckCircle className="h-2 w-2" /> Indexed
                          </span>
                        )}
                        {isFailed && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-[9px] font-bold text-red-400 border border-red-500/10">
                            <AlertCircle className="h-2 w-2" /> Failed
                          </span>
                        )}

                        {/* Delete button */}
                        <button
                          onClick={() => handleDeleteDocument(doc.id, doc.file_name)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/5 transition-all focus:outline-none cursor-pointer"
                          title="Delete Document"
                          disabled={isProcessing}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: FAQs */}
      {activeTab === 'faqs' && (
        <div className="space-y-6">
          {/* FAQ form trigger */}
          <div className="flex items-center justify-between border-b border-zinc-900/50 pb-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Academic FAQs</h3>
            {!showFaqForm && (
              <button
                onClick={handleFaqCreateOpen}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-950 shadow-lg shadow-amber-500/10 transition-all cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> Add Q&A Entry
              </button>
            )}
          </div>

          {/* FAQ Alerts */}
          {faqError && (
            <div className="flex items-center gap-3 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-xs text-red-400 animate-fade-in">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="font-semibold">{faqError}</p>
            </div>
          )}
          {faqSuccess && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-xs text-emerald-450 animate-fade-in">
              <CheckCircle className="h-5 w-5 shrink-0" />
              <p className="font-semibold">{faqSuccess}</p>
            </div>
          )}

          {/* FAQ Form Card */}
          {showFaqForm && (
            <div className="rounded-xl border border-zinc-900 bg-[#0c111e]/20 p-6 space-y-6 animate-fade-in shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                  {editingFaqId ? '✏️ Edit FAQ Entry' : '➕ Create FAQ Entry'}
                </h4>
                <button
                  onClick={handleFaqCloseForm}
                  className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900 transition-colors cursor-pointer"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              <form onSubmit={handleFaqSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label htmlFor="question" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                    Question Text
                  </label>
                  <input
                    id="question"
                    type="text"
                    required
                    value={faqQuestion}
                    onChange={(e) => setFaqQuestion(e.target.value)}
                    placeholder="e.g., Where is the placement coordination cell located?"
                    className="block w-full rounded-xl border border-zinc-800 bg-[#050811] px-4 py-3 text-white placeholder-zinc-650 outline-none focus:border-amber-500/50 transition-all text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="answer" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                    Answer Description
                  </label>
                  <textarea
                    id="answer"
                    required
                    rows={4}
                    value={faqAnswer}
                    onChange={(e) => setFaqAnswer(e.target.value)}
                    placeholder="Provide a clear, detailed, and factual answer to this question..."
                    className="block w-full rounded-xl border border-zinc-800 bg-[#050811] px-4 py-3 text-white placeholder-zinc-650 outline-none focus:border-amber-500/50 transition-all text-xs resize-y"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-900/60">
                  <button
                    type="button"
                    onClick={handleFaqCloseForm}
                    className="px-4 py-2.5 rounded-xl border border-zinc-850 text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={faqSaving}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-bold uppercase tracking-wider text-zinc-950 shadow-lg shadow-amber-500/10 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {faqSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    {faqSaving ? 'Saving...' : 'Save Entry'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Search FAQs */}
          <div className="rounded-xl border border-zinc-900 bg-[#0c111e]/20 p-6 space-y-5 shadow-sm">
            <div className="flex items-center bg-[#050811] border border-zinc-800/80 rounded-xl px-3.5 py-2">
              <Search className="h-4.5 w-4.5 text-zinc-500 mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Search FAQs by question or answer keyword..."
                value={faqSearchQuery}
                onChange={(e) => setFaqSearchQuery(e.target.value)}
                className="bg-transparent text-xs placeholder-zinc-500 text-zinc-200 outline-none w-full"
              />
            </div>

            {/* Grid List */}
            {filteredFaqs.length === 0 ? (
              <div className="py-12 text-center text-xs text-zinc-650">
                {faqSearchQuery ? 'No FAQs match your search.' : 'No FAQs recorded yet.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                {filteredFaqs.map((faq) => (
                  <div 
                    key={faq.id} 
                    className="rounded-xl border border-zinc-900 bg-[#050811] p-5 hover:border-zinc-800 hover:bg-[#0c111e]/40 transition-all flex flex-col justify-between shadow-sm animate-fade-in"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start gap-2.5 text-white">
                        <div className="p-1 rounded-lg bg-amber-500/5 border border-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                          <HelpCircle className="h-4 w-4" />
                        </div>
                        <h4 className="font-bold text-xs leading-snug">{faq.question}</h4>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap pl-6.5 font-medium">
                        {faq.answer}
                      </p>
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t border-zinc-900/60 mt-4 pt-3.5">
                      <button
                        onClick={() => handleFaqEditOpen(faq)}
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white p-1.5 px-2.5 rounded-lg hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-all cursor-pointer"
                      >
                        <Edit className="h-3.5 w-3.5 text-zinc-500" /> Edit
                      </button>
                      <button
                        onClick={() => handleFaqDelete(faq.id, faq.question)}
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-zinc-550 hover:text-red-400 p-1.5 px-2.5 rounded-lg hover:bg-red-500/5 transition-all cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex h-[50vh] flex-col items-center justify-center space-y-2">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        <p className="text-sm text-zinc-500">Loading dashboard...</p>
      </div>
    }>
      <AdminDashboardContent />
    </Suspense>
  );
}
