import * as fs from "fs";
import * as path from "path";
import { TestReport } from "./types";

export class Reporter {
  toTerminal(report: TestReport): void {
    const { summary, responseTime, statusCodes, errors, histogram } = report;

    console.log("=".repeat(60));
    console.log("  LOAD TEST RESULTS");
    console.log("=".repeat(60));

    console.log("\n  Summary");
    console.log("  " + "-".repeat(40));
    console.log(`  Total Requests:    ${summary.totalRequests}`);
    console.log(`  Successful:        ${summary.successfulRequests} (${((summary.successfulRequests / summary.totalRequests) * 100).toFixed(1)}%)`);
    console.log(`  Failed:            ${summary.failedRequests} (${((summary.failedRequests / summary.totalRequests) * 100).toFixed(1)}%)`);
    console.log(`  Duration:          ${(summary.totalDurationMs / 1000).toFixed(2)}s`);
    console.log(`  Requests/sec:      ${summary.requestsPerSecond.toFixed(2)}`);
    console.log(`  Data transferred:  ${this.formatBytes(summary.bytesTransferred)}`);

    console.log("\n  Response Times");
    console.log("  " + "-".repeat(40));
    console.log(`  Min:       ${responseTime.min.toFixed(2)}ms`);
    console.log(`  Max:       ${responseTime.max.toFixed(2)}ms`);
    console.log(`  Avg:       ${responseTime.avg.toFixed(2)}ms`);
    console.log(`  Median:    ${responseTime.median.toFixed(2)}ms`);
    console.log(`  Std Dev:   ${responseTime.stdDev.toFixed(2)}ms`);
    console.log(`  p50:       ${responseTime.percentiles.p50.toFixed(2)}ms`);
    console.log(`  p75:       ${responseTime.percentiles.p75.toFixed(2)}ms`);
    console.log(`  p90:       ${responseTime.percentiles.p90.toFixed(2)}ms`);
    console.log(`  p95:       ${responseTime.percentiles.p95.toFixed(2)}ms`);
    console.log(`  p99:       ${responseTime.percentiles.p99.toFixed(2)}ms`);

    console.log("\n  Status Codes");
    console.log("  " + "-".repeat(40));
    for (const [code, count] of Object.entries(statusCodes)) {
      const pct = ((count as number / summary.totalRequests) * 100).toFixed(1);
      console.log(`  ${code}: ${count} (${pct}%)`);
    }

    if (errors.length > 0) {
      console.log("\n  Errors");
      console.log("  " + "-".repeat(40));
      for (const err of errors.slice(0, 10)) {
        console.log(`  ${err.message}: ${err.count}`);
      }
    }

    if (histogram.length > 0) {
      console.log("\n  Response Time Histogram");
      console.log("  " + "-".repeat(40));
      const maxCount = Math.max(...histogram.map((h) => h.count));
      const barWidth = 30;
      for (const bucket of histogram) {
        const bar = "#".repeat(Math.ceil((bucket.count / maxCount) * barWidth));
        console.log(`  ${bucket.bucket.padEnd(14)} ${bar} ${bucket.count}`);
      }
    }

    console.log("\n" + "=".repeat(60));
  }

  toJSON(report: TestReport, outputPath?: string): void {
    const json = JSON.stringify(report, null, 2);
    if (outputPath) {
      this.ensureDir(outputPath);
      fs.writeFileSync(outputPath, json, "utf-8");
      console.log(`Report saved to ${outputPath}`);
    } else {
      const defaultPath = path.join("reports", `loadtest-${Date.now()}.json`);
      this.ensureDir(defaultPath);
      fs.writeFileSync(defaultPath, json, "utf-8");
      console.log(`Report saved to ${defaultPath}`);
    }
  }

  toHTML(report: TestReport, outputPath?: string): void {
    const { summary, responseTime, histogram } = report;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Load Test Report</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; background: #0f172a; color: #e2e8f0; }
    h1 { color: #60a5fa; }
    .card { background: #1e293b; border-radius: 12px; padding: 24px; margin: 16px 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
    .stat { text-align: center; }
    .stat-value { font-size: 2em; font-weight: bold; color: #60a5fa; }
    .stat-label { color: #94a3b8; font-size: 0.875em; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #334155; }
    th { color: #94a3b8; }
    .bar { background: #3b82f6; height: 20px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Load Test Report</h1>
  <p>URL: ${report.config.url} | Method: ${report.config.method} | Concurrency: ${report.config.concurrent}</p>
  <div class="card grid">
    <div class="stat"><div class="stat-value">${summary.totalRequests}</div><div class="stat-label">Total Requests</div></div>
    <div class="stat"><div class="stat-value">${summary.requestsPerSecond.toFixed(1)}</div><div class="stat-label">Requests/sec</div></div>
    <div class="stat"><div class="stat-value">${responseTime.avg.toFixed(0)}ms</div><div class="stat-label">Avg Response</div></div>
    <div class="stat"><div class="stat-value">${((summary.failedRequests / summary.totalRequests) * 100).toFixed(1)}%</div><div class="stat-label">Error Rate</div></div>
  </div>
  <div class="card">
    <h2>Response Time Percentiles</h2>
    <table>
      <tr><th>Percentile</th><th>Response Time</th></tr>
      <tr><td>p50</td><td>${responseTime.percentiles.p50.toFixed(2)}ms</td></tr>
      <tr><td>p75</td><td>${responseTime.percentiles.p75.toFixed(2)}ms</td></tr>
      <tr><td>p90</td><td>${responseTime.percentiles.p90.toFixed(2)}ms</td></tr>
      <tr><td>p95</td><td>${responseTime.percentiles.p95.toFixed(2)}ms</td></tr>
      <tr><td>p99</td><td>${responseTime.percentiles.p99.toFixed(2)}ms</td></tr>
    </table>
  </div>
  <div class="card">
    <h2>Response Time Distribution</h2>
    ${histogram.map((h) => `<div style="margin:4px 0"><span style="display:inline-block;width:120px">${h.bucket}</span><div class="bar" style="width:${Math.ceil((h.count / summary.totalRequests) * 100)}%;display:inline-block"></div> ${h.count}</div>`).join("\n    ")}
  </div>
  <p style="color:#64748b;text-align:center">Generated at ${new Date().toISOString()}</p>
</body>
</html>`;

    const filePath = outputPath || path.join("reports", `loadtest-${Date.now()}.html`);
    this.ensureDir(filePath);
    fs.writeFileSync(filePath, html, "utf-8");
    console.log(`HTML report saved to ${filePath}`);
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  private ensureDir(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
