import { redirect } from 'next/navigation';

export default function ReadRedirect({ params }: { params: { id: string } }) {
  redirect(`/project/${params.id}/chat`);
}
