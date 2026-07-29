// Polyfill Math.sumPrecise for Node environments lacking native support for the new ES2026 feature
if (typeof (Math as any).sumPrecise !== 'function') {
  Object.defineProperty(Math, 'sumPrecise', {
    value: function sumPrecise(iterable: Iterable<number>) {
      let sum = 0;
      for (const value of iterable) {
        sum += Number(value) || 0;
      }
      return sum;
    },
    writable: true,
    configurable: true
  });
}

import { extractText, getDocumentProxy } from 'unpdf';

/**
 * Extracts text from an uploaded PDF File object using unpdf.
 * 
 * @param file The PDF File object uploaded from form data.
 * @returns The extracted plain text content.
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    const pdf = await getDocumentProxy(buffer);
    const { text } = await extractText(pdf, { mergePages: true });
    return text || '';
  } catch (error: any) {
    console.error('Error extracting text from PDF via unpdf:', error);
    throw new Error(`PDF text extraction failed: ${error.message || error}`);
  }
}
