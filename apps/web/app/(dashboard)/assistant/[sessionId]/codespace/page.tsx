import { redirect } from "next/navigation";

interface CodespacePageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function CodespacePage({ params }: CodespacePageProps) {
  const { sessionId } = await params;
  // Codespace functionality — redirect to chat for now
  redirect(`/assistant/${sessionId}`);
}
