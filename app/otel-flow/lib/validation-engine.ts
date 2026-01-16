import type {
  ValidationRule,
  ValidationContext,
  EnhancedValidationResult,
  GroupedValidationResults,
} from '../types';

/**
 * Validation Engine
 *
 * Central engine for running all validation rules against the topology.
 * Manages rule registration, execution, and result aggregation.
 */
export class ValidationEngine {
  private rules: ValidationRule[] = [];

  constructor() {
    // Rules will be registered by importing and calling registerRules()
  }

  /**
   * Register one or more validation rules
   */
  registerRules(rules: ValidationRule[]): void {
    this.rules.push(...rules);
  }

  /**
   * Register a single validation rule
   */
  registerRule(rule: ValidationRule): void {
    this.rules.push(rule);
  }

  /**
   * Get all registered rules
   */
  getRules(): ValidationRule[] {
    return [...this.rules];
  }

  /**
   * Get enabled rules only
   */
  getEnabledRules(): ValidationRule[] {
    return this.rules.filter((rule) => rule.enabled);
  }

  /**
   * Enable or disable a specific rule by ID
   */
  setRuleEnabled(ruleId: string, enabled: boolean): void {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  /**
   * Run all enabled validation rules and return all results
   */
  validate(context: ValidationContext): EnhancedValidationResult[] {
    const allResults: EnhancedValidationResult[] = [];
    const enabledRules = this.getEnabledRules();

    for (const rule of enabledRules) {
      try {
        const ruleResults = rule.validate(context);
        allResults.push(...ruleResults);
      } catch (error) {
        console.error(`Validation rule ${rule.id} failed:`, error);
        // Add error result so user knows something went wrong
        allResults.push({
          id: `${rule.id}_error`,
          code: 'ENGINE_ERROR',
          severity: 'warning',
          category: 'configuration',
          message: `Validation rule "${rule.name}" encountered an error`,
          suggestion: 'This is a bug in the validation system. Please report it.',
        });
      }
    }

    return allResults;
  }

  /**
   * Validate and return results grouped by severity
   */
  validateGrouped(context: ValidationContext): GroupedValidationResults {
    const results = this.validate(context);

    const errors = results.filter((r) => r.severity === 'error');
    const warnings = results.filter((r) => r.severity === 'warning');
    const info = results.filter((r) => r.severity === 'info');

    return {
      errors,
      warnings,
      info,
      total: results.length,
      hasErrors: errors.length > 0,
      hasWarnings: warnings.length > 0,
    };
  }

  /**
   * Validate a specific node and return its issues
   */
  validateNode(nodeId: string, context: ValidationContext): EnhancedValidationResult[] {
    const allResults = this.validate(context);
    return allResults.filter(
      (result) => result.component?.nodeId === nodeId
    );
  }

  /**
   * Validate a specific edge and return its issues
   */
  validateEdge(edgeId: string, context: ValidationContext): EnhancedValidationResult[] {
    const allResults = this.validate(context);
    return allResults.filter(
      (result) => result.component?.edgeId === edgeId
    );
  }

  /**
   * Get count of errors
   */
  getErrorCount(results: EnhancedValidationResult[]): number {
    return results.filter((r) => r.severity === 'error').length;
  }

  /**
   * Get count of warnings
   */
  getWarningCount(results: EnhancedValidationResult[]): number {
    return results.filter((r) => r.severity === 'warning').length;
  }

  /**
   * Get count of info messages
   */
  getInfoCount(results: EnhancedValidationResult[]): number {
    return results.filter((r) => r.severity === 'info').length;
  }

  /**
   * Check if validation has any blocking errors
   */
  hasBlockingErrors(results: EnhancedValidationResult[]): boolean {
    return results.some((r) => r.severity === 'error');
  }

  /**
   * Get auto-fixable issues
   */
  getAutoFixableIssues(results: EnhancedValidationResult[]): EnhancedValidationResult[] {
    return results.filter((r) => r.autoFixable === true);
  }

  /**
   * Clear all registered rules (useful for testing)
   */
  clearRules(): void {
    this.rules = [];
  }
}

/**
 * Singleton instance of the validation engine
 */
let engineInstance: ValidationEngine | null = null;

/**
 * Get the global validation engine instance
 */
export function getValidationEngine(): ValidationEngine {
  if (!engineInstance) {
    engineInstance = new ValidationEngine();
  }
  return engineInstance;
}

/**
 * Reset the global validation engine (useful for testing)
 */
export function resetValidationEngine(): void {
  engineInstance = null;
}
