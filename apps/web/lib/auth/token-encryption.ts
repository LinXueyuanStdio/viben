import { EncryptJWT, jwtDecrypt, base64url } from 'jose';

const alg = 'dir';
const enc = 'A256GCM';

/**
 * Get the encryption secret from environment.
 * Uses JWE_SECRET for consistency with session encryption.
 */
async function getSecret(): Promise<Uint8Array> {
  const jweSecret = process.env.JWE_SECRET;
  if (!jweSecret) {
    throw new Error('JWE_SECRET environment variable is not set');
  }

  // If it's a base64url encoded secret, decode it
  try {
    const decoded = base64url.decode(jweSecret);
    if (decoded.length === 32) {
      return decoded;
    }
  } catch {
    // Not base64url, continue with text encoding
  }

  // Ensure the secret is exactly 32 bytes for A256GCM
  const encoder = new TextEncoder();
  const encoded = encoder.encode(jweSecret);
  if (encoded.length < 32) {
    // Pad with zeros if too short
    const padded = new Uint8Array(32);
    padded.set(encoded);
    return padded;
  }
  return encoded.slice(0, 32);
}

/**
 * Encrypt an access token for secure storage.
 */
export async function encryptToken(token: string): Promise<string> {
  const secret = await getSecret();

  const jwt = await new EncryptJWT({ token })
    .setProtectedHeader({ alg, enc })
    .setIssuedAt()
    .encrypt(secret);

  return jwt;
}

/**
 * Decrypt an encrypted access token.
 */
export async function decryptToken(encryptedToken: string): Promise<string | null> {
  try {
    const secret = await getSecret();
    const { payload } = await jwtDecrypt(encryptedToken, secret);
    return (payload as { token: string }).token;
  } catch {
    return null;
  }
}
