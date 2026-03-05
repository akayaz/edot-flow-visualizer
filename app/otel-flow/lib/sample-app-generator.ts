import type { SDKNodeData, SDKLanguage } from '../types';
import { EDOT_VERSIONS, EDOT_JAVA_AGENT_URL } from './versions';

/**
 * Generate sample application source code for a given SDK language.
 * All apps use EDOT SDK packages (not upstream OTel).
 * Returns a Map<string, string> of filename → content.
 */
export function generateSampleApp(nodeData: SDKNodeData): Map<string, string> {
  const serviceName = nodeData.serviceName || 'my-service';
  const language = nodeData.language;

  switch (language) {
    case 'nodejs':
      return generateNodeJSApp(serviceName);
    case 'python':
      return generatePythonApp(serviceName);
    case 'java':
      return generateJavaApp(serviceName);
    case 'dotnet':
      return generateDotNetApp(serviceName);
    case 'go':
      return generateGoApp(serviceName);
    case 'php':
      return generatePHPApp(serviceName);
    case 'ruby':
      return generateRubyApp(serviceName);
    default:
      return generateNodeJSApp(serviceName);
  }
}

/**
 * Returns the list of languages that have EDOT SDK distributions.
 */
export function hasEdotDistribution(language: SDKLanguage): boolean {
  return ['nodejs', 'python', 'java', 'dotnet'].includes(language);
}

// ============================================
// Node.js - uses @elastic/opentelemetry-node
// ============================================

function generateNodeJSApp(serviceName: string): Map<string, string> {
  const files = new Map<string, string>();

  files.set('package.json', JSON.stringify({
    name: serviceName,
    version: '1.0.0',
    description: `${serviceName} - Instrumented with EDOT Node.js SDK`,
    main: 'app.js',
    scripts: {
      start: `node --require ${EDOT_VERSIONS.nodePackage}/start app.js`,
      dev: `node --require ${EDOT_VERSIONS.nodePackage}/start --watch app.js`,
    },
    dependencies: {
      [EDOT_VERSIONS.nodePackage]: 'latest',
      express: '^4.18.2',
    },
  }, null, 2));

  files.set('app.js', `// ${serviceName} - Instrumented with EDOT Node.js SDK
// Auto-instrumentation is enabled via: node --require ${EDOT_VERSIONS.nodePackage}/start app.js
// EDOT automatically instruments Express, HTTP, and other popular libraries.
//
// Required environment variables:
//   OTEL_SERVICE_NAME          - Service name for telemetry (default: ${serviceName})
//   OTEL_EXPORTER_OTLP_ENDPOINT - OTLP collector endpoint (e.g., http://edot-collector:4318)
//   OTEL_EXPORTER_OTLP_PROTOCOL - Protocol (http/protobuf recommended)

const express = require('express');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: '${serviceName}' });
});

// Main endpoint - generates traces automatically via EDOT auto-instrumentation
app.get('/', (req, res) => {
  res.json({
    message: 'Hello from ${serviceName}!',
    timestamp: new Date().toISOString(),
    service: process.env.OTEL_SERVICE_NAME || '${serviceName}',
  });
});

// API endpoint with simulated work
app.get('/api/data', async (req, res) => {
  // Simulate some async work (generates spans automatically)
  const start = Date.now();
  await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
  const duration = Date.now() - start;

  res.json({
    data: [
      { id: 1, name: 'Item 1', value: Math.random() * 100 },
      { id: 2, name: 'Item 2', value: Math.random() * 100 },
      { id: 3, name: 'Item 3', value: Math.random() * 100 },
    ],
    processingTimeMs: duration,
    service: process.env.OTEL_SERVICE_NAME || '${serviceName}',
  });
});

// POST endpoint for testing trace propagation
app.post('/api/process', (req, res) => {
  const { payload } = req.body || {};
  res.json({
    processed: true,
    payload,
    processedAt: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(\`\${process.env.OTEL_SERVICE_NAME || '${serviceName}'} listening on port \${PORT}\`);
  console.log('EDOT auto-instrumentation active via ${EDOT_VERSIONS.nodePackage}');
});
`);

  return files;
}

