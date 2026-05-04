import { redirect } from 'next/navigation';

interface SettingsPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { orgSlug } = await params;
  redirect(`/app/${orgSlug}/settings/general`);
}
