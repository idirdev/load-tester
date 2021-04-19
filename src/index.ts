#!/usr/bin/env node

import { Command } from "commander";
import { LoadTestConfig } from "./types";
import { Scheduler } from "./Scheduler";
import { Collector } from "./Collector";
import { Reporter } from "./Reporter";

const program = new Command();

program
  .name("loadtest")
  .description("HTTP load testing tool with detailed metrics and reporting")
  .version("1.0.0");

program
  .command("run <url>")
  .description("Run a load test against a URL")
  .option("-c, --concurrent <n>", "Number of concurrent connections", "10")
  .option("-d, --duration <seconds>", "Test duration in seconds", "30")
  .option("-n, --requests <n>", "Total number of requests (overrides duration)")
  .option("-m, --method <method>", "HTTP method", "GET")
  .option("-b, --body <body>", "Request body (JSON string)")
  .option("-H, --header <header...>", "Request headers (key:value)")
  .option("--ramp-up <seconds>", "Ramp-up period in seconds", "0")
  .option("--timeout <ms>", "Request timeout in milliseconds", "10000")
  .option("--keep-alive", "Use keep-alive connections", true)
  .option("--rate <rps>", "Target requests per second")
  .option("--report <format>", "Report format: terminal, json, html", "terminal")
  .option("--output <path>", "Output file path for report")
  .action(async (url: string, opts) => {
    const headers: Record<string, string> = {};
    if (opts.header) {
      for (const h of opts.header) {
        const [key, ...rest] = h.split(":");
        headers[key.trim()] = rest.join(":").trim();
      }
    }

    const config: LoadTestConfig = {
      url,
      method: opts.method.toUpperCase(),
      headers,
      body: opts.body ? JSON.parse(opts.body) : undefined,
      concurrent: parseInt(opts.concurrent),
      duration: parseInt(opts.duration),
      totalRequests: opts.requests ? parseInt(opts.requests) : undefined,
      rampUpSeconds: parseInt(opts.rampUp),
      timeoutMs: parseInt(opts.timeout),
      keepAlive: opts.keepAlive,
      targetRps: opts.rate ? parseInt(opts.rate) : undefined,
    };

    console.log(`\nLoad testing ${config.method} ${config.url}`);
    console.log(`Concurrency: ${config.concurrent} | Duration: ${config.duration}s | Ramp-up: ${config.rampUpSeconds}s\n`);

    const collector = new Collector();
    const scheduler = new Scheduler(config, collector);

    await scheduler.run();

    const report = collector.generateReport(config);
    const reporter = new Reporter();

    if (opts.report === "json") {
      reporter.toJSON(report, opts.output);
    } else if (opts.report === "html") {
      reporter.toHTML(report, opts.output);
    } else {
      reporter.toTerminal(report);
    }
  });

program.parse(process.argv);
