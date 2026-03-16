import { Redis } from "@upstash/redis";

// Singleton Redis client
// Reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from process.env
// Returns null if env vars are not configured (graceful degradation)

let redis = null;

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

if (url && token) {
  redis = new Redis({ url, token });
} else {
  console.warn("[redis] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set. Draft features disabled.");
}

export { redis };
