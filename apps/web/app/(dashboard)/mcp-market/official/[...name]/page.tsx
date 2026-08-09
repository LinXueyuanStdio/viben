import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { makeOG, makeTwitter, APP_URL } from "@/lib/metadata";
import { fetchOfficialServer } from '@/lib/services/official-registry';
import { OfficialServerHeader } from '@/components/mcp/official-server-header';
import { OfficialServerSidebar } from '@/components/mcp/official-server-sidebar';

interface OfficialServerDetailPageProps {
  params: Promise<{ name: string[] }>;
  searchParams: Promise<{ version?: string }>;
}

export async function generateMetadata({
  params,
}: OfficialServerDetailPageProps): Promise<Metadata> {
  const { name } = await params;
  const decodedName = name.map(decodeURIComponent).join('/');
  const server = await fetchOfficialServer(decodedName);

  if (!server) {
    return {
      title: 'Server Not Found',
    };
  }

  return {
    title: `${server.name} - MCP Marketplace`,
    description: server.description || undefined,
    alternates: {
      canonical: `${APP_URL}/mcp-market/official/${name.map(encodeURIComponent).join("/")}`,
    },
    openGraph: makeOG({
      title: `${server.name} - MCP Marketplace`,
      description: server.description || undefined,
      url: `${APP_URL}/mcp-market/official/${name.map(encodeURIComponent).join("/")}`,
      type: "website",
    }),
    twitter: makeTwitter({
      title: `${server.name} - MCP Marketplace`,
      description: server.description || undefined,
    }),
  };
}

export default async function OfficialServerDetailPage({
  params,
  searchParams,
}: OfficialServerDetailPageProps) {
  const { name } = await params;
  const { version } = await searchParams;
  const decodedName = name.map(decodeURIComponent).join('/');

  const server = await fetchOfficialServer(decodedName, version);

  if (!server) {
    notFound();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-6">
        <OfficialServerHeader server={server} />
      </div>
      <OfficialServerSidebar server={server} />
    </div>
  );
}
