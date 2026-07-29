import { Pinecone } from '@pinecone-database/pinecone';

let pineconeClient: Pinecone | null = null;

/**
 * Initializes and returns the Pinecone client.
 */
function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    const apiKey = process.env.PINECONE_API_KEY || process.env.PINCONE_API_KEY;
    if (!apiKey) {
      throw new Error('PINECONE_API_KEY (or PINCONE_API_KEY) is not defined in environment variables.');
    }
    pineconeClient = new Pinecone({
      apiKey: apiKey,
    });
  }
  return pineconeClient;
}

/**
 * Returns the configured Pinecone index.
 */
function getIndex() {
  const pc = getPineconeClient();
  const indexName = process.env.PINECONE_INDEX_NAME || process.env.PINCONE_INDEX_NAME || 'eduassist-ai';
  return pc.index(indexName);
}

/**
 * Upserts a batch of vectors to the Pinecone index.
 * 
 * @param vectors Array of vector objects containing id, values, and metadata.
 */
export async function upsertToPinecone(
  vectors: Array<{
    id: string;
    values: number[];
    metadata: {
      document_id: string;
      file_name: string;
      chunk_number: number;
      text: string;
    };
  }>
): Promise<void> {
  try {
    const index = getIndex();
    await index.upsert({
      records: vectors
    });
  } catch (error: any) {
    console.error('Error upserting vectors to Pinecone:', error);
    throw new Error(`Pinecone upsert failed: ${error.message || error}`);
  }
}

/**
 * Queries Pinecone for the top 5 most similar vectors using the provided embedding.
 * 
 * @param embedding The query vector embedding.
 * @returns Top 5 matched vectors.
 */
export async function queryPinecone(embedding: number[]): Promise<any[]> {
  try {
    const index = getIndex();
    const queryResponse = await index.query({
      vector: embedding,
      topK: 5,
      includeMetadata: true,
    });
    return queryResponse.matches || [];
  } catch (error: any) {
    console.error('Error querying Pinecone:', error);
    throw new Error(`Pinecone query failed: ${error.message || error}`);
  }
}
