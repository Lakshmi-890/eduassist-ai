/**
 * Generates vector embeddings for a given text.
 * Supports both OpenAI-compatible endpoints and Google Gemini embedding models.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.EMBEDDING_API_KEY;
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
  const baseUrl = process.env.EMBEDDING_BASE_URL || 'https://api.openai.com/v1';

  if (!apiKey) {
    throw new Error('EMBEDDING_API_KEY is not configured in environment variables.');
  }

  // 1. Google Gemini Embeddings Check
  if (model.includes('text-embedding-004')) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: {
          parts: [{ text }],
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini Embedding API Error: ${response.statusText} - ${errText}`);
    }

    const json = await response.json();
    const vector = json.embedding?.values;
    
    if (!vector || !Array.isArray(vector)) {
      throw new Error(`Invalid Gemini embedding response structure: ${JSON.stringify(json)}`);
    }

    // Google text-embedding-004 outputs 768 dimensions by default.
    // If the database is set to vector(1536), we pad the rest with zeros to maintain dimensions.
    // However, it is best to match the vector size in the database schema.
    // If they configure a 1536 dimension schema, we pad up to 1536.
    if (vector.length < 1536) {
      const paddedVector = new Array(1536).fill(0);
      for (let i = 0; i < vector.length; i++) {
        paddedVector[i] = vector[i];
      }
      return paddedVector;
    }
    
    return vector;
  }

  // 2. OpenAI-compatible Embeddings API (Default)
  const url = `${baseUrl}/embeddings`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: text,
      model: model,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI Embedding API Error: ${response.statusText} - ${errText}`);
  }

  const json = await response.json();
  const vector = json.data?.[0]?.embedding;

  if (!vector || !Array.isArray(vector)) {
    throw new Error(`Invalid OpenAI embedding response structure: ${JSON.stringify(json)}`);
  }

  return vector;
}

/**
 * Generates embeddings in batches for efficiency (optional helper).
 */
export async function getEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  // If using Gemini, process sequentially (Gemini doesn't support batch embedContent in this simple endpoint)
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
  if (model.includes('text-embedding-004')) {
    const results: number[][] = [];
    for (const text of texts) {
      results.push(await getEmbedding(text));
    }
    return results;
  }

  // OpenAI-compatible Batching
  const apiKey = process.env.EMBEDDING_API_KEY;
  const baseUrl = process.env.EMBEDDING_BASE_URL || 'https://api.openai.com/v1';

  if (!apiKey) {
    throw new Error('EMBEDDING_API_KEY is not configured in environment variables.');
  }

  const response = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: texts,
      model: model,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Embedding API Error: ${response.statusText} - ${errText}`);
  }

  const json = await response.json();
  
  if (!json.data || !Array.isArray(json.data)) {
    throw new Error(`Invalid batch embedding response structure`);
  }

  return json.data.map((item: any) => item.embedding);
}
