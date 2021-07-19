import { describe, it, expect } from 'vitest';
import { Collector } from '../src/Collector';
import type { RequestResult, LoadTestConfig } from '../src/types';

function makeConfig(overrides: Partial<LoadTestConfig> = {}): LoadTestConfig {
  return {
    url: 'http://localhost:3000',
    method: 'GET',
    headers: {},
    concurrent: 1,
    duration: 10,
    rampUpSeconds: 0,
    timeoutMs: 5000,
    keepAlive: true,
    ...overrides,
  };
}

function makeResult(overrides: Partial<RequestResult> = {}): RequestResult {
  return {
    statusCode: 200,
    responseTimeMs: 50,
    bytesReceived: 1024,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('Collector', () => {
  describe('record', () => {
    it('should store request results', () => {
      const collector = new Collector();
      const result = makeResult();
      collector.record(result);

      const report = collector.generateReport(makeConfig());
      expect(report.summary.totalRequests).toBe(1);
    });

    it('should accumulate multiple results', () => {
      const collector = new Collector();
      collector.record(makeResult({ timestamp: 1000 }));
      collector.record(makeResult({ timestamp: 1100 }));
      collector.record(makeResult({ timestamp: 1200 }));

      const report = collector.generateReport(makeConfig());
      expect(report.summary.totalRequests).toBe(3);
    });
  });

  describe('generateReport', () => {
    it('should classify successful and failed requests', () => {
      const collector = new Collector();
      collector.record(makeResult({ statusCode: 200, timestamp: 1000 }));
      collector.record(makeResult({ statusCode: 201, timestamp: 1100 }));
      collector.record(makeResult({ statusCode: 404, timestamp: 1200 }));
      collector.record(makeResult({ statusCode: 500, timestamp: 1300 }));
      collector.record(makeResult({ statusCode: 0, error: 'Connection refused', timestamp: 1400 }));

      const report = collector.generateReport(makeConfig());
      expect(report.summary.successfulRequests).toBe(2);
      expect(report.summary.failedRequests).toBe(3);
    });

    it('should calculate response time statistics', () => {
      const collector = new Collector();
      const baseTime = 1000;
      collector.record(makeResult({ responseTimeMs: 10, timestamp: baseTime }));
      collector.record(makeResult({ responseTimeMs: 20, timestamp: baseTime + 100 }));
      collector.record(makeResult({ responseTimeMs: 30, timestamp: baseTime + 200 }));
      collector.record(makeResult({ responseTimeMs: 40, timestamp: baseTime + 300 }));
      collector.record(makeResult({ responseTimeMs: 50, timestamp: baseTime + 400 }));

      const report = collector.generateReport(makeConfig());
      expect(report.responseTime.min).toBe(10);
      expect(report.responseTime.max).toBe(50);
      expect(report.responseTime.avg).toBe(30);
      expect(report.responseTime.median).toBe(30);
    });

    it('should compute percentiles', () => {
      const collector = new Collector();
      const baseTime = 1000;
      for (let i = 1; i <= 100; i++) {
        collector.record(makeResult({
          responseTimeMs: i,
          timestamp: baseTime + i,
        }));
      }

      const report = collector.generateReport(makeConfig());
      expect(report.responseTime.percentiles.p50).toBe(50);
      expect(report.responseTime.percentiles.p90).toBe(90);
      expect(report.responseTime.percentiles.p95).toBe(95);
      expect(report.responseTime.percentiles.p99).toBe(99);
    });

    it('should track status code distribution', () => {
      const collector = new Collector();
      collector.record(makeResult({ statusCode: 200, timestamp: 1000 }));
      collector.record(makeResult({ statusCode: 200, timestamp: 1100 }));
      collector.record(makeResult({ statusCode: 404, timestamp: 1200 }));

      const report = collector.generateReport(makeConfig());
      expect(report.statusCodes[200]).toBe(2);
      expect(report.statusCodes[404]).toBe(1);
    });

    it('should aggregate errors', () => {
      const collector = new Collector();
      collector.record(makeResult({ statusCode: 0, error: 'Connection refused', timestamp: 1000 }));
      collector.record(makeResult({ statusCode: 0, error: 'Connection refused', timestamp: 1100 }));
      collector.record(makeResult({ statusCode: 0, error: 'Timeout', timestamp: 1200 }));

      const report = collector.generateReport(makeConfig());
      expect(report.errors).toHaveLength(2);
      const connRefused = report.errors.find(e => e.message === 'Connection refused');
      expect(connRefused?.count).toBe(2);
    });

    it('should sum bytes transferred', () => {
      const collector = new Collector();
      collector.record(makeResult({ bytesReceived: 100, timestamp: 1000 }));
      collector.record(makeResult({ bytesReceived: 200, timestamp: 1100 }));

      const report = collector.generateReport(makeConfig());
      expect(report.summary.bytesTransferred).toBe(300);
    });

    it('should build histogram buckets', () => {
      const collector = new Collector();
      collector.record(makeResult({ responseTimeMs: 5, timestamp: 1000 }));
      collector.record(makeResult({ responseTimeMs: 150, timestamp: 1100 }));
      collector.record(makeResult({ responseTimeMs: 1500, timestamp: 1200 }));

      const report = collector.generateReport(makeConfig());
      expect(report.histogram.length).toBeGreaterThan(0);
    });

    it('should handle empty results gracefully', () => {
      const collector = new Collector();
      const report = collector.generateReport(makeConfig());
      expect(report.summary.totalRequests).toBe(0);
      expect(report.responseTime.min).toBe(0);
      expect(report.responseTime.max).toBe(0);
      expect(report.responseTime.avg).toBe(0);
      expect(report.timeline).toEqual([]);
      expect(report.histogram).toEqual([]);
    });

    it('should include the config in the report', () => {
      const collector = new Collector();
      const config = makeConfig({ url: 'http://example.com', concurrent: 5 });
      const report = collector.generateReport(config);
      expect(report.config.url).toBe('http://example.com');
      expect(report.config.concurrent).toBe(5);
    });
  });
});
