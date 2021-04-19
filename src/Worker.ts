import * as http from "http";
import * as https from "https";
import { URL } from "url";
import { LoadTestConfig, RequestResult } from "./types";

export class Worker {
  private config: LoadTestConfig;
  private agent: http.Agent | https.Agent;

  constructor(config: LoadTestConfig) {
    this.config = config;

    const isHttps = config.url.startsWith("https");
    const AgentClass = isHttps ? https.Agent : http.Agent;
    this.agent = new AgentClass({
      keepAlive: config.keepAlive,
      maxSockets: config.concurrent,
      keepAliveMsecs: 10000,
    });
  }

  async sendRequest(): Promise<RequestResult> {
    const startTime = process.hrtime.bigint();
    const timestamp = Date.now();

    try {
      const result = await this.executeRequest();
      const endTime = process.hrtime.bigint();
      const responseTimeMs = Number(endTime - startTime) / 1_000_000;

      return {
        statusCode: result.statusCode,
        responseTimeMs,
        bytesReceived: result.bytesReceived,
        timestamp,
      };
    } catch (err: any) {
      const endTime = process.hrtime.bigint();
      const responseTimeMs = Number(endTime - startTime) / 1_000_000;

      return {
        statusCode: 0,
        responseTimeMs,
        bytesReceived: 0,
        error: err.message || "Unknown error",
        timestamp,
      };
    }
  }

  private executeRequest(): Promise<{ statusCode: number; bytesReceived: number; body: string }> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(this.config.url);
      const isHttps = parsedUrl.protocol === "https:";
      const requestFn = isHttps ? https.request : http.request;

      const options: http.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: this.config.method,
        headers: { ...this.config.headers },
        agent: this.agent,
        timeout: this.config.timeoutMs,
      };

      if (this.config.body) {
        const bodyStr = typeof this.config.body === "string"
          ? this.config.body
          : JSON.stringify(this.config.body);
        options.headers = {
          ...options.headers,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(bodyStr).toString(),
        };
      }

      const req = requestFn(options, (res) => {
        let body = "";
        let bytesReceived = 0;

        res.on("data", (chunk: Buffer) => {
          bytesReceived += chunk.length;
          body += chunk.toString();
        });

        res.on("end", () => {
          resolve({
            statusCode: res.statusCode || 0,
            bytesReceived,
            body,
          });
        });
      });

      req.on("error", (err) => reject(err));

      req.on("timeout", () => {
        req.destroy();
        reject(new Error(`Request timed out after ${this.config.timeoutMs}ms`));
      });

      if (this.config.body) {
        const bodyStr = typeof this.config.body === "string"
          ? this.config.body
          : JSON.stringify(this.config.body);
        req.write(bodyStr);
      }

      req.end();
    });
  }

  destroy(): void {
    this.agent.destroy();
  }
}
