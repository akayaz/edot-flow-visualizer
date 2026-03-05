import { describe, it, expect } from 'vitest';
import { generateDockerfile } from '../dockerfile-generator';
import { EDOT_VERSIONS } from '../versions';
import { assertNoUpstreamOTelReferences } from './edot-assertions';

describe('dockerfile-generator', () => {
  const languages = ['nodejs', 'python', 'java', 'dotnet', 'go', 'php', 'ruby'] as const;

  for (const lang of languages) {
    describe(`${lang} Dockerfile`, () => {
      it('has valid Dockerfile structure', () => {
        const dockerfile = generateDockerfile(lang, 'test-service');
        
        expect(dockerfile).toContain('FROM');
        expect(dockerfile).toContain('WORKDIR');
        expect(dockerfile).toContain('EXPOSE');
      });

      it('contains CMD or inherits from base image', () => {
        const dockerfile = generateDockerfile(lang, 'test-service');
        // PHP uses Apache's CMD from base image
        if (lang !== 'php') {
          expect(dockerfile).toContain('CMD');
        }
      });
    });
  }

  describe('Node.js', () => {
    it('CMD contains EDOT Node.js SDK start command', () => {
      const dockerfile = generateDockerfile('nodejs', 'test-service');
      expect(dockerfile).toContain(EDOT_VERSIONS.nodePackage + '/start');
      expect(dockerfile).not.toContain('@opentelemetry/auto-instrumentations-node');
    });

    it('does not reference upstream OTel packages', () => {
      const dockerfile = generateDockerfile('nodejs', 'test-service');
      assertNoUpstreamOTelReferences(dockerfile, 'nodejs');
    });
  });

  describe('Python', () => {
    it('runs edot-bootstrap --action=install', () => {
      const dockerfile = generateDockerfile('python', 'test-service');
      expect(dockerfile).toContain('edot-bootstrap --action=install');
    });

    it('uses opentelemetry-instrument to run', () => {
      const dockerfile = generateDockerfile('python', 'test-service');
      expect(dockerfile).toContain('opentelemetry-instrument');
    });

    it('does not reference upstream OTel packages', () => {
      const dockerfile = generateDockerfile('python', 'test-service');
      assertNoUpstreamOTelReferences(dockerfile, 'python');
    });
  });

  describe('Java', () => {
    it('downloads EDOT Java agent from Maven', () => {
      const dockerfile = generateDockerfile('java', 'test-service');
      expect(dockerfile).toContain('elastic-otel-javaagent');
      expect(dockerfile).not.toContain('opentelemetry-javaagent.jar');
    });

    it('uses -javaagent flag', () => {
      const dockerfile = generateDockerfile('java', 'test-service');
      expect(dockerfile).toContain('-javaagent:/otel/elastic-otel-javaagent.jar');
    });

    it('does not reference upstream OTel packages', () => {
      const dockerfile = generateDockerfile('java', 'test-service');
      assertNoUpstreamOTelReferences(dockerfile, 'java');
    });
  });

  describe('.NET', () => {
    it('references Elastic.OpenTelemetry', () => {
      const dockerfile = generateDockerfile('dotnet', 'test-service');
      expect(dockerfile).toContain(EDOT_VERSIONS.dotnetPackage);
    });
  });

  describe('Go', () => {
    it('uses multi-stage build', () => {
      const dockerfile = generateDockerfile('go', 'test-service');
      expect(dockerfile).toContain('AS build');
      expect(dockerfile).toContain('COPY --from=build');
    });
  });
});
