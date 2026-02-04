import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

const connectionString = process.env.POSTGRES_URL!;

// Create Neon HTTP client for serverless
const sql = neon(connectionString);

// Create drizzle instance
export const db = drizzle(sql, { schema });

// Re-export schema and types
export * from './schema';
export * from './types';
