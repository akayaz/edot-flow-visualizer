import type { SDKLanguage } from '../types';
import { EDOT_VERSIONS, EDOT_JAVA_AGENT_URL } from './versions';

/**
 * Generate a Dockerfile for a given SDK language.
 * All Dockerfiles use EDOT SDK packages (not upstream OTel).
 */
export function generateDockerfile(language: SDKLanguage, serviceName: string): string {
  switch (language) {
    case 'nodejs':
      return generateNodeJSDockerfile(serviceName);
    case 'python':
      return generatePythonDockerfile(serviceName);
    case 'java':
      return generateJavaDockerfile(serviceName);
    case 'dotnet':
      return generateDotNetDockerfile(serviceName);
    case 'go':
      return generateGoDockerfile(serviceName);
    case 'php':
      return generatePHPDockerfile(serviceName);
    case 'ruby':
      return generateRubyDockerfile(serviceName);
    default:
      return generateNodeJSDockerfile(serviceName);
  }
}

// ============================================
// Node.js - uses EDOT Node.js SDK
// ============================================

function generateNodeJSDockerfile(serviceName: string): string {
  return `# ${serviceName} - EDOT Node.js SDK
# Uses ${EDOT_VERSIONS.nodePackage} for auto-instrumentation
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8080
# Start with EDOT Node.js auto-instrumentation
CMD ["node", "--require", "${EDOT_VERSIONS.nodePackage}/start", "app.js"]
`;
}

// ============================================
// Python - uses EDOT Python SDK
// ============================================

function generatePythonDockerfile(serviceName: string): string {
  return `# ${serviceName} - EDOT Python SDK
# Uses ${EDOT_VERSIONS.pythonPackage} for auto-instrumentation
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \\
    edot-bootstrap --action=install
COPY . .
EXPOSE 8080
# Start with EDOT Python auto-instrumentation
CMD ["opentelemetry-instrument", "python", "app.py"]
`;
}

// ============================================
// Java - uses EDOT Java Agent
// ============================================

function generateJavaDockerfile(serviceName: string): string {
  return `# ${serviceName} - EDOT Java Agent
# Uses co.elastic.otel:elastic-otel-javaagent for auto-instrumentation
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY . .
RUN chmod +x mvnw 2>/dev/null || true && \\
    ([ -f mvnw ] && ./mvnw package -DskipTests || mvn package -DskipTests)

FROM eclipse-temurin:21-jre
WORKDIR /app
# Download EDOT Java agent (Elastic distribution)
ADD ${EDOT_JAVA_AGENT_URL} /otel/elastic-otel-javaagent.jar
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
# Start with EDOT Java agent auto-instrumentation
CMD ["java", "-javaagent:/otel/elastic-otel-javaagent.jar", "-jar", "app.jar"]
`;
}

// ============================================
// .NET - uses EDOT .NET SDK
// ============================================

function generateDotNetDockerfile(serviceName: string): string {
  const projectName = serviceName.replace(/[^a-zA-Z0-9]/g, '');
  return `# ${serviceName} - EDOT .NET SDK
# Uses ${EDOT_VERSIONS.dotnetPackage} NuGet package
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app
COPY *.csproj ./
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o out

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app/out .
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
# EDOT .NET SDK is integrated via Elastic.OpenTelemetry NuGet package in Program.cs
CMD ["dotnet", "${projectName}.dll"]
`;
}

// ============================================
// Go - uses upstream OTel Go SDK
// ============================================

function generateGoDockerfile(serviceName: string): string {
  return `# ${serviceName} - upstream OTel Go SDK
# Note: No EDOT Go SDK exists yet
FROM golang:1.22-alpine AS build
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download 2>/dev/null || true
COPY . .
RUN CGO_ENABLED=0 go build -o server .

FROM alpine:3.19
WORKDIR /app
COPY --from=build /app/server .
EXPOSE 8080
CMD ["./server"]
`;
}

// ============================================
// PHP - uses upstream OTel PHP SDK
// ============================================

function generatePHPDockerfile(serviceName: string): string {
  return `# ${serviceName} - upstream OTel PHP SDK
# Note: No EDOT PHP SDK exists yet
FROM php:8.3-apache
WORKDIR /var/www/html
COPY . .
RUN apt-get update && apt-get install -y unzip && \\
    curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer && \\
    composer install --no-dev --optimize-autoloader 2>/dev/null || true
EXPOSE 80
`;
}

// ============================================
// Ruby - uses upstream OTel Ruby SDK
// ============================================

function generateRubyDockerfile(serviceName: string): string {
  return `# ${serviceName} - upstream OTel Ruby SDK
# Note: No EDOT Ruby SDK exists yet
FROM ruby:3.3-slim
WORKDIR /app
COPY Gemfile Gemfile.lock* ./
RUN bundle install --without development test 2>/dev/null || bundle install
COPY . .
EXPOSE 8080
CMD ["ruby", "app.rb"]
`;
}
