import { NextResponse } from 'next/server';
import { getEmbedding } from '@/lib/supabase/embeddings';
import { queryPinecone } from '@/lib/supabase/rag';

export const dynamic = 'force-dynamic';

/**
 * Handles QA searches:
 * 1. Takes the user's question.
 * 2. Computes local embedding (384d).
 * 3. Queries Pinecone index for top 5 matches.
 * 4. Extracts references.
 * 5. Returns a placeholder answer with the list of source references.
 */
export async function POST(request: Request) {
  try {
    const { question } = await request.json();
    if (!question) {
      return NextResponse.json({ error: 'Missing question parameter' }, { status: 400 });
    }

    // 1. Get embedding for question
    const embedding = await getEmbedding(question);

    // 2. Query Pinecone top 5 matches
    const matches = await queryPinecone(embedding);

    // 3. Extract sources from matches
    const sources = matches.map((match: any) => ({
      file_name: match.metadata?.file_name || 'unknown',
      chunk_number: match.metadata?.chunk_number ?? -1,
    }));

    // 4. Return placeholder answer and sources
    return NextResponse.json({
      answer: 'placeholder',
      sources: sources,
    });
  } catch (error: any) {
    console.error('Error during QA/ask route handling:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
