import { Queue } from 'bullmq'
import { bullConnection } from '../../utils/bull-connection'

// Job data is a union discriminated by job.name.
// userId is a Better Auth UUID string.
export type UserJob = {
  type: 'send-welcome-email'
  userId: string
  username: string
}

export const USER_QUEUE_NAME = 'user'

export const userQueue = new Queue<UserJob>(USER_QUEUE_NAME, {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 3600 }, // keep 1h then drop, don't grow Redis forever
    removeOnFail: { age: 86400 }, // keep failures 1 day for debugging
  },
})
