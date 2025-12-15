import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'burhan2ws-super-secret-jwt-key-2024'
);

const EXPIRY_DAYS = parseInt(process.env.SESSION_EXPIRY_DAYS || '30', 10);

export interface TokenPayload extends JWTPayload {
  userId: string;
  phone?: string;
  role: 'ADMIN' | 'USER' | 'SUBUSER';
  sessionId?: string;
}

export async function createToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): Promise<string> {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${EXPIRY_DAYS}d`)
    .sign(JWT_SECRET);

  return token;
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as TokenPayload;
  } catch {
    return null;
  }
}

export async function refreshToken(token: string): Promise<string | null> {
  const payload = await verifyToken(token);
  if (!payload) return null;

  const { iat, exp, ...rest } = payload;
  return createToken(rest as Omit<TokenPayload, 'iat' | 'exp'>);
}



