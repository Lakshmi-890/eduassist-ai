import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // 1. Verify user session
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Authorize admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // 3. Fetch document details to get file storage path
    const { data: doc, error: fetchErr } = await adminSupabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // 4. Delete file from Supabase Storage
    const { error: storageErr } = await adminSupabase.storage
      .from('educational-documents')
      .remove([doc.file_url]);

    if (storageErr) {
      console.error('Failed to remove file from storage:', storageErr);
      // We continue to delete database records even if storage file is missing
    }

    // Delete corresponding chunks from Pinecone
    try {
      const { Pinecone } = await import('@pinecone-database/pinecone');
      const apiKey = process.env.PINECONE_API_KEY || process.env.PINCONE_API_KEY;
      if (apiKey) {
        const pc = new Pinecone({ apiKey });
        const indexName = process.env.PINECONE_INDEX_NAME || process.env.PINCONE_INDEX_NAME || 'eduassist-ai';
        const index = pc.index(indexName);
        await index.deleteMany({
          filter: {
            document_id: { $eq: id }
          }
        });
        console.log(`Successfully deleted Pinecone vectors for document: ${id}`);
      }
    } catch (pineconeErr) {
      console.error('Pinecone vector cleanup failed for document deletion:', pineconeErr);
    }

    // 5. Delete row from documents table (foreign key cascades to document_chunks)
    const { error: deleteErr } = await adminSupabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (deleteErr) {
      console.error('Failed to delete document from database:', deleteErr);
      return NextResponse.json({ error: `Database deletion error: ${deleteErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Delete route handler error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
