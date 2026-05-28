// ──────────────────────────────────────────────
// Scalability Infrastructure
// Horizontal Scaling, Auto-Scaling, CDN, Read Replicas
// ──────────────────────────────────────────────

import cluster from 'cluster';
import os from 'os';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ──────────────────────────────────────────────
// 1. Horizontal Scaling - Cluster Mode
// ──────────────────────────────────────────────

const NUM_CPUS = os.cpus().length;
const CLUSTER_ENABLED = process.env.CLUSTER_MODE === 'true';
const MAX_WORKERS = parseInt(process.env.MAX_WORKERS || String(NUM_CPUS));
const MIN_WORKERS = parseInt(process.env.MIN_WORKERS || '2');

export interface ClusterConfig {
  enabled: boolean;
  numWorkers: number;
  minWorkers: number;
  maxWorkers: number;
  restartOnCrash: boolean;
  maxRestarts: number;
  restartWindow: number; // ms
}

const defaultClusterConfig: ClusterConfig = {
  enabled: CLUSTER_ENABLED,
  numWorkers: Math.min(MAX_WORKERS, NUM_CPUS),
  minWorkers: MIN_WORKERS,
  maxWorkers: MAX_WORKERS,
  restartOnCrash: true,
  maxRestarts: 10,
  restartWindow: 60000, // 1 minute
};

let restartCount = 0;
let restartWindowStart = Date.now();

export function startCluster(startFn: () => Promise<void>, config: Partial<ClusterConfig> = {}): void {
  const cfg = { ...defaultClusterConfig, ...config };

  if (!cfg.enabled || !cluster.isPrimary) {
    // Single instance mode or worker process
    startFn();
    return;
  }

  console.log(`[Cluster] Primary process ${process.pid} starting ${cfg.numWorkers} workers`);

  // Fork workers
  for (let i = 0; i < cfg.numWorkers; i++) {
    forkWorker(cfg);
  }

  // Handle worker exit
  cluster.on('exit', (worker, code, signal) => {
    const exitReason = code !== 0 ? `exit code ${code}` : `signal ${signal}`;
    console.log(`[Cluster] Worker ${worker.process.pid} died (${exitReason})`);

    if (cfg.restartOnCrash) {
      // Rate-limit restarts to prevent crash loops
      const now = Date.now();
      if (now - restartWindowStart > cfg.restartWindow) {
        restartCount = 0;
        restartWindowStart = now;
      }

      restartCount++;
      if (restartCount <= cfg.maxRestarts) {
        console.log(`[Cluster] Restarting worker (restart ${restartCount}/${cfg.maxRestarts})`);
        forkWorker(cfg);
      } else {
        console.error(`[Cluster] Max restarts (${cfg.maxRestarts}) reached in window. Not restarting.`);
      }
    }
  });

  // IPC: workers report load to primary
  cluster.on('message', (worker, msg) => {
    if (msg && msg.type === 'load_report') {
      autoScaler.recordWorkerLoad(worker.id, msg.load);
    }
  });
}

function forkWorker(cfg: ClusterConfig) {
  const worker = cluster.fork();
  console.log(`[Cluster] Worker ${worker.process.pid} started`);
}

// ──────────────────────────────────────────────
// 2. Auto-Scaling Based on Load
// ──────────────────────────────────────────────

export interface LoadMetrics {
  cpuUsage: number;       // 0-100%
  memoryUsage: number;    // 0-100%
  requestRate: number;    // requests per second
  avgResponseTime: number; // ms
  errorRate: number;      // 0-100%
  activeConnections: number;
  timestamp: number;
}

export interface ScalingPolicy {
  scaleUpThreshold: number;    // CPU% to trigger scale up
  scaleDownThreshold: number;  // CPU% to trigger scale down
  cooldownPeriod: number;      // ms between scaling actions
  minInstances: number;
  maxInstances: number;
  targetCpu: number;           // target CPU utilization
  targetResponseTime: number;  // target avg response time in ms
}

const defaultPolicy: ScalingPolicy = {
  scaleUpThreshold: 70,
  scaleDownThreshold: 30,
  cooldownPeriod: 60000, // 1 minute
  minInstances: MIN_WORKERS,
  maxInstances: MAX_WORKERS,
  targetCpu: 50,
  targetResponseTime: 500,
};

