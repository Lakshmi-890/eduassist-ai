# EduAssist AI - Contextual Educational Chatbot Using RAG

EduAssist AI is a full-stack educational web application that answers student questions regarding academic regulations, college FAQs, placement guidelines, and course details. 

Unlike standard conversational bots, it uses a **Retrieval-Augmented Generation (RAG)** pipeline to pull factual context from institutional PDF files uploaded by administrators, preventing hallucinations and citing its sources.

---

## 🚀 Key Features

* **Landing Page**: Explains the system, core benefits, and features, and maps out the RAG architecture visually.
* **Supabase Authentication**: Protects user-scoped chat paths and restricts access to the admin dashboard.
* **Genuine RAG Chatbot**: Converts user queries into vectors, queries the Supabase database for relevant text slices, and pipes matches to the Groq LLM.
* **Conversational Memory**: Resolves multi-turn references (e.g. "What about backlogs?" following placement eligibility questions) by maintaining sliding message histories.
* **Source Attribution Accordion**: Renders cited file titles, relevant text segments, and similarity percentages under AI bubbles.
* **Admin Dashboard**: Enables admins to upload institutional PDF documents, monitor processing status, manage FAQ quick-answers, and delete files.
* **Realtime Status Subscriptions**: Dynamically updates ingestion progress from pending to processing and completed on the admin page.

---

## 🛠️ Technology Stack

* **Frontend**: Next.js (App Router, Server Components, React 19, TypeScript)
* **Styling**: Tailwind CSS v4 (native CSS configuration)
* **Icons**: Lucide React
* **Database & Vectors**: Supabase PostgreSQL with `pgvector` enabled and HNSW indexing
* **Auth**: Supabase Authentication with Route Guards
* **Inference Model**: Groq API (`llama-3.3-70b-versatile` model)
* **PDF Processing**: `pdf-parse` for server-side text extraction

---

## 📐 System Architecture & RAG Pipeline

```
                     [ Administrator ]                   [ Student ]
                             │                                │
                       Uploads PDF                      Asks Question
                             │                                │
                     ┌───────▼───────┐                        ▼
                     │ Storage Bucket│               Generate Query Vector
                     └───────┬───────┘                        │
                             │                                ▼
                      Extract raw text              Vector Similarity Match
                             │                       (match_document_chunks)
                             ▼                                │
                        Clean Text                            ▼
                             │                        Retrieve Context &
                             ▼                       Conversation Memory
                       Overlapping Chunks                     │
                             │                                ▼
                             ▼                         Groq Llama-3.3
                    Generate Embeddings                    Synthesis
                             │                                │
                             ▼                                ▼
                    Store in pgvector Table           Stream Citations & Text
```

---

## 🗄️ Database Schema

The database relies on Supabase PostgreSQL. The full schema is stored locally in [schema.sql](file:///c:/Users/nclak/eduassist-ai/schema.sql).

### Table Definitions

* **`profiles`**: Holds user attributes (`id`, `full_name`, `email`, `role`, `created_at`). Role check permits `'student'` or `'admin'`.
* **`documents`**: Tracks raw PDF uploads (`id`, `file_name`, `file_url`, `file_type`, `uploaded_by`, `status`, `error_message`, `created_at`).
* **`document_chunks`**: Stores text slices and vectors (`id`, `document_id`, `content`, `embedding vector(1536)`, `metadata`, `created_at`).
* **`conversations`**: Stores active chat sessions (`id`, `user_id`, `title`, `created_at`, `updated_at`).
* **`messages`**: Logs user prompts and assistant replies (`id`, `conversation_id`, `role`, `content`, `metadata` containing RAG sources, `created_at`).
* **`faqs`**: Quick lookup questions and answers (`id`, `question`, `answer`, `created_at`, `updated_at`).

---

## ⚙️ Environment Variables

Create a `.env.local` file at the root of the project with the following configuration:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key-never-expose-to-client

# Groq API Configuration
GROQ_API_KEY=gsk_your-groq-api-key

# Embedding Configuration (supports OpenAI or Gemini endpoints)
EMBEDDING_API_KEY=your-openai-or-gemini-api-key
EMBEDDING_MODEL=text-embedding-3-small # text-embedding-3-small for OpenAI, or text-embedding-004 for Gemini
# EMBEDDING_BASE_URL=https://api.openai.com/v1 # Optional: defaults to standard OpenAI endpoint
```

---

## 💻 Local Development Setup

### 1. Clone & Install Dependencies
```bash
npm install
```

### 2. Configure Database
1. Open your Supabase Dashboard project.
2. Go to the **SQL Editor** tab.
3. Paste the contents of [schema.sql](file:///c:/Users/nclak/eduassist-ai/schema.sql) and run it to set up all tables, indexes, triggers, and similarity functions.
4. Go to **Storage** and create a **private** bucket named `educational-documents`.

### 3. Launch Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the landing page.

---

## 🚀 Production Deployment on Vercel

1. Push your code repository to GitHub.
2. Go to [Vercel](https://vercel.com/) and import the project repository.
3. Configure the **Environment Variables** in Vercel matching your `.env.local` contents.
4. Deploy the project!
