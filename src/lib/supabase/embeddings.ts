import { pipeline } from '@xenova/transformers';

let pipelineInstance: any = null;

/**
 * Retrieves or initializes the feature extraction pipeline singleton.
 */
async function getExtractor(): Promise<any> {
  if (!pipelineInstance) {
    // Model 'sentence-transformers/all-MiniLM-L6-v2' is mapped to 'Xenova/all-MiniLM-L6-v2' in Xenova's hub
    pipelineInstance = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return pipelineInstance;
}

/**
 * Generates a 384-dimensional vector embedding for the input text locally using @xenova/transformers.
 * 
 * @param text The text content to generate an embedding for.
 * @returns Array of 384 floats representing the embedding vector.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim() === '') {
    throw new Error('Cannot generate embedding for empty text.');
  }
  
  try {
    const extractor = await getExtractor();
    const output = await extractor(text, {
      pooling: 'mean',
      normalize: true,
    });
    
    // Extract data from the output tensor and cast/map it to a Javascript number array
    const embedding = Array.from(output.data) as number[];
    
    if (embedding.length !== 384) {
      throw new Error(`Expected a 384-dimensional embedding, but got ${embedding.length} dimensions.`);
    }
    
    return embedding;
  } catch (error: any) {
    console.error('Error generating local vector embedding:', error);
    throw new Error(`Embedding generation failed: ${error.message || error}`);
  }
}
