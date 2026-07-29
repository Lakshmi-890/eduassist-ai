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

  const hfToken = process.env.HUGGINGFACE_API_KEY;
  if (!hfToken) {
    throw new Error('HUGGINGFACE_API_KEY is not configured in environment variables.');
  }

  const model = process.env.HUGGINGFACE_MODEL || 'sentence-transformers/all-MiniLM-L6-v2';
  const url = `https://api-inference.huggingface.co/pipeline/feature-extraction/${model}`;

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

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Hugging Face API Error: ${response.status} ${response.statusText} - ${errText}`);
    }

    const json = await response.json();
    
    let embedding = json;
    if (Array.isArray(embedding) && embedding.length > 0 && Array.isArray(embedding[0])) {
      // If the response is a 2D array (e.g. [[0.1, 0.2, ...]]), extract the first row
      embedding = embedding[0];
    }

    if (!Array.isArray(embedding)) {
      throw new Error(`Expected array from Hugging Face embedding response, but got: ${typeof embedding}`);
    }

    // Since our Pinecone index expects a 384-dimensional vector, let's assert
    if (embedding.length !== 384) {
      throw new Error(`Expected a 384-dimensional embedding, but Hugging Face returned ${embedding.length} dimensions for model ${model}.`);
    }

    return embedding as number[];
  } catch (error: any) {
    console.error('Error generating Hugging Face vector embedding:', error);
    throw new Error(`Embedding generation failed: ${error.message || error}`);
  }
}

