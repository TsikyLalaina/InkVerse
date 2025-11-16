import { redirect } from 'next/navigation';

export default function SettingsRedirect({ params }: { params: { id: string } }) {
  redirect(`/project/${params.id}/chat`);
}