class AutoScaler {
  private workerLoads: Map<number, LoadMetrics> = new Map();
  private lastScaleAction: number = 0;
  private policy: ScalingPolicy;
  private scalingHistory: Array<{ action: string; reason: string; timestamp: number; instances: number }> = [];

  constructor(policy: Partial<ScalingPolicy> = {}) {
    this.policy = { ...defaultPolicy, ...policy };
  }

  recordWorkerLoad(workerId: number, load: Partial<LoadMetrics>): void {
    this.workerLoads.set(workerId, {
      cpuUsage: load.cpuUsage || 0,
      memoryUsage: load.memoryUsage || 0,
      requestRate: load.requestRate || 0,
      avgResponseTime: load.avgResponseTime || 0,
      errorRate: load.errorRate || 0,
      activeConnections: load.activeConnections || 0,
      timestamp: Date.now(),
    });
  }

  getAggregateLoad(): LoadMetrics {
    const loads = Array.from(this.workerLoads.values());
    if (loads.length === 0) {
      return { cpuUsage: 0, memoryUsage: 0, requestRate: 0, avgResponseTime: 0, errorRate: 0, activeConnections: 0, timestamp: Date.now() };
    }

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    return {
      cpuUsage: avg(loads.map(l => l.cpuUsage)),
      memoryUsage: avg(loads.map(l => l.memoryUsage)),
      requestRate: loads.reduce((a, l) => a + l.requestRate, 0),
      avgResponseTime: avg(loads.map(l => l.avgResponseTime)),
      errorRate: avg(loads.map(l => l.errorRate)),
      activeConnections: loads.reduce((a, l) => a + l.activeConnections, 0),
      timestamp: Date.now(),
    };
  }

  getScalingDecision(): { action: 'scale_up' | 'scale_down' | 'none'; reason: string; targetInstances: number } {
    const load = this.getAggregateLoad();
    const currentWorkers = cluster.isPrimary ? Object.keys(cluster.workers || {}).length : 1;
    const now = Date.now();

    // Check cooldown
    if (now - this.lastScaleAction < this.policy.cooldownPeriod) {
      return { action: 'none', reason: 'Cooldown period active', targetInstances: currentWorkers };
    }

    // Scale up conditions
    if (
      (load.cpuUsage > this.policy.scaleUpThreshold ||
        load.avgResponseTime > this.policy.targetResponseTime * 2 ||
        load.errorRate > 10) &&
      currentWorkers < this.policy.maxInstances
    ) {
      const target = Math.min(currentWorkers + 1, this.policy.maxInstances);
      this.lastScaleAction = now;
      this.scalingHistory.push({ action: 'scale_up', reason: `CPU:${load.cpuUsage.toFixed(1)}% RT:${load.avgResponseTime.toFixed(0)}ms Err:${load.errorRate.toFixed(1)}%`, timestamp: now, instances: target });
      return { action: 'scale_up', reason: `High load: CPU ${load.cpuUsage.toFixed(1)}%, RT ${load.avgResponseTime.toFixed(0)}ms`, targetInstances: target };
    }

    // Scale down conditions
    if (
      load.cpuUsage < this.policy.scaleDownThreshold &&
      load.avgResponseTime < this.policy.targetResponseTime &&
      load.errorRate < 1 &&
      currentWorkers > this.policy.minInstances
    ) {
      const target = Math.max(currentWorkers - 1, this.policy.minInstances);
      this.lastScaleAction = now;
      this.scalingHistory.push({ action: 'scale_down', reason: `Low load: CPU ${load.cpuUsage.toFixed(1)}%`, timestamp: now, instances: target });
      return { action: 'scale_down', reason: `Low load: CPU ${load.cpuUsage.toFixed(1)}%`, targetInstances: target };
    }

    return { action: 'none', reason: 'Load within acceptable range', targetInstances: currentWorkers };
  }

  getScalingHistory() {
    return this.scalingHistory.slice(-20);
  }

  getStatus() {
    const load = this.getAggregateLoad();
    const decision = this.getScalingDecision();
    return {
      currentLoad: load,
      policy: this.policy,
      decision,
      workerCount: this.workerLoads.size,
      history: this.scalingHistory.slice(-10),
    };
  }
}

