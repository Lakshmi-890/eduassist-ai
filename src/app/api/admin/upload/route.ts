import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // 1. Verify user session
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Authorize admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. Parse file from form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Missing file upload' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Generate unique storage name to prevent naming collisions
    const fileExtension = file.name.split('.').pop() || 'pdf';
    const storageName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
    const filePath = `uploads/${storageName}`;

    // Verify / Auto-create storage bucket if admin key is configured
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const hasAdminKey = serviceKey && serviceKey !== 'placeholder-service-key';

    if (hasAdminKey) {
      try {
        const { data: bucketData, error: bucketError } = await adminSupabase.storage.getBucket('educational-documents');
        
        if (bucketError && (bucketError.message.includes('not found') || (bucketError as any).status === 404)) {
          console.log('Bucket "educational-documents" not found. Attempting to create it...');
          const { error: createError } = await adminSupabase.storage.createBucket('educational-documents', {
            public: false,
            fileSizeLimit: 20971520, // 20MB
            allowedMimeTypes: ['application/pdf'],
          });
          
          if (createError) {
            console.error('Failed to auto-create storage bucket:', createError);
          } else {
            console.log('Bucket "educational-documents" successfully created programmatically!');
          }
        }
      } catch (err) {
        console.warn('Bucket verification warning:', err);
      }
    }

    // Choose which client to upload with
    const uploadClient = hasAdminKey ? adminSupabase : supabase;

    // 4. Upload file to Supabase Private Bucket 'educational-documents'
    const { data: uploadData, error: uploadError } = await uploadClient.storage
      .from('educational-documents')
      .upload(filePath, buffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      let errorMsg = `Storage upload error: ${uploadError.message}.`;
      if (uploadError.message.includes('not found') || uploadError.message.includes('does not exist')) {
        errorMsg += ' Please log into your Supabase Dashboard, go to "Storage" in the left sidebar, and create a Private bucket named "educational-documents".';
      }
      if (!hasAdminKey) {
        errorMsg += ' Also, make sure you have added "SUPABASE_SERVICE_ROLE_KEY" to your ".env.local" file (found under Project Settings -> API in Supabase).';
      }
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }

    // 5. Insert row into documents table
    const { data: document, error: dbError } = await supabase
      .from('documents')
      .insert({
        file_name: file.name,
        file_url: filePath,
        file_type: file.type,
        uploaded_by: user.id,
        status: 'pending',
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database write error:', dbError);
      // Clean up uploaded file if DB log failed
      await uploadClient.storage.from('educational-documents').remove([filePath]);
      return NextResponse.json({ error: `Database registration error: ${dbError.message}` }, { status: 500 });
    }

    return NextResponse.json(document);
  } catch (err: any) {
    console.error('Upload route handler crash:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
