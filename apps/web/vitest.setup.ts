import '@testing-library/jest-dom/vitest';
import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

// Mock environment variables
// JWE_SECRET must be exactly 32 bytes for A256GCM encryption
process.env.JWE_SECRET = '12345678901234567890123456789012';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.GITHUB_CLIENT_ID = 'test-github-client-id';
process.env.GITHUB_CLIENT_SECRET = 'test-github-client-secret';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
