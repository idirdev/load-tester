import { Scenario, ScenarioStep, LoadTestConfig, RequestResult } from "./types";
import { Worker } from "./Worker";
import { Collector } from "./Collector";

export function defineScenario(name: string, steps: ScenarioStep[]): Scenario {
  return { name, steps, variables: {} };
}

export class ScenarioRunner {
  private scenario: Scenario;
  private collector: Collector;
  private variables: Map<string, string>;

  constructor(scenario: Scenario, collector: Collector) {
    this.scenario = scenario;
    this.collector = collector;
    this.variables = new Map(Object.entries(scenario.variables || {}));
  }

  async runIteration(): Promise<void> {
    for (const step of this.scenario.steps) {
      const url = this.interpolate(step.url);
      const body = step.body ? JSON.parse(this.interpolate(JSON.stringify(step.body))) : undefined;
      const headers = step.headers
        ? Object.fromEntries(
            Object.entries(step.headers).map(([k, v]) => [k, this.interpolate(v)])
          )
        : {};

      const config: LoadTestConfig = {
        url,
        method: step.method,
        headers,
        body,
        concurrent: 1,
        duration: 0,
        rampUpSeconds: 0,
        timeoutMs: 10000,
        keepAlive: true,
      };

      const worker = new Worker(config);
      const result = await worker.sendRequest();
      worker.destroy();

      this.collector.record(result);

      if (step.validate) {
        const valid = step.validate({
          status: result.statusCode,
          body: "", // Body would need to be captured from Worker
        });
        if (!valid) {
          console.warn(`Validation failed for step: ${step.name}`);
        }
      }

      // Think time between steps
      if (step.thinkTimeMs && step.thinkTimeMs > 0) {
        await this.sleep(step.thinkTimeMs);
      }
    }
  }

  async run(iterations: number, concurrent: number = 1): Promise<void> {
    console.log(`Running scenario: ${this.scenario.name}`);
    console.log(`  Iterations: ${iterations} | Concurrent: ${concurrent}`);

    const runBatch = async (count: number): Promise<void> => {
      for (let i = 0; i < count; i++) {
        await this.runIteration();
      }
    };

    const batchSize = Math.ceil(iterations / concurrent);
    const batches = Array.from({ length: concurrent }, () => runBatch(batchSize));
    await Promise.all(batches);
  }

  private interpolate(str: string): string {
    return str.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return this.variables.get(key) || `{{${key}}}`;
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Example scenario definitions
export const exampleScenarios: Scenario[] = [
  defineScenario("User Login Flow", [
    {
      name: "Visit homepage",
      url: "{{baseUrl}}/",
      method: "GET",
      thinkTimeMs: 1000,
    },
    {
      name: "Login",
      url: "{{baseUrl}}/api/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: { email: "{{email}}", password: "{{password}}" },
      validate: (res) => res.status === 200,
      thinkTimeMs: 500,
    },
    {
      name: "Fetch profile",
      url: "{{baseUrl}}/api/users/me",
      method: "GET",
      headers: { Authorization: "Bearer {{token}}" },
      validate: (res) => res.status === 200,
    },
  ]),
  defineScenario("API CRUD Flow", [
    {
      name: "List items",
      url: "{{baseUrl}}/api/items",
      method: "GET",
      thinkTimeMs: 500,
    },
    {
      name: "Create item",
      url: "{{baseUrl}}/api/items",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: { name: "Test Item", value: 42 },
      thinkTimeMs: 300,
    },
    {
      name: "Get item",
      url: "{{baseUrl}}/api/items/{{itemId}}",
      method: "GET",
      thinkTimeMs: 200,
    },
    {
      name: "Delete item",
      url: "{{baseUrl}}/api/items/{{itemId}}",
      method: "DELETE",
    },
  ]),
];