// ============================================
// Python - uses elastic-opentelemetry
// ============================================

function generatePythonApp(serviceName: string): Map<string, string> {
  const files = new Map<string, string>();

  files.set('requirements.txt', `# ${serviceName} - EDOT Python SDK dependencies
# Uses Elastic's Distribution of OpenTelemetry (EDOT)
flask>=3.0.0
${EDOT_VERSIONS.pythonPackage}
`);

  files.set('app.py', `"""${serviceName} - Instrumented with EDOT Python SDK.

Auto-instrumentation is enabled via:
  1. edot-bootstrap --action=install  (installs instrumentation packages)
  2. opentelemetry-instrument python app.py  (runs with auto-instrumentation)

EDOT automatically instruments Flask, requests, and other popular libraries.

Required environment variables:
  OTEL_SERVICE_NAME          - Service name for telemetry (default: ${serviceName})
  OTEL_EXPORTER_OTLP_ENDPOINT - OTLP collector endpoint (e.g., http://edot-collector:4318)
  OTEL_EXPORTER_OTLP_PROTOCOL - Protocol (http/protobuf recommended)
"""

import os
import time
import random
from flask import Flask, jsonify, request

app = Flask(__name__)

SERVICE_NAME = os.environ.get("OTEL_SERVICE_NAME", "${serviceName}")


@app.route("/health")
def health():
    """Health check endpoint."""
    return jsonify({"status": "healthy", "service": SERVICE_NAME})


@app.route("/")
def index():
    """Main endpoint - generates traces automatically via EDOT auto-instrumentation."""
    return jsonify({
        "message": f"Hello from {SERVICE_NAME}!",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "service": SERVICE_NAME,
    })


@app.route("/api/data")
def get_data():
    """API endpoint with simulated work."""
    start = time.time()
    # Simulate async work (generates spans automatically)
    time.sleep(random.uniform(0.01, 0.1))
    duration = (time.time() - start) * 1000

    return jsonify({
        "data": [
            {"id": 1, "name": "Item 1", "value": round(random.random() * 100, 2)},
            {"id": 2, "name": "Item 2", "value": round(random.random() * 100, 2)},
            {"id": 3, "name": "Item 3", "value": round(random.random() * 100, 2)},
        ],
        "processingTimeMs": round(duration, 2),
        "service": SERVICE_NAME,
    })


@app.route("/api/process", methods=["POST"])
def process_data():
    """POST endpoint for testing trace propagation."""
    payload = request.get_json(silent=True) or {}
    return jsonify({
        "processed": True,
        "payload": payload,
        "processedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    print(f"{SERVICE_NAME} listening on port {port}")
    print(f"EDOT auto-instrumentation active via {__import__('${EDOT_VERSIONS.pythonPackage}'.replace('-', '_')).__name__ if False else '${EDOT_VERSIONS.pythonPackage}'}")
    app.run(host="0.0.0.0", port=port)
`);

  return files;
}

// ============================================
// Java - uses elastic-otel-javaagent
// ============================================

