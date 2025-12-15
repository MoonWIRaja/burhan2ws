import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function getRedisUrl(): string {
  return process.env.REDIS_URL || 'redis://localhost:6379';
}

export const redis =
  globalForRedis.redis ??
  new Redis(getRedisUrl(), {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => {
      if (times > 3) {
        console.error('Redis connection failed after 3 retries');
        return null;
      }
      return Math.min(times * 200, 2000);
    },
  });

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('connect', () => {
  console.log('Redis connected successfully');
});

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

export default redis;

// Helper functions
export async function setCache(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const stringValue = JSON.stringify(value);
  if (ttlSeconds) {
    await redis.setex(key, ttlSeconds, stringValue);
  } else {
    await redis.set(key, stringValue);
  }
}

export async function getCache<T>(key: string): Promise<T | null> {
  const value = await redis.get(key);
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function deleteCache(key: string): Promise<void> {
  await redis.del(key);
}

export async function clearPattern(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}