export const autoScaler = new AutoScaler();

// Collect load metrics from the current process
export function collectLoadMetrics(): LoadMetrics {
  const memUsage = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const loadAvg = os.loadavg();

  return {
    cpuUsage: Math.min(100, (loadAvg[0] / NUM_CPUS) * 100),
    memoryUsage: ((totalMem - freeMem) / totalMem) * 100,
    requestRate: 0, // Updated by request tracking middleware
    avgResponseTime: 0, // Updated by response timing middleware
    errorRate: 0, // Updated by error tracking
    activeConnections: 0, // Updated by connection tracking
    timestamp: Date.now(),
  };
}

// ──────────────────────────────────────────────
// 3. CDN for Static Assets
// ──────────────────────────────────────────────

export interface CDNConfig {
  enabled: boolean;
  baseUrl: string;           // CDN URL prefix e.g. https://cdn.example.com
  assetVersion: string;      // Cache-busting version string
  maxAge: number;            // Cache-Control max-age in seconds
  staleWhileRevalidate: number; // SWR time in seconds
  immutableAssets: string[]; // Path patterns for immutable assets (hashed filenames)
}

const defaultCDNConfig: CDNConfig = {
  enabled: !!process.env.CDN_BASE_URL,
  baseUrl: process.env.CDN_BASE_URL || '',
  assetVersion: process.env.ASSET_VERSION || crypto.randomBytes(4).toString('hex'),
  maxAge: 31536000,         // 1 year for immutable assets
  staleWhileRevalidate: 86400, // 1 day SWR
  immutableAssets: [
    '/assets/*.js',
    '/assets/*.css',
    '/assets/*.woff2',
    '/assets/*.woff',
    '/assets/*.png',
    '/assets/*.jpg',
    '/assets/*.svg',
    '/assets/*.ico',
  ],
};

let cdnConfig: CDNConfig = { ...defaultCDNConfig };

export function configureCDN(config: Partial<CDNConfig>): void {
  cdnConfig = { ...cdnConfig, ...config };
}

export function getCDNConfig(): CDNConfig {
  return { ...cdnConfig };
}

// Get CDN URL for an asset
export function getAssetURL(assetPath: string): string {
  if (!cdnConfig.enabled || !cdnConfig.baseUrl) return assetPath;

  // Add version query param for cache busting if not already hashed
  const separator = assetPath.includes('?') ? '&' : '?';
  const versionedPath = assetPath.includes('v=') ? assetPath : `${assetPath}${separator}v=${cdnConfig.assetVersion}`;

  return `${cdnConfig.baseUrl}${versionedPath}`;
}

// Generate Cache-Control header value based on asset type
export function getCacheControlHeader(assetPath: string): string {
  const isImmutable = cdnConfig.immutableAssets.some(pattern => {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(assetPath);
  });

  if (isImmutable) {
    return `public, max-age=${cdnConfig.maxAge}, immutable`;
  }

  // HTML and API responses - short cache with SWR
  if (assetPath.endsWith('.html') || assetPath.startsWith('/api/')) {
    return `no-cache, stale-while-revalidate=${cdnConfig.staleWhileRevalidate}`;
  }

  // Other assets - moderate cache
  return `public, max-age=3600, stale-while-revalidate=${cdnConfig.staleWhileRevalidate}`;
}

// CDN middleware for Express
export function cdnMiddleware() {
  return (req: any, res: any, next: any) => {
    // Set CDN-related headers
    const assetPath = req.path;

    // Cache-Control
    res.setHeader('Cache-Control', getCacheControlHeader(assetPath));

    // ETag support
    res.setHeader('ETag', 'weak');

    // Vary header for proper caching
    if (assetPath.startsWith('/api/')) {
      res.setHeader('Vary', 'Accept-Encoding, Authorization');
    }

    // CDN purge token header (for CDN cache invalidation)
    if (cdnConfig.enabled) {
      res.setHeader('X-CDN-Token', cdnConfig.assetVersion);
    }

    next();
  };
}

// ──────────────────────────────────────────────
// 4. Database Read Replicas
// ──────────────────────────────────────────────

