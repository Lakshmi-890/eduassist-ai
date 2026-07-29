-- Enable the pgvector extension to support vector embeddings
create extension if not exists vector;

-- 1. Profiles Table (linked to auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  email text not null,
  role text default 'student' check (role in ('student', 'admin')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.profiles enable row level security;

-- Create Profile RLS Policies
create policy "Allow public read-only access to profiles"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Allow users to update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 2. Documents Table
create table if not exists public.documents (
  id uuid default gen_random_uuid() primary key,
  file_name text not null,
  file_url text not null,
  file_type text not null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  status text default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  error_message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.documents enable row level security;

-- Create Documents RLS Policies
create policy "Allow authenticated users to read documents"
  on public.documents for select
  to authenticated
  using (true);

create policy "Allow admins full access to documents"
  on public.documents for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- 3. Document Chunks Table
create table if not exists public.document_chunks (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references public.documents(id) on delete cascade not null,
  content text not null,
  embedding vector(1536), -- 1536 dimensions for OpenAI embeddings (text-embedding-3-small)
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.document_chunks enable row level security;

-- Create Document Chunks RLS Policies
create policy "Allow authenticated users to read document chunks"
  on public.document_chunks for select
  to authenticated
  using (true);

create policy "Allow admins full access to document chunks"
  on public.document_chunks for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- 4. Conversations Table
create table if not exists public.conversations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.conversations enable row level security;

-- Create Conversations RLS Policies
create policy "Allow users to read their own conversations"
  on public.conversations for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Allow users to insert their own conversations"
  on public.conversations for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Allow users to update their own conversations"
  on public.conversations for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Allow users to delete their own conversations"
  on public.conversations for delete
  to authenticated
  using (auth.uid() = user_id);

-- 5. Messages Table
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb default '{}'::jsonb not null, -- Holds source references
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.messages enable row level security;

-- Create Messages RLS Policies
create policy "Allow users to read messages from their conversations"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id and conversations.user_id = auth.uid()
    )
  );

create policy "Allow users to insert messages in their conversations"
  on public.messages for insert
  to authenticated
  with check (
    exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id and conversations.user_id = auth.uid()
    )
  );

-- 6. FAQs Table
create table if not exists public.faqs (
  id uuid default gen_random_uuid() primary key,
  question text not null,
  answer text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.faqs enable row level security;

-- Create FAQs RLS Policies
create policy "Allow public read access to FAQs"
  on public.faqs for select
  to authenticated
  using (true);

create policy "Allow admins full access to FAQs"
  on public.faqs for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Create HNSW Index for Cosine Distance Search
create index if not exists document_chunks_embedding_idx 
  on public.document_chunks using hnsw (embedding vector_cosine_ops);

-- Create B-Tree Indexes for Foreign Keys and Query Performance
create index if not exists idx_chunks_doc_id on public.document_chunks(document_id);
create index if not exists idx_messages_conv_id on public.messages(conversation_id);
create index if not exists idx_conversations_user_id on public.conversations(user_id);
create index if not exists idx_documents_uploaded_by on public.documents(uploaded_by);

-- 7. Trigger Function to create profile when auth.users is populated
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'New User'),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'student')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Create trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 8. Vector Search Match Function
create or replace function public.match_document_chunks (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql stable
as $$
begin
  return query
  select
    dc.id,
    dc.document_id,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  where 1 - (dc.embedding <=> query_embedding) > match_threshold
  order by dc.embedding <=> query_embedding
  limit match_count;
end;
$$;
