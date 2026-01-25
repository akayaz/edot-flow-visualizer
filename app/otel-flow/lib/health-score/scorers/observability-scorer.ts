/**
 * Observability Scorer
 *
 * Scores observability coverage (10 points max).
 * Evaluates self-monitoring, resource detection, and metadata enrichment.
 */

import type { ValidationContext, CollectorNodeData } from '../../../types';
import type { CategoryScore, ScoreIssue } from '../types';

export class ObservabilityScorer {
  /**
   * Calculate observability score
   */
  score(context: ValidationContext): CategoryScore {
    let score = 10;
    const issues: ScoreIssue[] = [];
    const strengths: string[] = [];

    const collectors = context.nodes.filter(
      (n) =>
        n.data.componentType === 'collector-agent' ||
        n.data.componentType === 'collector-gateway'
    );

    const agents = collectors.filter((n) => n.data.componentType === 'collector-agent');

    // Check for resourcedetection processor
    const hasResourceDetection = collectors.some((c) => {
      const data = c.data as CollectorNodeData;
      return data.config.processors.some((p) => p.enabled && p.type === 'resourcedetection');
    });

    if (!hasResourceDetection && collectors.length > 0) {
      score -= 3;
      issues.push({
        id: 'no-resource-detection',
        deduction: 3,
        severity: 'minor',
        message: 'Resource detection not enabled',
        suggestion:
          'Enable resourcedetection processor to enrich telemetry with host, cloud, and container metadata',
        category: 'observability',
      });
    } else if (hasResourceDetection) {
      strengths.push('Resource detection enabled for metadata enrichment');
    }

    // Check for hostmetrics receiver on agents
    const hasHostMetrics = agents.some((a) => {
      const data = a.data as CollectorNodeData;
      return data.config.receivers.some((r) => r.enabled && r.type === 'hostmetrics');
    });

    if (hasHostMetrics) {
      strengths.push('Host metrics collection enabled on Agents');
    }

    // Check for k8sattributes in K8s deployments
    const hasK8sAttributes = collectors.some((c) => {
      const data = c.data as CollectorNodeData;
      return data.config.processors.some((p) => p.enabled && p.type === 'k8sattributes');
    });

    if (hasK8sAttributes) {
      strengths.push('Kubernetes metadata enrichment configured');
    }

    return {
      score: Math.max(0, score),
      maxScore: 10,
      percentage: (score / 10) * 100,
      issues,
      strengths,
    };
  }
}
