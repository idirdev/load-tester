import { RequestResult, TestReport, LoadTestConfig, StatusCodeDist, TimelinePoint, Percentiles } from "./types";

export class Collector {
  private results: RequestResult[] = [];
  private startTime: number = 0;

  record(result: RequestResult): void {
    if (this.results.length === 0) {
      this.startTime = result.timestamp;
    }
    this.results.push(result);
  }

  generateReport(config: LoadTestConfig): TestReport {
    const successful = this.results.filter((r) => r.statusCode >= 200 && r.statusCode < 400);
    const failed = this.results.filter((r) => r.statusCode === 0 || r.statusCode >= 400);
    const totalDurationMs = this.results.length > 0
      ? this.results[this.results.length - 1].timestamp - this.startTime
      : 0;

    const responseTimes = this.results.map((r) => r.responseTimeMs).sort((a, b) => a - b);
    const avg = responseTimes.reduce((sum, t) => sum + t, 0) / (responseTimes.length || 1);
    const variance = responseTimes.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / (responseTimes.length || 1);

    return {
      config,
      summary: {
        totalRequests: this.results.length,
        successfulRequests: successful.length,
        failedRequests: failed.length,
        totalDurationMs,
        requestsPerSecond: totalDurationMs > 0 ? (this.results.length / totalDurationMs) * 1000 : 0,
        bytesTransferred: this.results.reduce((sum, r) => sum + r.bytesReceived, 0),
      },
      responseTime: {
        min: responseTimes.length > 0 ? responseTimes[0] : 0,
        max: responseTimes.length > 0 ? responseTimes[responseTimes.length - 1] : 0,
        avg,
        median: this.percentile(responseTimes, 50),
        stdDev: Math.sqrt(variance),
        percentiles: this.calculatePercentiles(responseTimes),
      },
      statusCodes: this.getStatusCodeDist(),
      errors: this.getErrorSummary(),
      timeline: this.buildTimeline(),
      histogram: this.buildHistogram(responseTimes),
    };
  }

  private calculatePercentiles(sorted: number[]): Percentiles {
    return {
      p50: this.percentile(sorted, 50),
      p75: this.percentile(sorted, 75),
      p90: this.percentile(sorted, 90),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99),
    };
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private getStatusCodeDist(): StatusCodeDist {
    const dist: StatusCodeDist = {};
    for (const result of this.results) {
      dist[result.statusCode] = (dist[result.statusCode] || 0) + 1;
    }
    return dist;
  }

  private getErrorSummary(): { message: string; count: number }[] {
    const errorMap = new Map<string, number>();
    for (const result of this.results) {
      if (result.error) {
        errorMap.set(result.error, (errorMap.get(result.error) || 0) + 1);
      }
    }
    return Array.from(errorMap.entries())
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count);
  }

  private buildTimeline(): TimelinePoint[] {
    if (this.results.length === 0) return [];

    const bucketSizeMs = 1000;
    const points: TimelinePoint[] = [];
    let bucketStart = this.startTime;
    let bucketResults: RequestResult[] = [];

    for (const result of this.results) {
      if (result.timestamp - bucketStart >= bucketSizeMs) {
        if (bucketResults.length > 0) {
          points.push(this.summarizeBucket(bucketStart, bucketResults));
        }
        bucketStart += bucketSizeMs;
        bucketResults = [];
      }
      bucketResults.push(result);
    }

    if (bucketResults.length > 0) {
      points.push(this.summarizeBucket(bucketStart, bucketResults));
    }

    return points;
  }

  private summarizeBucket(timestamp: number, results: RequestResult[]): TimelinePoint {
    const avgTime = results.reduce((s, r) => s + r.responseTimeMs, 0) / results.length;
    const errors = results.filter((r) => r.statusCode === 0 || r.statusCode >= 400).length;
    return {
      timestamp,
      requestsPerSecond: results.length,
      avgResponseTimeMs: avgTime,
      errorRate: errors / results.length,
      activeConnections: results.length,
    };
  }

  private buildHistogram(sorted: number[]): { bucket: string; count: number }[] {
    if (sorted.length === 0) return [];

    const buckets = [0, 10, 25, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
    const histogram: { bucket: string; count: number }[] = [];

    for (let i = 0; i < buckets.length; i++) {
      const lower = buckets[i];
      const upper = i < buckets.length - 1 ? buckets[i + 1] : Infinity;
      const label = upper === Infinity ? `${lower}ms+` : `${lower}-${upper}ms`;
      const count = sorted.filter((t) => t >= lower && t < upper).length;
      if (count > 0) {
        histogram.push({ bucket: label, count });
      }
    }

    return histogram;
  }
}
