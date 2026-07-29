import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { searchSimilarChunks } from '@/lib/rag';
import Groq from 'groq-sdk';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // 1. Authenticate user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { message, conversationId } = await request.json();

    if (!message || !conversationId) {
      return NextResponse.json({ error: 'Missing message or conversationId parameters' }, { status: 400 });
    }

    // 2. Perform vector similarity search for retrieved chunks
    let searchResults: any[] = [];
    try {
      searchResults = await searchSimilarChunks(message, 0.35, 5);
    } catch (vectorErr) {
      console.error('Vector search failed, continuing with zero context:', vectorErr);
    }

    // 3. Compile context text
    const contextText = searchResults.length > 0
      ? searchResults.map((r, idx) => `[Source: ${r.metadata.file_name}]\n${r.content}`).join('\n\n---\n\n')
      : 'No relevant educational documents found.';

    // 4. Fetch last 5 messages for conversational memory
    const { data: dbHistory, error: historyErr } = await adminSupabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(6); // Retrieves last 6 messages (3 user / 3 AI exchanges)

    // Formulate history array for Groq (excluding the very last user message if it's already saved)
    // To prevent duplicate user queries in model context
    const historyMessages = (dbHistory || [])
      .filter((m: any) => m.content !== message)
      .map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    // 5. Build system rules for hybrid routing, classification, and hallucination prevention
    const systemPrompt = `You are EduAssist AI, a helpful, precise educational chatbot.
Your task is to classify the user's query into one of three categories and respond strictly following these rules:

========================================
CATEGORY 1: COLLEGE-SPECIFIC QUESTION
========================================
This category is for questions about college rules, regulations, attendance, exam procedures, placements, recommended certifications, scholarships, etc.
Instructions:
1. Examine the "Retrieved Context" section below.
2. If the context contains sufficient, factual information to answer the question, you must:
   - Start your response with exactly: **📚 Knowledge Base Answer**\n\n
   - Answer the question accurately using ONLY the retrieved facts from the context. Do not assume or guess.
   - Keep the answer concise, professional, and well-structured.
3. If the context DOES NOT contain the answer, you must classify the query as CATEGORY 3.

========================================
CATEGORY 2: GENERAL ACADEMIC QUESTION
========================================
This category is for general educational, academic, technical, or career preparation questions that are NOT specific to this college (e.g., "What is machine learning?", "Explain artificial intelligence", "How does a database work?", "Explain supervised learning", "How can I prepare for an interview?", "What is Python?").
Instructions:
1. Start your response with exactly: **💡 General Academic Answer**\n\n
2. Answer the question using your general pre-trained knowledge.
3. Do NOT refer to retrieved context or mention educational resources. Keep it strictly educational and generic.

========================================
CATEGORY 3: UNKNOWN COLLEGE-SPECIFIC INFORMATION
========================================
This category is for college-specific or time-sensitive questions (e.g., current principal, fees, today's timetable, circulars) that are NOT answered in the retrieved context.
Instructions:
1. Start your response with exactly: **⚠️ Verified Information Not Available**\n\n
2. Respond with: "I don't have verified information about this in the EduAssist AI knowledge base. Please check the official college portal, college administration, or the latest official notification."
   (Exceptions: If asked about schedules, timetables, circulars, or live data, state clearly: "I don't have access to the current college timetable." or "I don't have access to live college circulars.")
3. Do NOT make up or assume any college-specific facts.

----------------------------------------
Retrieved Context:
${contextText}
----------------------------------------

Always output the appropriate prefix as the first characters of your response. Use the provided conversation history to understand follow-up references.`;

    // 6. Connect to Groq LLM API
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not configured in environment variables.');
    }

    const groq = new Groq({ apiKey });
    
    // We stream the completions for real-time responsiveness
    const chatCompletionStream = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        ...historyMessages,
        { role: 'user', content: message }
      ],
      model: 'llama-3.3-70b-versatile',
      stream: true,
      temperature: 0.1, // Low temperature for high factual recall
    });

    let completeText = '';

    // Create a stream that emits chunks to the client and saves to DB on completion
    const responseStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of chatCompletionStream) {
            const text = chunk.choices[0]?.delta?.content || '';
            completeText += text;
            controller.enqueue(new TextEncoder().encode(text));
          }

          const isKbAnswer = completeText.startsWith('**📚 Knowledge Base Answer**');
          const finalSources = isKbAnswer 
            ? searchResults.map(r => ({
                document_id: r.document_id,
                file_name: r.metadata.file_name,
                content: r.content,
                similarity: r.similarity
              }))
            : [];

          // 7. Stream closed: Save assistant message + citations in Supabase messages table
          const { error: dbSaveErr } = await adminSupabase
            .from('messages')
            .insert({
              conversation_id: conversationId,
              role: 'assistant',
              content: completeText,
              metadata: {
                sources: finalSources
              }
            });

          if (dbSaveErr) {
            console.error('Failed to log AI response in database:', dbSaveErr);
          }

          // Update conversation timestamp for updated_at sorting in sidebar
          await adminSupabase
            .from('conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId);

          controller.close();
        } catch (streamErr) {
          console.error('Stream processing error:', streamErr);
          controller.error(streamErr);
        }
      }
    });

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (err: any) {
    console.error('Chat API Route Handler Crash:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