export interface ReplicaConfig {
  primaryPath: string;
  replicas: string[];       // Paths to replica DB files
  readPreference: 'primary' | 'primaryPreferred' | 'secondary' | 'secondaryPreferred';
  replicationLagThreshold: number; // ms - max acceptable lag
  healthCheckInterval: number;    // ms
  autoFailover: boolean;
}

const defaultReplicaConfig: ReplicaConfig = {
  primaryPath: './database.json',
  replicas: (process.env.DB_REPLICAS || '').split(',').filter(Boolean),
  readPreference: 'secondaryPreferred',
  replicationLagThreshold: 5000,
  healthCheckInterval: 10000,
  autoFailover: true,
};

interface ReplicaHealth {
  path: string;
  healthy: boolean;
  lastSync: number;
  lag: number; // ms behind primary
  role: 'primary' | 'replica';
}

class ReadReplicaManager {
  private config: ReplicaConfig;
  private replicaHealth: Map<string, ReplicaHealth> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;
  private healthInterval: NodeJS.Timeout | null = null;
  private roundRobinIndex: number = 0;

  constructor(config: Partial<ReplicaConfig> = {}) {
    this.config = { ...defaultReplicaConfig, ...config };
    this.initHealthTracking();
  }

  private initHealthTracking() {
    // Track primary
    this.replicaHealth.set(this.config.primaryPath, {
      path: this.config.primaryPath,
      healthy: true,
      lastSync: Date.now(),
      lag: 0,
      role: 'primary',
    });

    // Track replicas
    for (const replicaPath of this.config.replicas) {
      this.replicaHealth.set(replicaPath, {
        path: replicaPath,
        healthy: false,
        lastSync: 0,
        lag: Infinity,
        role: 'replica',
      });
    }
  }

  // Start replication and health monitoring
  start() {
    if (this.config.replicas.length === 0) return;

    // Initial sync
    this.syncToReplicas();

    // Periodic sync (write-ahead replication)
    this.syncInterval = setInterval(() => this.syncToReplicas(), 2000);

    // Health checks
    this.healthInterval = setInterval(() => this.checkHealth(), this.config.healthCheckInterval);

    console.log(`[Replica] Started with ${this.config.replicas.length} replica(s)`);
  }

