/**
 * Simple in-memory cache with TTL support
 */

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private defaultTTL: number;

  constructor(defaultTTLMs: number = 5 * 60 * 1000) {
    // Default: 5 minutes
    this.defaultTTL = defaultTTLMs;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTTL;
    const expiresAt = Date.now() + ttl;

    this.cache.set(key, {
      value,
      expiresAt,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Clean up expired entries (call periodically)
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  size(): number {
    return this.cache.size;
  }
}

// Create a singleton cache instance for mood questions
// TTL: 10 minutes (questions can be reused for a while)
export const moodQuestionsCache = new SimpleCache<{
  questions: unknown[];
  followUp?: string;
  debugNotes?: string[];
}>(10 * 60 * 1000);

// Cleanup expired entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    moodQuestionsCache.cleanup();
  }, 5 * 60 * 1000);
}

