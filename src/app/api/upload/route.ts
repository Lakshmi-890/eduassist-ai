import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractTextFromPDF } from '@/lib/supabase/pdf';
import { getEmbedding } from '@/lib/supabase/embeddings';
import { upsertToPinecone } from '@/lib/supabase/rag';
import { v4 as uuidv4 } from 'uuid';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Handles PDF uploads:
 * 1. Authenticates session and verifies admin credentials.
 * 2. Parses the PDF from FormData.
 * 3. Extracts raw text.
 * 4. Chunks the text (500 chars, 50 overlap).
 * 5. Generates local embeddings using Xenova.
 * 6. Upserts vector payload to Pinecone index.
 * 7. Logs upload in the Supabase 'documents' table.
 */
export async function POST(request: Request) {
  try {
    // 1. Authenticate user session
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user role
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileErr || profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden. Admin credentials required.' }, { status: 403 });
    }

    // 2. Parse file from FormData
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'Missing file upload' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 });
    }

    // 3. Extract plain text content
    console.log(`[PDF Upload] Starting text extraction for file: ${file.name}`);
    const text = await extractTextFromPDF(file);
    const cleanedText = text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();

    if (!cleanedText || cleanedText.length === 0) {
      console.error('[PDF Upload Failed] Extracted text is empty');
      return NextResponse.json({ error: 'Failed to extract text or PDF is empty.' }, { status: 400 });
    }
    console.log(`[PDF Upload Success] Extracted text length: ${cleanedText.length} characters`);

    // 4. Chunk text into 500-character segments with 50-character overlap
    const chunks: string[] = [];
    const size = 500;
    const overlap = 50;
    let start = 0;

    while (start < cleanedText.length) {
      const end = Math.min(start + size, cleanedText.length);
      chunks.push(cleanedText.substring(start, end));
      if (end === cleanedText.length) {
        break;
      }
      start += (size - overlap);
    }

    if (chunks.length === 0) {
      console.error('[PDF Upload Failed] Text split resulted in zero chunks');
      return NextResponse.json({ error: 'Split resulted in 0 text chunks.' }, { status: 400 });
    }
    console.log(`[PDF Upload] Chunking completed. Total chunks created: ${chunks.length}`);

    // 5. Generate embeddings and create metadata for each chunk
    const documentId = uuidv4();
    const vectors: Array<{
      id: string;
      values: number[];
      metadata: {
        document_id: string;
        file_name: string;
        chunk_number: number;
        text: string;
      };
    }> = [];

    console.log(`[PDF Upload] Generating Hugging Face embeddings for ${chunks.length} chunks...`);
    for (let i = 0; i < chunks.length; i++) {
      const chunkTextContent = chunks[i];
      const embedding = await getEmbedding(chunkTextContent);
      
      console.log(`  - Embedded chunk ${i + 1}/${chunks.length} (dimension: ${embedding.length})`);
      
      vectors.push({
        id: `${documentId}_${i}`,
        values: embedding,
        metadata: {
          document_id: documentId,
          file_name: file.name,
          chunk_number: i,
          text: chunkTextContent,
        },
      });
    }
    console.log(`[PDF Upload] All ${vectors.length} embeddings generated successfully.`);

    // 6. Upsert vector payload to Pinecone index
    const indexName = process.env.PINECONE_INDEX_NAME || process.env.PINCONE_INDEX_NAME || 'eduassist-ai';
    console.log(`[PDF Upload] Upserting vectors to Pinecone index: "${indexName}"...`);
    await upsertToPinecone(vectors);
    console.log(`[PDF Upload Success] Pinecone upsert completed. Namespace: "default", Vector count: ${vectors.length}`);

    // 7. Track document registration in Supabase 'documents' table
    const adminSupabase = createAdminClient();
    const { error: dbError } = await adminSupabase
      .from('documents')
      .insert({
        id: documentId,
        file_name: file.name,
        file_url: `pinecone://${documentId}/${file.name}`,
        file_type: 'application/pdf',
        uploaded_by: user.id,
        status: 'completed',
      });

    if (dbError) {
      console.warn('[PDF Upload Warning] Metadata logged in Pinecone, but failed to write record in Supabase documents table:', dbError);
    } else {
      console.log(`[PDF Upload Complete] Registered document "${file.name}" (ID: ${documentId}) in Supabase.`);
    }

    return NextResponse.json({ status: 'completed', chunks: chunks.length });
  } catch (error: any) {
    console.error('[PDF Upload Failed] Ingestion crash error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
