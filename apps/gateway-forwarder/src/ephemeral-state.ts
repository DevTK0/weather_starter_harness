import type { Lock, QueueEntry, StateAdapter } from "chat";

interface StoredValue {
  expiresAt?: number;
  value: unknown;
}

export function createEphemeralState(): StateAdapter {
  const values = new Map<string, StoredValue>();
  const lists = new Map<string, StoredValue[]>();
  const locks = new Map<string, Lock>();
  const queues = new Map<string, QueueEntry[]>();
  const subscriptions = new Set<string>();

  const getStoredValue = <T>(key: string): T | null => {
    const entry = values.get(key);
    if (!entry) {
      return null;
    }
    if (isExpired(entry)) {
      values.delete(key);
      return null;
    }
    return entry.value as T;
  };

  return {
    async acquireLock(threadId, ttlMs) {
      const existing = locks.get(threadId);
      if (existing && existing.expiresAt > Date.now()) {
        return null;
      }

      const lock = {
        expiresAt: Date.now() + ttlMs,
        threadId,
        token: crypto.randomUUID(),
      };
      locks.set(threadId, lock);
      return lock;
    },
    async appendToList(key, value, options) {
      const list = lists.get(key)?.filter((entry) => !isExpired(entry)) ?? [];
      list.push({
        expiresAt: options?.ttlMs ? Date.now() + options.ttlMs : undefined,
        value,
      });
      if (options?.maxLength && list.length > options.maxLength) {
        list.splice(0, list.length - options.maxLength);
      }
      lists.set(key, list);
    },
    async connect() {},
    async delete(key) {
      values.delete(key);
      lists.delete(key);
    },
    async dequeue(threadId) {
      return queues.get(threadId)?.shift() ?? null;
    },
    async disconnect() {},
    async enqueue(threadId, entry, maxSize) {
      const queue = queues.get(threadId) ?? [];
      queue.push(entry);
      if (queue.length > maxSize) {
        queue.splice(0, queue.length - maxSize);
      }
      queues.set(threadId, queue);
      return queue.length;
    },
    async extendLock(lock, ttlMs) {
      const existing = locks.get(lock.threadId);
      if (existing?.token !== lock.token) {
        return false;
      }
      existing.expiresAt = Date.now() + ttlMs;
      return true;
    },
    async forceReleaseLock(threadId) {
      locks.delete(threadId);
    },
    async get(key) {
      return getStoredValue(key);
    },
    async getList<T = unknown>(key: string) {
      return (lists.get(key)?.filter((entry) => !isExpired(entry)) ?? []).map(
        (entry) => entry.value as T,
      );
    },
    async isSubscribed(threadId) {
      return subscriptions.has(threadId);
    },
    async queueDepth(threadId) {
      return queues.get(threadId)?.length ?? 0;
    },
    async releaseLock(lock) {
      if (locks.get(lock.threadId)?.token === lock.token) {
        locks.delete(lock.threadId);
      }
    },
    async set(key, value, ttlMs) {
      values.set(key, {
        expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
        value,
      });
    },
    async setIfNotExists(key, value, ttlMs) {
      if (getStoredValue(key) !== null) {
        return false;
      }
      values.set(key, {
        expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
        value,
      });
      return true;
    },
    async subscribe(threadId) {
      subscriptions.add(threadId);
    },
    async unsubscribe(threadId) {
      subscriptions.delete(threadId);
    },
  };
}

function isExpired(entry: StoredValue): boolean {
  return entry.expiresAt !== undefined && entry.expiresAt <= Date.now();
}