  stop() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    if (this.healthInterval) clearInterval(this.healthInterval);
  }

  // Sync primary DB to all replicas
  private syncToReplicas() {
    try {
      const primaryData = fs.readFileSync(this.config.primaryPath, 'utf-8');
      const primaryMtime = fs.statSync(this.config.primaryPath).mtimeMs;

      for (const replicaPath of this.config.replicas) {
        try {
          // Check if replica needs update
          let replicaMtime = 0;
          try {
            replicaMtime = fs.statSync(replicaPath).mtimeMs;
          } catch {
            // Replica doesn't exist yet
          }

          if (replicaMtime < primaryMtime) {
            // Atomic write: write to temp file then rename
            const tmpPath = replicaPath + '.tmp';
            fs.writeFileSync(tmpPath, primaryData, 'utf-8');
            fs.renameSync(tmpPath, replicaPath);

            const health = this.replicaHealth.get(replicaPath);
            if (health) {
              health.healthy = true;
              health.lastSync = Date.now();
              health.lag = Date.now() - primaryMtime;
            }
          }
        } catch (err) {
          const health = this.replicaHealth.get(replicaPath);
          if (health) {
            health.healthy = false;
          }
          console.error(`[Replica] Sync error for ${replicaPath}:`, err);
        }
      }
    } catch (err) {
      console.error('[Replica] Primary read error:', err);
    }
  }

  // Check health of all replicas
  private checkHealth() {
    for (const [path, health] of this.replicaHealth) {
      try {
        fs.accessSync(path, fs.constants.R_OK);
        const stat = fs.statSync(path);
        if (health.role === 'replica') {
          const primaryStat = fs.statSync(this.config.primaryPath);
          health.lag = Date.now() - stat.mtimeMs;
          health.healthy = health.lag < this.config.replicationLagThreshold;
        }
      } catch {
        health.healthy = false;
      }
    }
  }

  // Get a DB connection for reads (returns path to read from)
  getReadDB(): string {
    if (this.config.replicas.length === 0) {
      return this.config.primaryPath;
    }

    const healthyReplicas = this.config.replicas.filter(r => {
      const health = this.replicaHealth.get(r);
      return health?.healthy;
    });

    switch (this.config.readPreference) {
      case 'primary':
        return this.config.primaryPath;

      case 'primaryPreferred':
        if (healthyReplicas.length > 0) return this.selectReplica(healthyReplicas);
        return this.config.primaryPath;

      case 'secondary':
        if (healthyReplicas.length > 0) return this.selectReplica(healthyReplicas);
        throw new Error('No healthy secondary replicas available');

      case 'secondaryPreferred':
      default:
        if (healthyReplicas.length > 0) return this.selectReplica(healthyReplicas);
        return this.config.primaryPath;
    }
  }

  // Round-robin replica selection
  private selectReplica(replicas: string[]): string {
    const selected = replicas[this.roundRobinIndex % replicas.length];
    this.roundRobinIndex++;
    return selected;
  }

  // Get the primary DB path for writes
  getWriteDB(): string {
    return this.config.primaryPath;
  }

  // Read from the appropriate DB
  readData(): any {
    const dbPath = this.getReadDB();
    try {
      return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    } catch {
      // Fallback to primary
      return JSON.parse(fs.readFileSync(this.config.primaryPath, 'utf-8'));
    }
  }

  // Write to primary (replicas sync automatically)
  writeData(data: any): void {
    const tmpPath = this.config.primaryPath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpPath, this.config.primaryPath);
    // Replicas will be synced on next interval
  }

  // Get status of all replicas
  getStatus() {
    const replicas = Array.from(this.replicaHealth.values()).map(h => ({
      path: h.path,
      healthy: h.healthy,
      role: h.role,
      lag: h.lag,
      lastSync: h.lastSync ? new Date(h.lastSync).toISOString() : 'never',
    }));

    return {
      primary: this.config.primaryPath,
      replicaCount: this.config.replicas.length,
      readPreference: this.config.readPreference,
      replicas,
      healthyReplicas: replicas.filter(r => r.healthy && r.role === 'replica').length,
    };
  }
}

export const replicaManager = new ReadReplicaManager();

// ──────────────────────────────────────────────
// 5. Load Balancer Health Check Endpoint
// ──────────────────────────────────────────────

export function getHealthCheckData() {
  const mem = process.memoryUsage();
  const load = os.loadavg();
  const upTime = process.uptime();

  return {
    status: 'ok',
    uptime: upTime,
    pid: process.pid,
    workerId: cluster.isWorker ? cluster.worker?.id : 'primary',
    memory: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      external: Math.round(mem.external / 1024 / 1024),
    },
    cpu: {
      load1: load[0].toFixed(2),
      load5: load[1].toFixed(2),
      load15: load[2].toFixed(2),
      cores: NUM_CPUS,
    },
    scaling: autoScaler.getStatus(),
    replicas: replicaManager.getStatus(),
    cdn: getCDNConfig(),
    timestamp: new Date().toISOString(),
  };
}

// ──────────────────────────────────────────────
// 6. Request Load Tracking Middleware
// ──────────────────────────────────────────────

let requestCount = 0;
let errorCount = 0;
let totalResponseTime = 0;
let lastResetTime = Date.now();

export function trackRequest(responseTime: number, isError: boolean) {
  requestCount++;
  if (isError) errorCount++;
  totalResponseTime += responseTime;
}

export function getRequestLoadMetrics(): { requestRate: number; avgResponseTime: number; errorRate: number } {
  const elapsed = (Date.now() - lastResetTime) / 1000; // seconds
  const requestRate = elapsed > 0 ? requestCount / elapsed : 0;
  const avgResponseTime = requestCount > 0 ? totalResponseTime / requestCount : 0;
  const errorRate = requestCount > 0 ? (errorCount / requestCount) * 100 : 0;

  // Reset counters every 30 seconds
  if (elapsed > 30) {
    requestCount = 0;
    errorCount = 0;
    totalResponseTime = 0;
    lastResetTime = Date.now();
  }

  return { requestRate, avgResponseTime, errorRate };
}
