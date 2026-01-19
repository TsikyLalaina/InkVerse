"use client";

import { useParams } from 'next/navigation';
import { Workspace } from '@/components/workspace/Workspace';

export default function BranchWorkspacePage() {
  const params = useParams<{ id: string; branchId: string }>();
  const projectId = params?.id as string;
  const branchId = params?.branchId as string;
  
  if (!projectId || !branchId) return null;
  
  return <Workspace projectId={projectId} branchId={branchId} />;
}
