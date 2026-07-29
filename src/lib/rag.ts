import { queryPinecone } from './supabase/rag';
import { getEmbedding } from './supabase/embeddings';

export interface SearchResult {
  id: string;
  document_id: string;
  content: string;
  metadata: {
    file_name: string;
    chunk_index: number;
    char_count: number;
  };
  similarity: number;
}

/**
 * Encodes query and queries the Pinecone vector database for matches.
 */
export async function searchSimilarChunks(
  query: string,
  matchThreshold: number = 0.35, // Relax threshold slightly to find relevant matches
  matchCount: number = 5
): Promise<SearchResult[]> {
  // 1. Generate query embedding
  const queryEmbedding = await getEmbedding(query);

  // 2. Perform similarity search in Pinecone
  const matches = await queryPinecone(queryEmbedding);

  // 3. Map matches to SearchResult shape and filter by score
  return matches
    .filter(m => m.score === undefined || m.score >= matchThreshold)
    .map(m => ({
      id: m.id,
      document_id: m.metadata?.document_id || '',
      content: m.metadata?.text || '',
      metadata: {
        file_name: m.metadata?.file_name || 'Unknown Document',
        chunk_index: m.metadata?.chunk_number || 0,
        char_count: (m.metadata?.text || '').length,
      },
      similarity: m.score || 0,
    }))
    .slice(0, matchCount);
}