function generateJavaApp(serviceName: string): Map<string, string> {
  const files = new Map<string, string>();

  const artifactId = serviceName.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  files.set('pom.xml', `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.0</version>
        <relativePath/>
    </parent>

    <groupId>com.example</groupId>
    <artifactId>${artifactId}</artifactId>
    <version>1.0.0</version>
    <name>${serviceName}</name>
    <description>${serviceName} - Instrumented with EDOT Java Agent</description>

    <properties>
        <java.version>21</java.version>
    </properties>

    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-actuator</artifactId>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>
`);

  files.set('src/main/java/com/example/Application.java', `package com.example;

// ${serviceName} - Instrumented with EDOT Java Agent
// Auto-instrumentation is enabled via: -javaagent:/otel/elastic-otel-javaagent.jar
// EDOT automatically instruments Spring Boot, JDBC, and other popular libraries.
//
// Required environment variables:
//   OTEL_SERVICE_NAME          - Service name for telemetry (default: ${serviceName})
//   OTEL_EXPORTER_OTLP_ENDPOINT - OTLP collector endpoint
//   OTEL_EXPORTER_OTLP_PROTOCOL - Protocol (http/protobuf recommended)

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;

@SpringBootApplication
@RestController
public class Application {

    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of(
            "status", "healthy",
            "service", System.getenv().getOrDefault("OTEL_SERVICE_NAME", "${serviceName}")
        );
    }

    @GetMapping("/")
    public Map<String, Object> index() {
        return Map.of(
            "message", "Hello from ${serviceName}!",
            "timestamp", Instant.now().toString(),
            "service", System.getenv().getOrDefault("OTEL_SERVICE_NAME", "${serviceName}")
        );
    }

    @GetMapping("/api/data")
    public Map<String, Object> getData() throws InterruptedException {
        long start = System.currentTimeMillis();
        // Simulate some work
        Thread.sleep((long) (Math.random() * 100));
        long duration = System.currentTimeMillis() - start;

        Random random = new Random();
        List<Map<String, Object>> data = List.of(
            Map.of("id", 1, "name", "Item 1", "value", random.nextDouble() * 100),
            Map.of("id", 2, "name", "Item 2", "value", random.nextDouble() * 100),
            Map.of("id", 3, "name", "Item 3", "value", random.nextDouble() * 100)
        );

        return Map.of(
            "data", data,
            "processingTimeMs", duration,
            "service", System.getenv().getOrDefault("OTEL_SERVICE_NAME", "${serviceName}")
        );
    }

    @PostMapping("/api/process")
    public Map<String, Object> processData(@RequestBody(required = false) Map<String, Object> payload) {
        return Map.of(
            "processed", true,
            "payload", payload != null ? payload : Map.of(),
            "processedAt", Instant.now().toString()
        );
    }
}
`);

  // Maven wrapper for build
  files.set('mvnw', `#!/bin/sh
exec mvn "$@"
`);

  return files;
}

// ============================================
// .NET - uses Elastic.OpenTelemetry
// ============================================

function generateDotNetApp(serviceName: string): Map<string, string> {
  const files = new Map<string, string>();

  const projectName = serviceName.replace(/[^a-zA-Z0-9]/g, '');

  files.set(`${projectName}.csproj`, `<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>

  <ItemGroup>
    <!-- EDOT .NET SDK (NOT upstream OpenTelemetry package) -->
    <PackageReference Include="${EDOT_VERSIONS.dotnetPackage}" Version="*" />
  </ItemGroup>

</Project>
`);

  files.set('Program.cs', `// ${serviceName} - Instrumented with EDOT .NET SDK (${EDOT_VERSIONS.dotnetPackage})
// EDOT automatically instruments ASP.NET Core, HttpClient, and other popular libraries.
//
// Required environment variables:
//   OTEL_SERVICE_NAME          - Service name for telemetry (default: ${serviceName})
//   OTEL_EXPORTER_OTLP_ENDPOINT - OTLP collector endpoint
//   OTEL_EXPORTER_OTLP_PROTOCOL - Protocol (http/protobuf recommended)

using Elastic.OpenTelemetry;

var builder = WebApplication.CreateBuilder(args);

// Register EDOT OpenTelemetry SDK
builder.Services.AddElasticOpenTelemetry();

var app = builder.Build();

app.MapGet("/health", () => new
{
    Status = "healthy",
    Service = Environment.GetEnvironmentVariable("OTEL_SERVICE_NAME") ?? "${serviceName}"
});

app.MapGet("/", () => new
{
    Message = "Hello from ${serviceName}!",
    Timestamp = DateTime.UtcNow.ToString("o"),
    Service = Environment.GetEnvironmentVariable("OTEL_SERVICE_NAME") ?? "${serviceName}"
});

app.MapGet("/api/data", async () =>
{
    var start = DateTime.UtcNow;
    // Simulate some work
    await Task.Delay(Random.Shared.Next(10, 100));
    var duration = (DateTime.UtcNow - start).TotalMilliseconds;

    return new
    {
        Data = new[]
        {
            new { Id = 1, Name = "Item 1", Value = Random.Shared.NextDouble() * 100 },
            new { Id = 2, Name = "Item 2", Value = Random.Shared.NextDouble() * 100 },
            new { Id = 3, Name = "Item 3", Value = Random.Shared.NextDouble() * 100 },
        },
        ProcessingTimeMs = Math.Round(duration, 2),
        Service = Environment.GetEnvironmentVariable("OTEL_SERVICE_NAME") ?? "${serviceName}"
    };
});

app.MapPost("/api/process", (object? payload) => new
{
    Processed = true,
    Payload = payload,
    ProcessedAt = DateTime.UtcNow.ToString("o")
});

app.Run();
`);

  return files;
}

