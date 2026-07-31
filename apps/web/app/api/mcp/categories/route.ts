import { NextResponse } from 'next/server';
import { db, mcpPackages } from '@/lib/db';
import { eq, count } from 'drizzle-orm';

// Predefined categories with descriptions
const categoryDescriptions: Record<string, string> = {
  general: 'General purpose tools and utilities',
  productivity: 'Tools to boost your productivity',
  development: 'Developer tools and integrations',
  data: 'Data processing and analysis tools',
  ai: 'AI and machine learning integrations',
  communication: 'Communication and messaging tools',
  automation: 'Automation and workflow tools',
  security: 'Security and privacy tools',
  finance: 'Financial tools and integrations',
  media: 'Media processing and management',
  social: 'Social media integrations',
  education: 'Educational tools and resources',
  health: 'Health and wellness tools',
  gaming: 'Gaming integrations',
  other: 'Other tools and utilities',
};

/** @ignore */
// GET - List MCP package categories
export async function GET() {
  try {
    // Get unique categories with their package counts from the database
    const categoryCounts = await db
      .select({
        category: mcpPackages.category,
        packageCount: count(),
      })
      .from(mcpPackages)
      .where(eq(mcpPackages.isPublished, true))
      .groupBy(mcpPackages.category);

    // Build response with descriptions
    const categories = categoryCounts
      .filter((c): c is typeof c & { category: string } => Boolean(c.category)) // Filter out null categories with type guard
      .map((c) => ({
        id: c.category,
        name: c.category.charAt(0).toUpperCase() + c.category.slice(1),
        description: categoryDescriptions[c.category] || null,
        packageCount: c.packageCount,
      }))
      .sort((a, b) => (b.packageCount || 0) - (a.packageCount || 0));

    return NextResponse.json({
      data: categories,
    });
  } catch (error) {
    console.error('List MCP categories error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
