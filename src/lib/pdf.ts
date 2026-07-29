import { PDFParse } from 'pdf-parse';

export interface TextChunk {
  content: string;
  metadata: {
    chunk_index: number;
    char_count: number;
  };
}

/**
 * Parses raw PDF buffer and extracts text content.
 */
export async function parsePdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();
  return result.text || '';
}

/**
 * Normalizes text spacing, collapses consecutive carriage returns, and trims whitespace.
 */
export function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n') // replace excessive blank lines with double blank line
    .replace(/[ \t]+/g, ' ')    // collapse multiple spaces/tabs
    .trim();
}

/**
 * Splits text into overlapping semantic segments using a boundary-seeking character chunker.
 */
export function chunkText(text: string, chunkSize: number = 800, chunkOverlap: number = 150): TextChunk[] {
  const chunks: TextChunk[] = [];
  let startIndex = 0;
  let chunkIdx = 0;

  if (!text) return [];

  while (startIndex < text.length) {
    let endIndex = startIndex + chunkSize;
    
    // Try to find a natural sentence/paragraph boundary within the overlap range
    if (endIndex < text.length) {
      const searchWindowStart = Math.max(startIndex, endIndex - 150);
      const boundaryWindow = text.substring(searchWindowStart, endIndex);
      
      let boundaryIdx = -1;
      const separators = ['\n\n', '\n', '. ', '? ', '! ', ' '];
      
      for (const sep of separators) {
        const foundIdx = boundaryWindow.lastIndexOf(sep);
        if (foundIdx !== -1) {
          boundaryIdx = searchWindowStart + foundIdx + sep.length;
          break;
        }
      }
      
      if (boundaryIdx !== -1) {
        endIndex = boundaryIdx;
      }
    } else {
      endIndex = text.length;
    }

    const chunkContent = text.substring(startIndex, endIndex).trim();
    if (chunkContent.length > 30) { // Ignore tiny trash fragments
      chunks.push({
        content: chunkContent,
        metadata: {
          chunk_index: chunkIdx++,
          char_count: chunkContent.length,
        },
      });
    }

    startIndex = endIndex - chunkOverlap;
    
    // Prevent infinite loops or backward indexing
    if (startIndex >= text.length || endIndex >= text.length) {
      break;
    }
    
    if (startIndex <= endIndex - chunkSize) {
      startIndex = endIndex;
    }
  }

  return chunks;
}