// ============================================
// Go - uses upstream OTel Go SDK (no EDOT Go SDK yet)
// ============================================

function generateGoApp(serviceName: string): Map<string, string> {
  const files = new Map<string, string>();

  const moduleName = serviceName.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  files.set('go.mod', `module ${moduleName}

go 1.22

require (
\tgo.opentelemetry.io/otel v1.28.0
\tgo.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.28.0
\tgo.opentelemetry.io/otel/sdk v1.28.0
\tgo.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.53.0
)
`);

  files.set('main.go', `package main

// ${serviceName} - Instrumented with upstream OTel Go SDK
// Note: No EDOT Go SDK exists yet, so we use the upstream OpenTelemetry Go SDK.
//
// Required environment variables:
//   OTEL_SERVICE_NAME          - Service name for telemetry (default: ${serviceName})
//   OTEL_EXPORTER_OTLP_ENDPOINT - OTLP collector endpoint

import (
\t"encoding/json"
\t"fmt"
\t"log"
\t"math/rand"
\t"net/http"
\t"os"
\t"time"

\t"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
)

func main() {
\tport := os.Getenv("PORT")
\tif port == "" {
\t\tport = "8080"
\t}

\tserviceName := os.Getenv("OTEL_SERVICE_NAME")
\tif serviceName == "" {
\t\tserviceName = "${serviceName}"
\t}

\tmux := http.NewServeMux()

\tmux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
\t\tjson.NewEncoder(w).Encode(map[string]interface{}{
\t\t\t"status":  "healthy",
\t\t\t"service": serviceName,
\t\t})
\t})

\tmux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
\t\tjson.NewEncoder(w).Encode(map[string]interface{}{
\t\t\t"message":   fmt.Sprintf("Hello from %s!", serviceName),
\t\t\t"timestamp": time.Now().UTC().Format(time.RFC3339),
\t\t\t"service":   serviceName,
\t\t})
\t})

\tmux.HandleFunc("/api/data", func(w http.ResponseWriter, r *http.Request) {
\t\tstart := time.Now()
\t\ttime.Sleep(time.Duration(rand.Intn(100)) * time.Millisecond)
\t\tduration := time.Since(start).Milliseconds()

\t\tjson.NewEncoder(w).Encode(map[string]interface{}{
\t\t\t"data": []map[string]interface{}{
\t\t\t\t{"id": 1, "name": "Item 1", "value": rand.Float64() * 100},
\t\t\t\t{"id": 2, "name": "Item 2", "value": rand.Float64() * 100},
\t\t\t\t{"id": 3, "name": "Item 3", "value": rand.Float64() * 100},
\t\t\t},
\t\t\t"processingTimeMs": duration,
\t\t\t"service":          serviceName,
\t\t})
\t})

\t// Wrap with OTel HTTP instrumentation
\thandler := otelhttp.NewHandler(mux, "server")

\tlog.Printf("%s listening on port %s", serviceName, port)
\tlog.Printf("Using upstream OTel Go SDK (no EDOT Go SDK available yet)")
\tlog.Fatal(http.ListenAndServe(":"+port, handler))
}
`);

  return files;
}

// ============================================
// PHP - uses upstream OTel (no EDOT PHP SDK yet)
// ============================================

