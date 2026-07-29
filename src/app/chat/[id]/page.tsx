import React from 'react';
import ActiveChat from '@/components/chat/ActiveChat';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ConversationPage({ params }: PageProps) {
  const { id } = await params;
  return <ActiveChat id={id} />;
}
