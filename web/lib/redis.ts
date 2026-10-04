import { Redis } from '@upstash/redis'

let redisInstance: Redis | null = null

export function getRedisClient(): Redis {
  if (redisInstance) return redisInstance

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    console.warn('[Redis] Warning: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is not defined in environment.')
    return new Redis({
      url: url || 'https://placeholder.upstash.io',
      token: token || 'placeholder',
    })
  }

  redisInstance = new Redis({ url, token })
  return redisInstance
}

export const redis = getRedisClient()
