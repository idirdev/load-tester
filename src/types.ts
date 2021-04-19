export interface LoadTestConfig {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
  concurrent: number;
  duration: number;
  totalRequests?: number;
  rampUpSeconds: number;
  timeoutMs: number;
  keepAlive: boolean;
  targetRps?: number;
}

export interface RequestResult {
  statusCode: number;
  responseTimeMs: number;
  bytesReceived: number;
  error?: string;
  timestamp: number;
}

export interface Percentiles {
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface StatusCodeDist {
  [code: number]: number;
}

export interface TimelinePoint {
  timestamp: number;
  requestsPerSecond: number;
  avgResponseTimeMs: number;
  errorRate: number;
  activeConnections: number;
}

export interface TestReport {
  config: LoadTestConfig;
  summary: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    totalDurationMs: number;
    requestsPerSecond: number;
    bytesTransferred: number;
  };
  responseTime: {
    min: number;
    max: number;
    avg: number;
    median: number;
    stdDev: number;
    percentiles: Percentiles;
  };
  statusCodes: StatusCodeDist;
  errors: { message: string; count: number }[];
  timeline: TimelinePoint[];
  histogram: { bucket: string; count: number }[];
}

export interface ScenarioStep {
  name: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: any;
  thinkTimeMs?: number;
  validate?: (response: { status: number; body: string }) => boolean;
  extract?: Record<string, string>;
}

export interface Scenario {
  name: string;
  steps: ScenarioStep[];
  variables?: Record<string, string>;
}
