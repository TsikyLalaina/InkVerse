"use client";

import { useParams } from 'next/navigation';
import { Workspace } from '@/components/workspace/Workspace';

export default function ProjectChatPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id as string;
  if (!projectId) return null;
  return <Workspace projectId={projectId} />;
}

