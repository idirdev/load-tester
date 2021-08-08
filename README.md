# load-tester

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?logo=typescript)](https://typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green?logo=node.js)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A fast, lightweight HTTP load testing tool with detailed metrics, percentile analysis, and multiple report formats.

## Features

- **Concurrent connections** - Configurable number of parallel workers
- **Ramp-up support** - Gradually increase load to simulate realistic traffic
- **Rate limiting** - Target a specific requests-per-second rate
- **Detailed metrics** - p50/p75/p90/p95/p99 percentiles, min/max/avg, std dev
- **Status code distribution** - Track all response codes
- **Multiple reports** - Terminal summary, JSON export, HTML report
- **Scenario support** - Multi-step request sequences with variable injection
- **Keep-alive** - Persistent connections for realistic testing
- **Response histogram** - ASCII response time distribution

## Installation

```bash
npm install
npm run build
```

## CLI Reference

```bash
# Basic load test
loadtest run https://example.com

# Custom configuration
loadtest run https://api.example.com/users \
  --concurrent 50 \
  --duration 60 \
  --method POST \
  --body '{"name": "test"}' \
  --header "Authorization:Bearer token123" \
  --header "Content-Type:application/json"

# Rate-limited test with ramp-up
loadtest run https://example.com \
  --concurrent 100 \
  --duration 120 \
  --ramp-up 30 \
  --rate 500

# Fixed number of requests
loadtest run https://example.com \
  --requests 10000 \
  --concurrent 20

# Generate HTML report
loadtest run https://example.com \
  --report html \
  --output ./reports/test-results.html
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `-c, --concurrent` | 10 | Number of concurrent connections |
| `-d, --duration` | 30 | Test duration in seconds |
| `-n, --requests` | - | Total requests (overrides duration) |
| `-m, --method` | GET | HTTP method |
| `-b, --body` | - | Request body (JSON) |
| `-H, --header` | - | Headers (key:value, repeatable) |
| `--ramp-up` | 0 | Ramp-up period in seconds |
| `--timeout` | 10000 | Request timeout in ms |
| `--keep-alive` | true | Use keep-alive connections |
| `--rate` | - | Target requests per second |
| `--report` | terminal | Output format: terminal, json, html |
| `--output` | - | Output file path |

## Example Output

```
============================================================
  LOAD TEST RESULTS
============================================================

  Summary
  ----------------------------------------
  Total Requests:    5000
  Successful:        4950 (99.0%)
  Failed:            50 (1.0%)
  Duration:          30.15s
  Requests/sec:      165.83
  Data transferred:  12.4MB

  Response Times
  ----------------------------------------
  Min:       2.15ms
  Max:       1523.40ms
  Avg:       58.32ms
  Median:    42.10ms
  p95:       152.30ms
  p99:       420.15ms

  Response Time Histogram
  ----------------------------------------
  0-10ms         ######## 412
  10-25ms        ############### 780
  25-50ms        ############################## 1520
  50-100ms       ##################### 1050
  100-200ms      ######## 415
  200-500ms      ##### 280
  500-1000ms     ## 38
  1000ms+        # 5
============================================================
```

## Scenario Configuration

```typescript
import { defineScenario } from "./scenarios";

const scenario = defineScenario("User Flow", [
  {
    name: "Login",
    url: "{{baseUrl}}/api/login",
    method: "POST",
    body: { email: "{{email}}", password: "{{password}}" },
    thinkTimeMs: 1000,
  },
  {
    name: "Get Dashboard",
    url: "{{baseUrl}}/api/dashboard",
    method: "GET",
    headers: { Authorization: "Bearer {{token}}" },
    validate: (res) => res.status === 200,
  },
]);
```

## Comparison

| Feature | load-tester | wrk | ab | k6 |
|---------|------------|-----|----|----|
| Node.js native | Yes | No | No | No |
| Scenarios | Yes | Lua | No | Yes |
| HTML reports | Yes | No | No | Yes |
| Rate limiting | Yes | No | No | Yes |
| Ramp-up | Yes | No | No | Yes |
| Percentiles | Yes | Yes | No | Yes |

## License

MIT

---

## Français

**load-tester** est un outil de test de charge HTTP rapide et léger avec métriques détaillées, analyse par percentiles et plusieurs formats de rapport. Il supporte les connexions concurrentes, la montée en charge progressive (ramp-up), la limitation de débit, et génère des rapports en terminal, JSON ou HTML avec distribution des temps de réponse et statistiques p50/p95/p99.

### Installation

```bash
npm install
npm run build
```

### Utilisation

```bash
# Test de charge basique
loadtest run https://example.com

# Test personnalisé avec 50 connexions pendant 60 secondes
loadtest run https://api.example.com/users \
  --concurrent 50 \
  --duration 60 \
  --report html \
  --output ./rapports/resultats.html
```
