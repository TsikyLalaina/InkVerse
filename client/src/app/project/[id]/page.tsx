import { redirect } from 'next/navigation';

export default function ProjectIndexRedirect({ params }: { params: { id: string } }) {
  redirect(`/project/${params.id}/chat`);
}
