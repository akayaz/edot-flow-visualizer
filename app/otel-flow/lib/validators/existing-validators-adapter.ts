/**
 * Adapter for Existing Validators
 *
 * This file bridges the existing validation logic (config-validator.ts, connection-validator.ts)
 * with the new ValidationEngine rule-based system.
 *
 * It wraps existing validators into ValidationRule objects that can be registered
 * with the ValidationEngine while maintaining backward compatibility.
 */

import type {
  ValidationRule,
  ValidationContext,
  EnhancedValidationResult,
  CollectorNodeData,
} from '../../types';
import {
  validateCollectorConfig,
  validateTopology,
  type ValidationIssue,
} from '../config-validator';
import { validateConnection } from '../connection-validator';

/**
 * Convert old ValidationIssue to new EnhancedValidationResult
 */
function convertIssueToResult(
  issue: ValidationIssue,
  nodeId?: string,
  componentType?: 'receiver' | 'processor' | 'exporter'
): EnhancedValidationResult {
  return {
    id: issue.id,
    code: issue.id.toUpperCase().replace(/-/g, '_'),
    severity: issue.severity,
    category: 'configuration', // Default category for existing validators
    message: issue.message,
    suggestion: issue.suggestion,
    component: nodeId
      ? {
          nodeId,
          componentType,
        }
      : undefined,
  };
}

/**
 * Rule: Collector Configuration Validation
 *
 * Wraps the existing validateCollectorConfig function
 */
export const collectorConfigRule: ValidationRule = {
  id: 'collector-config',
  name: 'Collector Configuration',
  description: 'Validates collector receivers, processors, and exporters configuration',
  category: 'configuration',
  severity: 'error',
  enabled: true,
  validate: (context: ValidationContext): EnhancedValidationResult[] => {
    const results: EnhancedValidationResult[] = [];

    // Validate each collector node
    const collectors = context.nodes.filter(
      (node) =>
        node.data.componentType === 'collector-agent' ||
        node.data.componentType === 'collector-gateway'
    );

    for (const collector of collectors) {
      const collectorData = collector.data as CollectorNodeData;
      const validation = validateCollectorConfig(collectorData);

      // Convert errors
      for (const error of validation.errors) {
        results.push(convertIssueToResult(error, collector.id, 'processor'));
      }

      // Convert warnings
      for (const warning of validation.warnings) {
        results.push(convertIssueToResult(warning, collector.id, 'processor'));
      }

      // Convert info
      for (const info of validation.info) {
        results.push(convertIssueToResult(info, collector.id, 'processor'));
      }
    }

    return results;
  },
};

/**
 * Rule: Topology Validation
 *
 * Wraps the existing validateTopology function with deployment model awareness
 */
export const topologyRule: ValidationRule = {
  id: 'topology',
  name: 'Topology Architecture',
  description: 'Validates overall topology structure and data flow based on deployment model',
  category: 'best-practice',
  severity: 'warning',
  enabled: true,
  validate: (context: ValidationContext): EnhancedValidationResult[] => {
    const results: EnhancedValidationResult[] = [];

    // Pass deployment model to topology validation
    const validation = validateTopology(context.nodes, context.edges, {
      deploymentModel: context.deploymentModel,
    });

    // Convert all issues
    const allIssues = [
      ...validation.errors,
      ...validation.warnings,
      ...validation.info,
    ];

    for (const issue of allIssues) {
      results.push({
        id: issue.id,
        code: issue.id.toUpperCase().replace(/-/g, '_'),
        severity: issue.severity,
        category: 'best-practice',
        message: issue.message,
        suggestion: issue.suggestion,
        docsUrl: 'https://www.elastic.co/docs/reference/opentelemetry/architecture/hosts_vms',
      });
    }

    return results;
  },
};

/**
 * Rule: Connection Validation
 *
 * Wraps the existing validateConnection function with deployment model awareness
 */
export const connectionRule: ValidationRule = {
  id: 'connections',
  name: 'Connection Validation',
  description: 'Validates connections between EDOT components based on deployment model',
  category: 'connection',
  severity: 'error',
  enabled: true,
  validate: (context: ValidationContext): EnhancedValidationResult[] => {
    const results: EnhancedValidationResult[] = [];

    for (const edge of context.edges) {
      const sourceNode = context.nodes.find((n) => n.id === edge.source);
      const targetNode = context.nodes.find((n) => n.id === edge.target);

      if (!sourceNode || !targetNode) {
        continue;
      }

      // Pass deployment model to connection validation
      const validation = validateConnection(sourceNode, targetNode, {
        deploymentModel: context.deploymentModel,
      });

      if (!validation.valid) {
        results.push({
          id: `${edge.id}_invalid`,
          code: 'CONN_INVALID',
          severity: 'error',
          category: 'connection',
          message: validation.reason,
          suggestion: 'Remove this connection or connect to a valid component type',
          component: {
            edgeId: edge.id,
            componentType: 'connection',
          },
          docsUrl: 'https://www.elastic.co/docs/reference/opentelemetry/architecture/hosts_vms',
        });
      } else if (validation.warning) {
        results.push({
          id: `${edge.id}_warning`,
          code: 'CONN_WARNING',
          severity: 'warning',
          category: 'best-practice',
          message: validation.warning,
          suggestion: 'Review this connection pattern for your deployment model',
          component: {
            edgeId: edge.id,
            componentType: 'connection',
          },
          docsUrl: 'https://www.elastic.co/docs/reference/opentelemetry/architecture/hosts_vms',
        });
      } else if (validation.info) {
        // Also capture info messages from connection validation
        results.push({
          id: `${edge.id}_info`,
          code: 'CONN_INFO',
          severity: 'info',
          category: 'best-practice',
          message: validation.info,
          component: {
            edgeId: edge.id,
            componentType: 'connection',
          },
        });
      }
    }

    return results;
  },
};

/**
 * All adapter rules for easy registration
 */
export const adapterRules: ValidationRule[] = [
  collectorConfigRule,
  topologyRule,
  connectionRule,
];