function generatePHPApp(serviceName: string): Map<string, string> {
  const files = new Map<string, string>();

  files.set('composer.json', JSON.stringify({
    name: `example/${serviceName}`,
    description: `${serviceName} - Instrumented with upstream OTel PHP SDK`,
    require: {
      'php': '>=8.3',
      'open-telemetry/sdk': '^1.0',
      'open-telemetry/exporter-otlp': '^1.0',
    },
  }, null, 2));

  files.set('index.php', `<?php
// ${serviceName} - Instrumented with upstream OTel PHP SDK
// Note: No EDOT PHP SDK exists yet, so we use the upstream OpenTelemetry PHP SDK.
//
// Required environment variables:
//   OTEL_SERVICE_NAME          - Service name for telemetry
//   OTEL_EXPORTER_OTLP_ENDPOINT - OTLP collector endpoint

header('Content-Type: application/json');

$serviceName = getenv('OTEL_SERVICE_NAME') ?: '${serviceName}';

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

switch ($path) {
    case '/health':
        echo json_encode(['status' => 'healthy', 'service' => $serviceName]);
        break;
    case '/api/data':
        $start = microtime(true);
        usleep(rand(10000, 100000));
        $duration = (microtime(true) - $start) * 1000;
        echo json_encode([
            'data' => [
                ['id' => 1, 'name' => 'Item 1', 'value' => rand(0, 10000) / 100],
                ['id' => 2, 'name' => 'Item 2', 'value' => rand(0, 10000) / 100],
                ['id' => 3, 'name' => 'Item 3', 'value' => rand(0, 10000) / 100],
            ],
            'processingTimeMs' => round($duration, 2),
            'service' => $serviceName,
        ]);
        break;
    default:
        echo json_encode([
            'message' => "Hello from $serviceName!",
            'timestamp' => date('c'),
            'service' => $serviceName,
        ]);
}
`);

  return files;
}

// ============================================
// Ruby - uses upstream OTel (no EDOT Ruby SDK yet)
// ============================================

function generateRubyApp(serviceName: string): Map<string, string> {
  const files = new Map<string, string>();

  files.set('Gemfile', `# ${serviceName} - Instrumented with upstream OTel Ruby SDK
# Note: No EDOT Ruby SDK exists yet, so we use the upstream OpenTelemetry Ruby SDK.
source 'https://rubygems.org'

gem 'sinatra', '~> 4.0'
gem 'puma', '~> 6.0'
gem 'opentelemetry-sdk', '~> 1.0'
gem 'opentelemetry-exporter-otlp', '~> 0.27'
gem 'opentelemetry-instrumentation-sinatra', '~> 0.24'
`);

  files.set('app.rb', `# ${serviceName} - Instrumented with upstream OTel Ruby SDK
# Note: No EDOT Ruby SDK exists yet, so we use the upstream OpenTelemetry Ruby SDK.
#
# Required environment variables:
#   OTEL_SERVICE_NAME          - Service name for telemetry
#   OTEL_EXPORTER_OTLP_ENDPOINT - OTLP collector endpoint

require 'sinatra'
require 'json'

set :port, ENV.fetch('PORT', 8080).to_i
set :bind, '0.0.0.0'

SERVICE_NAME = ENV.fetch('OTEL_SERVICE_NAME', '${serviceName}')

get '/health' do
  content_type :json
  { status: 'healthy', service: SERVICE_NAME }.to_json
end

get '/' do
  content_type :json
  {
    message: "Hello from #{SERVICE_NAME}!",
    timestamp: Time.now.utc.iso8601,
    service: SERVICE_NAME
  }.to_json
end

get '/api/data' do
  content_type :json
  start = Process.clock_gettime(Process::CLOCK_MONOTONIC)
  sleep(rand * 0.1)
  duration = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - start) * 1000).round(2)

  {
    data: [
      { id: 1, name: 'Item 1', value: (rand * 100).round(2) },
      { id: 2, name: 'Item 2', value: (rand * 100).round(2) },
      { id: 3, name: 'Item 3', value: (rand * 100).round(2) }
    ],
    processingTimeMs: duration,
    service: SERVICE_NAME
  }.to_json
end

post '/api/process' do
  content_type :json
  payload = JSON.parse(request.body.read) rescue {}
  {
    processed: true,
    payload: payload,
    processedAt: Time.now.utc.iso8601
  }.to_json
end
`);

  return files;
}
