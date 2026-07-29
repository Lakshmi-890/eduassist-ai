import { createAdminClient } from '@/lib/supabase/admin';
import { parsePdf, cleanText, chunkText } from '@/lib/pdf';
import { getEmbedding } from '@/lib/supabase/embeddings';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = createAdminClient();
  let docId = '';

  try {
    const { documentId } = await request.json();
    docId = documentId;

    if (!docId) {
      return NextResponse.json({ error: 'Missing documentId parameter' }, { status: 400 });
    }

    // 1. Fetch document record
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', docId)
      .single();

    if (docError || !doc) {
      throw new Error(`Document record not found: ${docError?.message || 'Empty result'}`);
    }

    // Update status to processing
    await supabase
      .from('documents')
      .update({ status: 'processing', error_message: null })
      .eq('id', docId);

    // 2. Download raw PDF file from private Storage bucket
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('educational-documents')
      .download(doc.file_url);

    if (downloadError || !fileData) {
      throw new Error(`Storage file download failed: ${downloadError?.message || 'Empty file'}`);
    }

    // Convert Blob/File data into arrayBuffer and Buffer
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Extract Text
    const rawText = await parsePdf(buffer);
    const cleanedText = cleanText(rawText);

    if (!cleanedText || cleanedText.length < 10) {
      throw new Error('Extracted text is empty or too short to index. Ensure the PDF contains readable text characters (not scanned images).');
    }

    // 4. Create Overlapping Chunks
    const chunks = chunkText(cleanedText);

    if (chunks.length === 0) {
      throw new Error('Text extraction was successful, but split resulted in zero chunks.');
    }

    // 5. Generate Embeddings & Formulate DB payload
    const chunkPayload = [];
    for (const chunk of chunks) {
      const rawVector = await getEmbedding(chunk.content);
      const vector = rawVector.length < 1536
        ? [...rawVector, ...new Array(1536 - rawVector.length).fill(0)]
        : rawVector;
      
      chunkPayload.push({
        document_id: docId,
        content: chunk.content,
        embedding: vector,
        metadata: {
          file_name: doc.file_name,
          chunk_index: chunk.metadata.chunk_index,
          char_count: chunk.metadata.char_count,
        },
      });
    }

    // 6. Bulk Insert to Supabase Postgres (batch inserts of 50 for safety)
    const batchSize = 50;
    for (let i = 0; i < chunkPayload.length; i += batchSize) {
      const batch = chunkPayload.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('document_chunks')
        .insert(batch);

      if (insertError) {
        throw new Error(`Failed to bulk insert vector chunks: ${insertError.message}`);
      }
    }

    // 7. Update status to completed
    await supabase
      .from('documents')
      .update({ status: 'completed' })
      .eq('id', docId);

    return NextResponse.json({ success: true, chunksCount: chunks.length });
  } catch (err: any) {
    console.error('Extraction & Ingestion Error:', err);
    
    if (docId) {
      // Flag failure and write error logs to the document table
      await supabase
        .from('documents')
        .update({ 
          status: 'failed', 
          error_message: err.message || 'Unknown ingestion pipeline crash' 
        })
        .eq('id', docId);
    }

    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
