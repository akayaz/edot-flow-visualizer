import { describe, it, expect } from 'vitest';
import { generateSampleApp, hasEdotDistribution } from '../sample-app-generator';
import { EDOT_VERSIONS } from '../versions';
import { assertNoUpstreamOTelReferences } from './edot-assertions';
import type { SDKNodeData } from '../../types';

function makeSDKNode(language: string, serviceName: string = 'test-service'): SDKNodeData {
  return {
    label: serviceName,
    componentType: 'edot-sdk',
    language: language as SDKNodeData['language'],
    serviceName,
    autoInstrumented: true,
  };
}

describe('sample-app-generator', () => {
  describe('Node.js app', () => {
    it('generates package.json with EDOT Node.js SDK', () => {
      const files = generateSampleApp(makeSDKNode('nodejs'));
      const packageJson = JSON.parse(files.get('package.json')!);
      
      expect(packageJson.dependencies).toHaveProperty(EDOT_VERSIONS.nodePackage);
      expect(packageJson.dependencies).not.toHaveProperty('@opentelemetry/auto-instrumentations-node');
    });

    it('generates app.js with Express routes', () => {
      const files = generateSampleApp(makeSDKNode('nodejs'));
      const appJs = files.get('app.js')!;
      
      expect(appJs).toContain('express');
      expect(appJs).toContain('/health');
      expect(appJs).toContain('/api/data');
      expect(appJs).toContain(EDOT_VERSIONS.nodePackage);
    });

    it('uses service name from SDKNodeData', () => {
      const files = generateSampleApp(makeSDKNode('nodejs', 'my-cool-service'));
      const appJs = files.get('app.js')!;
      
      expect(appJs).toContain('my-cool-service');
    });

    it('does not reference upstream OTel packages', () => {
      const files = generateSampleApp(makeSDKNode('nodejs'));
      for (const [, content] of files) {
        assertNoUpstreamOTelReferences(content, 'nodejs');
      }
    });
  });

  describe('Python app', () => {
    it('generates requirements.txt with EDOT Python SDK', () => {
      const files = generateSampleApp(makeSDKNode('python'));
      const requirements = files.get('requirements.txt')!;
      
      expect(requirements).toContain(EDOT_VERSIONS.pythonPackage);
      expect(requirements).not.toContain('opentelemetry-distro');
    });

    it('generates app.py with Flask routes', () => {
      const files = generateSampleApp(makeSDKNode('python'));
      const appPy = files.get('app.py')!;
      
      expect(appPy).toContain('Flask');
      expect(appPy).toContain('/health');
      expect(appPy).toContain('/api/data');
    });

    it('does not reference upstream OTel packages', () => {
      const files = generateSampleApp(makeSDKNode('python'));
      for (const [, content] of files) {
        assertNoUpstreamOTelReferences(content, 'python');
      }
    });
  });

  describe('Java app', () => {
    it('generates pom.xml with Spring Boot dependencies', () => {
      const files = generateSampleApp(makeSDKNode('java'));
      const pomXml = files.get('pom.xml')!;
      
      expect(pomXml).toContain('spring-boot-starter-web');
      expect(pomXml).toContain('spring-boot-starter-parent');
    });

    it('generates Application.java with @SpringBootApplication', () => {
      const files = generateSampleApp(makeSDKNode('java'));
      const appJava = files.get('src/main/java/com/example/Application.java')!;
      
      expect(appJava).toContain('@SpringBootApplication');
      expect(appJava).toContain('/health');
      expect(appJava).toContain('/api/data');
    });

    it('uses service name from SDKNodeData', () => {
      const files = generateSampleApp(makeSDKNode('java', 'order-service'));
      const appJava = files.get('src/main/java/com/example/Application.java')!;
      
      expect(appJava).toContain('order-service');
    });
  });

  describe('.NET app', () => {
    it('generates .csproj with Elastic.OpenTelemetry NuGet ref', () => {
      const files = generateSampleApp(makeSDKNode('dotnet', 'my-dotnet-app'));
      // Find the .csproj file
      const csprojEntry = Array.from(files.entries()).find(([key]) => key.endsWith('.csproj'));
      expect(csprojEntry).toBeTruthy();
      
      const csproj = csprojEntry![1];
      expect(csproj).toContain(EDOT_VERSIONS.dotnetPackage);
    });

    it('generates Program.cs with minimal API', () => {
      const files = generateSampleApp(makeSDKNode('dotnet'));
      const programCs = files.get('Program.cs')!;
      
      expect(programCs).toContain('WebApplication');
      expect(programCs).toContain('/health');
      expect(programCs).toContain('Elastic.OpenTelemetry');
    });
  });

  describe('Go app', () => {
    it('generates go.mod with correct module path', () => {
      const files = generateSampleApp(makeSDKNode('go'));
      const goMod = files.get('go.mod')!;
      
      expect(goMod).toContain('go 1.22');
      expect(goMod).toContain('go.opentelemetry.io/otel');
    });

    it('generates main.go with net/http', () => {
      const files = generateSampleApp(makeSDKNode('go'));
      const mainGo = files.get('main.go')!;
      
      expect(mainGo).toContain('net/http');
      expect(mainGo).toContain('/health');
      expect(mainGo).toContain('otelhttp');
    });
  });

  describe('all languages', () => {
    const languages = ['nodejs', 'python', 'java', 'dotnet', 'go', 'php', 'ruby'];

    for (const lang of languages) {
      it(`generates files for ${lang}`, () => {
        const files = generateSampleApp(makeSDKNode(lang));
        expect(files.size).toBeGreaterThan(0);
      });

      it(`uses service name for ${lang}`, () => {
        const files = generateSampleApp(makeSDKNode(lang, 'custom-service'));
        let found = false;
        for (const [, content] of files) {
          if (content.includes('custom-service')) {
            found = true;
            break;
          }
        }
        expect(found).toBe(true);
      });
    }
  });

  describe('hasEdotDistribution', () => {
    it('returns true for nodejs, python, java, dotnet', () => {
      expect(hasEdotDistribution('nodejs')).toBe(true);
      expect(hasEdotDistribution('python')).toBe(true);
      expect(hasEdotDistribution('java')).toBe(true);
      expect(hasEdotDistribution('dotnet')).toBe(true);
    });

    it('returns false for go, php, ruby', () => {
      expect(hasEdotDistribution('go')).toBe(false);
      expect(hasEdotDistribution('php')).toBe(false);
      expect(hasEdotDistribution('ruby')).toBe(false);
    });
  });
});
