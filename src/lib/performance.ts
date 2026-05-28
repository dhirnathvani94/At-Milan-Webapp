// ──────────────────────────────────────────────
// Performance Infrastructure
// - LRU Cache for API responses
// - Response time tracking
// - Health metrics
// ──────────────────────────────────────────────

// Simple LRU Cache
class LRUNode<T> {
  key: string;
  value: T;
  ttl: number;
  prev: LRUNode<T> | null = null;
  next: LRUNode<T> | null = null;

  constructor(key: string, value: T, ttlMs: number) {
    this.key = key;
    this.value = value;
    this.ttl = Date.now() + ttlMs;
  }
}

export class LRUCache<T> {
  private capacity: number;
  private defaultTtl: number;
  private map: Map<string, LRUNode<T>>;
  private head: LRUNode<T> | null = null;
  private tail: LRUNode<T> | null = null;
  hits = 0;
  misses = 0;

  constructor(capacity: number = 500, defaultTtlMs: number = 60000) {
    this.capacity = capacity;
    this.defaultTtl = defaultTtlMs;
    this.map = new Map();
  }

  get(key: string): T | undefined {
    const node = this.map.get(key);
    if (!node) {
      this.misses++;
      return undefined;
    }
    if (Date.now() > node.ttl) {
      this.removeNode(node);
      this.map.delete(key);
      this.misses++;
      return undefined;
    }
    this.hits++;
    // Move to front (most recently used)
    this.removeNode(node);
    this.addToFront(node);
    return node.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    const existing = this.map.get(key);
    if (existing) {
      this.removeNode(existing);
      this.map.delete(key);
    }
    if (this.map.size >= this.capacity) {
      // Evict least recently used (tail)
      if (this.tail) {
        this.map.delete(this.tail.key);
        this.removeNode(this.tail);
      }
    }
    const node = new LRUNode(key, value, ttlMs ?? this.defaultTtl);
    this.map.set(key, node);
    this.addToFront(node);
  }

  invalidate(key: string): void {
    const node = this.map.get(key);
    if (node) {
      this.removeNode(node);
      this.map.delete(key);
    }
  }

  invalidatePattern(pattern: string): void {
    for (const key of this.map.keys()) {
      if (key.includes(pattern)) {
        this.invalidate(key);
      }
    }
  }

  clear(): void {
    this.map.clear();
    this.head = null;
    this.tail = null;
  }

  size(): number {
    return this.map.size;
  }

  stats() {
    const total = this.hits + this.misses;
    return {
      size: this.map.size,
      capacity: this.capacity,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? ((this.hits / total) * 100).toFixed(1) + '%' : '0%',
    };
  }

  private removeNode(node: LRUNode<T>): void {
    if (node.prev) node.prev.next = node.next;
    else this.head = node.next;
    if (node.next) node.next.prev = node.prev;
    else this.tail = node.prev;
  }

  private addToFront(node: LRUNode<T>): void {
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }
}

// ──────────────────────────────────────────────
// API Response Cache Instances
// ──────────────────────────────────────────────

// Search results cache - 30s TTL (fast repeat searches)
export const searchCache = new LRUCache<any>(200, 30000);

// Master data cache - 5 min TTL (rarely changes)
export const masterDataCache = new LRUCache<any>(100, 300000);

// Profile cache - 60s TTL
export const profileCache = new LRUCache<any>(300, 60000);

// Recommendations cache - 2 min TTL
export const recommendationsCache = new LRUCache<any>(100, 120000);

// ──────────────────────────────────────────────
// Response Time Tracker
// ──────────────────────────────────────────────

interface TimingEntry {
  endpoint: string;
  duration: number;
  timestamp: number;
  cached: boolean;
}

const timings: TimingEntry[] = [];
const MAX_TIMINGS = 1000;

export function recordTiming(endpoint: string, duration: number, cached: boolean = false): void {
  timings.push({ endpoint, duration, timestamp: Date.now(), cached });
  if (timings.length > MAX_TIMINGS) timings.shift();
}

export function getTimingStats(): any {
  const recent = timings.filter(t => Date.now() - t.timestamp < 300000); // Last 5 min
  if (recent.length === 0) return { total: 0, avgMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, cacheHitRate: '0%' };

  const durations = recent.map(t => t.duration).sort((a, b) => a - b);
  const cached = recent.filter(t => t.cached).length;

  return {
    total: recent.length,
    avgMs: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
    p50Ms: durations[Math.floor(durations.length * 0.5)],
    p95Ms: durations[Math.floor(durations.length * 0.95)],
    p99Ms: durations[Math.floor(durations.length * 0.99)],
    cacheHitRate: ((cached / recent.length) * 100).toFixed(1) + '%',
  };
}

// ──────────────────────────────────────────────
// Health / Uptime Metrics
// ──────────────────────────────────────────────

const startTime = Date.now();
let totalRequests = 0;
let errorRequests = 0;

export function incrementRequests(isError: boolean = false): void {
  totalRequests++;
  if (isError) errorRequests++;
}

export function getHealthMetrics(): any {
  const uptime = Date.now() - startTime;
  const uptimeSeconds = Math.floor(uptime / 1000);
  const uptimeDays = Math.floor(uptimeSeconds / 86400);
  const uptimeHours = Math.floor((uptimeSeconds % 86400) / 3600);
  const uptimeMins = Math.floor((uptimeSeconds % 3600) / 60);

  return {
    status: 'ok',
    uptime: `${uptimeDays}d ${uptimeHours}h ${uptimeMins}m`,
    uptimeMs: uptime,
    totalRequests,
    errorRequests,
    errorRate: totalRequests > 0 ? ((errorRequests / totalRequests) * 100).toFixed(2) + '%' : '0%',
    timingStats: getTimingStats(),
    caches: {
      search: searchCache.stats(),
      masterData: masterDataCache.stats(),
      profile: profileCache.stats(),
      recommendations: recommendationsCache.stats(),
    },
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
      external: Math.round(process.memoryUsage().external / 1024 / 1024) + 'MB',
    },
  };
}
