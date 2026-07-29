/**
 * Generates a 384-dimensional vector embedding for the input text using Hugging Face Inference API.
 * 
 * @param text The text content to generate an embedding for.
 * @returns Array of 384 floats representing the embedding vector.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim() === '') {
    throw new Error('Cannot generate embedding for empty text.');
  }

  const rawToken = process.env.HUGGINGFACE_API_KEY;
  const hfToken = rawToken?.trim();
  
  const hasKey = !!hfToken;
  const model = process.env.HUGGINGFACE_MODEL || 'sentence-transformers/all-MiniLM-L6-v2';
  const url = `https://router.huggingface.co/hf-inference/models/${model}`;

  console.log(`[HF DIAGNOSTICS] Starting embedding request. Token Configured: ${hasKey}, Model: "${model}", URL: "${url}"`);

  if (!hasKey) {
    throw new Error('HUGGINGFACE_API_KEY (or EMBEDDING_API_KEY) is not configured in environment variables.');
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: text,
        options: { wait_for_model: true }
      }),
    });

    console.log(`[HF DIAGNOSTICS] Received response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[HF DIAGNOSTICS] Hugging Face Error Response Body: "${errText}"`);
      throw new Error(`Hugging Face API Error: ${response.status} ${response.statusText} - ${errText}`);
    }

    const json = await response.json();
    
    let embedding = json;
    if (Array.isArray(embedding) && embedding.length > 0 && Array.isArray(embedding[0])) {
      // If the response is a 2D array (e.g. [[0.1, 0.2, ...]]), extract the first row
      embedding = embedding[0];
    }

    if (!Array.isArray(embedding)) {
      console.error(`[HF DIAGNOSTICS] Response is not an array. Type: ${typeof json}, Content: ${JSON.stringify(json)}`);
      throw new Error(`Expected array from Hugging Face embedding response, but got: ${typeof embedding}`);
    }

    // Since our Pinecone index expects a 384-dimensional vector, let's assert
    if (embedding.length !== 384) {
      console.error(`[HF DIAGNOSTICS] Dimension mismatch. Expected 384, got ${embedding.length}`);
      throw new Error(`Expected a 384-dimensional embedding, but Hugging Face returned ${embedding.length} dimensions for model ${model}.`);
    }

    console.log(`[HF DIAGNOSTICS] Embedding generated successfully with ${embedding.length} dimensions.`);
    return embedding as number[];
  } catch (error: any) {
    console.error('[HF DIAGNOSTICS] Embedding generation failed with exception:', error);
    
    let details = error.message || String(error);
    if (error.cause) {
      console.error('[HF DIAGNOSTICS] Nested fetch error cause:', error.cause);
      details += ` (Cause: ${error.cause.message || JSON.stringify(error.cause)})`;
    }
    
    throw new Error(`Embedding generation failed: ${details}`);
  }
}

