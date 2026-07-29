import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
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

    // 2. Fetch last 5 messages for conversational memory inside Doubt Solver
    const { data: dbHistory, error: historyErr } = await adminSupabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(6);

    const historyMessages = (dbHistory || [])
      .filter((m: any) => m.content !== message)
      .map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    // 3. Build system rules for dynamic educational explanations
    const systemPrompt = `You are EduAssist AI, a specialized academic Doubt Solver.
Your goal is to explain concepts, solve academic problems, and analyze code step-by-step to help students learn.

Follow these formatting instructions strictly based on the nature of the student's doubt:

1. For GENERAL ACADEMIC doubts:
Structure your response as:
- **📌 Simple Explanation**: Explain the concept in simple, easy-to-understand terms.
- **🔍 Step-by-Step Explanation**: Break down the concept into detailed sub-concepts or stages.
- **💡 Example**: Provide a practical, real-world example to illustrate the concept.
- **📝 Key Points**: List the most important takeaways as bullet points.
- **🎯 Quick Summary**: A brief, single-sentence summary of the explanation.

2. For MATHEMATICAL or quantitative problems:
Structure your response as:
- **Given**: List the known parameters or problem description.
- **Formula/Concept**: Present the mathematical formula, theorem, or core concept used.
- **Step-by-Step Solution**: Show the logical progression and calculation steps clearly.
- **Final Answer**: Clearly state the final numerical or simplified mathematical result.

3. For PROGRAMMING questions:
Structure your response as:
- **Explanation**: A high-level overview of the code or concept.
- **Code**: Provide a clean, syntax-highlighted code block.
- **Line-by-Line Explanation**: Explain what each key line of code accomplishes.
- **Example Output**: Show the output of the code execution.
- **Key Takeaways**: Best practices or tips related to the code.

Always adapt your format dynamically to the user's question. Do not refer to any college-specific documents. Use general academic knowledge only. Maintain conversation context using the history provided. Do not use fake citations or references.`;

    // 4. Connect to Groq LLM API
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not configured in environment variables.');
    }

    const groq = new Groq({ apiKey });
    
    // Stream response
    const chatCompletionStream = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        ...historyMessages,
        { role: 'user', content: message }
      ],
      model: 'llama-3.3-70b-versatile',
      stream: true,
      temperature: 0.2, // Slightly higher temperature for detailed explanations
    });

    let completeText = '';

    const responseStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of chatCompletionStream) {
            const text = chunk.choices[0]?.delta?.content || '';
            completeText += text;
            controller.enqueue(new TextEncoder().encode(text));
          }

          // 5. Save assistant message in messages table (with empty sources metadata)
          const { error: dbSaveErr } = await adminSupabase
            .from('messages')
            .insert({
              conversation_id: conversationId,
              role: 'assistant',
              content: completeText,
              metadata: {
                sources: [] // Doubt solver does not have document citations
              }
            });

          if (dbSaveErr) {
            console.error('Failed to log Doubt Solver response in database:', dbSaveErr);
          }

          // Update conversation timestamp
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
    console.error('Doubt Solver API crash:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
