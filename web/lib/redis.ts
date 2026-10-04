import { Redis } from '@upstash/redis'

let redisInstance: Redis | null = null

export function getRedisClient(): Redis {
  if (redisInstance) return redisInstance

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PHASE) {
      throw new Error('Upstash Redis environment variables are missing.')
    }
    return new Redis({
      url: url || 'https://placeholder.upstash.io',
      token: token || 'placeholder',
    })
  }

  redisInstance = new Redis({ url, token })
  return redisInstance
}

export const redis = getRedisClient()
