import { createClient } from '@supabase/supabase-js';
import { Pinecone } from '@pinecone-database/pinecone';
import { extractText, getDocumentProxy } from 'unpdf';
import * as fs from 'fs';
import * as path from 'path';

// Polyfill Math.sumPrecise for Node environments lacking native support
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

// Load .env.local manually
const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env: { [key: string]: string } = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value.trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const pcApiKey = env.PINECONE_API_KEY || env.PINCONE_API_KEY;
const pcIndexName = env.PINECONE_INDEX_NAME || env.PINCONE_INDEX_NAME || 'eduassist-ai';
const hfToken = env.HUGGINGFACE_API_KEY || env.EMBEDDING_API_KEY;
const hfModel = env.HUGGINGFACE_MODEL || 'sentence-transformers/all-MiniLM-L6-v2';

async function getEmbedding(text: string): Promise<number[]> {
  if (!hfToken) {
    throw new Error('HUGGINGFACE_API_KEY is not configured.');
  }
  const url = `https://router.huggingface.co/hf-inference/models/${hfModel}`;
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
    throw new Error(`HF API error: ${response.statusText} - ${errText}`);
  }

  const json = await response.json();
  let embedding = json;
  if (Array.isArray(embedding) && embedding.length > 0 && Array.isArray(embedding[0])) {
    embedding = embedding[0];
  }
  return embedding as number[];
}

async function main() {
  if (!supabaseUrl || !supabaseKey || !pcApiKey) {
    console.error('Missing configuration in env.');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const pc = new Pinecone({ apiKey: pcApiKey });
  const index = pc.index(pcIndexName);

  console.log('Retrieving documents from Supabase...');
  const { data: documents, error } = await supabase
    .from('documents')
    .select('*');

  if (error || !documents) {
    console.error('Failed to load documents:', error);
    return;
  }

  console.log(`Analyzing ${documents.length} registered documents...`);

  for (const doc of documents) {
    console.log(`\n----------------------------------------`);
    console.log(`Document: "${doc.file_name}"`);
    console.log(`ID: ${doc.id}`);

    if (doc.file_url.startsWith('pinecone://')) {
      console.log(`Status: In-Memory Indexed`);
      console.log(`Note: This file was uploaded directly to Pinecone and not saved in Supabase storage.`);
      console.log(`Checking if Pinecone vectors exist for this ID...`);
      
      const stats = await index.describeIndexStats();
      const hasRecord = stats.totalRecordCount && stats.totalRecordCount > 0;
      if (hasRecord) {
        console.log(`Result: Vectors found in Pinecone. No re-indexing required.`);
      } else {
        console.log(`Result: No records found. Please re-upload the original PDF through the Admin Dashboard.`);
      }
    } else {
      console.log(`Status: Stored in Supabase Bucket`);
      console.log(`Attempting to download and re-index...`);
      try {
        // 1. Download raw PDF file from private Storage bucket
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('educational-documents')
          .download(doc.file_url);

        if (downloadError || !fileData) {
          throw new Error(`Storage file download failed: ${downloadError?.message || 'Empty file'}`);
        }

        // 2. Parse PDF
        const arrayBuffer = await fileData.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);
        const pdf = await getDocumentProxy(buffer);
        const { text } = await extractText(pdf, { mergePages: true });
        
        const cleanedText = (text || '')
          .replace(/\r\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .replace(/[ \t]+/g, ' ')
          .trim();

        if (!cleanedText) {
          throw new Error('Extracted text is empty');
        }

        // 3. Chunk text (500 size, 50 overlap)
        const chunks: string[] = [];
        const size = 500;
        const overlap = 50;
        let start = 0;
        while (start < cleanedText.length) {
          const end = Math.min(start + size, cleanedText.length);
          chunks.push(cleanedText.substring(start, end));
          if (end === cleanedText.length) break;
          start += (size - overlap);
        }

        console.log(`PDF parsed: ${cleanedText.length} chars, split into ${chunks.length} chunks.`);

        // 4. Generate embeddings and upsert
        const vectors = [];
        for (let i = 0; i < chunks.length; i++) {
          const embedding = await getEmbedding(chunks[i]);
          vectors.push({
            id: `${doc.id}_${i}`,
            values: embedding,
            metadata: {
              document_id: doc.id,
              file_name: doc.file_name,
              chunk_number: i,
              text: chunks[i],
            }
          });
        }

        console.log(`HF Embeddings generated for all chunks. Upserting to Pinecone...`);
        await index.upsert({ records: vectors });
        console.log(`Re-indexing successful!`);
      } catch (err: any) {
        console.error(`Re-indexing failed:`, err.message || err);
      }
    }
  }
}

main();
