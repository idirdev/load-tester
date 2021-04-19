import { LoadTestConfig } from "./types";
import { Worker } from "./Worker";
import { Collector } from "./Collector";

export class Scheduler {
  private config: LoadTestConfig;
  private collector: Collector;
  private workers: Worker[] = [];
  private running = false;
  private requestCount = 0;

  constructor(config: LoadTestConfig, collector: Collector) {
    this.config = config;
    this.collector = collector;
  }

  async run(): Promise<void> {
    this.running = true;
    this.requestCount = 0;
    const startTime = Date.now();

    const maxConcurrent = this.config.concurrent;
    const rampUpMs = this.config.rampUpSeconds * 1000;
    const durationMs = this.config.duration * 1000;

    // Create workers
    for (let i = 0; i < maxConcurrent; i++) {
      this.workers.push(new Worker(this.config));
    }

    const shouldContinue = (): boolean => {
      if (!this.running) return false;
      if (this.config.totalRequests && this.requestCount >= this.config.totalRequests) return false;
      if (!this.config.totalRequests && Date.now() - startTime >= durationMs) return false;
      return true;
    };

    const getActiveWorkerCount = (): number => {
      const elapsed = Date.now() - startTime;
      if (rampUpMs <= 0 || elapsed >= rampUpMs) return maxConcurrent;
      const progress = elapsed / rampUpMs;
      return Math.max(1, Math.ceil(maxConcurrent * progress));
    };

    const runWorker = async (workerIndex: number): Promise<void> => {
      const worker = this.workers[workerIndex];

      while (shouldContinue()) {
        const activeCount = getActiveWorkerCount();
        if (workerIndex >= activeCount) {
          await this.sleep(100);
          continue;
        }

        // Rate limiting
        if (this.config.targetRps) {
          const elapsed = (Date.now() - startTime) / 1000;
          const expectedRequests = elapsed * this.config.targetRps;
          if (this.requestCount >= expectedRequests) {
            await this.sleep(10);
            continue;
          }
        }

        this.requestCount++;
        const result = await worker.sendRequest();
        this.collector.record(result);

        // Progress update every 100 requests
        if (this.requestCount % 100 === 0) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          const rps = (this.requestCount / ((Date.now() - startTime) / 1000)).toFixed(1);
          process.stdout.write(`\r  Requests: ${this.requestCount} | Elapsed: ${elapsed}s | RPS: ${rps}  `);
        }
      }
    };

    // Start all workers concurrently
    const workerPromises = Array.from({ length: maxConcurrent }, (_, i) => runWorker(i));
    await Promise.all(workerPromises);

    process.stdout.write("\n\n");
    this.cleanup();
  }

  stop(): void {
    this.running = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private cleanup(): void {
    for (const worker of this.workers) {
      worker.destroy();
    }
    this.workers = [];
  }
}

export class BurstScheduler {
  static async burst(config: LoadTestConfig, collector: Collector, burstSize: number, intervalMs: number): Promise<void> {
    const worker = new Worker(config);
    const startTime = Date.now();
    const durationMs = config.duration * 1000;

    while (Date.now() - startTime < durationMs) {
      const promises = Array.from({ length: burstSize }, () =>
        worker.sendRequest().then((result) => collector.record(result))
      );
      await Promise.all(promises);
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    worker.destroy();
  }
}

export class StepScheduler {
  static async step(
    config: LoadTestConfig,
    collector: Collector,
    startConcurrency: number,
    stepSize: number,
    stepIntervalSeconds: number
  ): Promise<void> {
    let currentConcurrency = startConcurrency;
    const startTime = Date.now();
    const durationMs = config.duration * 1000;

    while (Date.now() - startTime < durationMs) {
      console.log(`  Step: ${currentConcurrency} concurrent connections`);
      const stepConfig = { ...config, concurrent: currentConcurrency, duration: stepIntervalSeconds };
      const scheduler = new Scheduler(stepConfig, collector);
      await scheduler.run();
      currentConcurrency += stepSize;
      if (currentConcurrency > config.concurrent) currentConcurrency = config.concurrent;
    }
  }
}
