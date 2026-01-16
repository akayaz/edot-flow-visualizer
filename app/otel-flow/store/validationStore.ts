import { create } from 'zustand';
import type {
  EnhancedValidationResult,
  ValidationContext,
  GroupedValidationResults,
} from '../types';
// Import from validators/index to auto-initialize rules on import
import { getValidationEngine } from '../lib/validators';

/**
 * Validation Store State
 */
interface ValidationStore {
  // State
  validationResults: EnhancedValidationResult[];
  isValidating: boolean;
  showValidationPanel: boolean;
  lastValidatedAt: number | null;

  // Actions
  validateTopology: (context: ValidationContext) => void;
  clearValidations: () => void;
  toggleValidationPanel: () => void;
  setShowValidationPanel: (show: boolean) => void;
  dismissValidation: (id: string) => void;
  getGroupedResults: () => GroupedValidationResults;
  getNodeValidations: (nodeId: string) => EnhancedValidationResult[];
  getEdgeValidations: (edgeId: string) => EnhancedValidationResult[];
}

/**
 * Validation Store
 *
 * Manages validation state and results using the ValidationEngine.
 * Provides real-time validation feedback as users build topologies.
 */
export const useValidationStore = create<ValidationStore>((set, get) => ({
  // Initial state
  validationResults: [],
  isValidating: false,
  showValidationPanel: true,
  lastValidatedAt: null,

  /**
   * Run validation on the current topology
   */
  validateTopology: (context: ValidationContext) => {
    set({ isValidating: true });

    try {
      const engine = getValidationEngine();
      const results = engine.validate(context);

      set({
        validationResults: results,
        isValidating: false,
        lastValidatedAt: Date.now(),
      });
    } catch (error) {
      console.error('Validation failed:', error);
      set({
        isValidating: false,
        validationResults: [
          {
            id: 'validation-error',
            code: 'SYSTEM_ERROR',
            severity: 'error',
            category: 'configuration',
            message: 'Validation system encountered an error',
            suggestion: 'Please refresh the page and try again',
          },
        ],
      });
    }
  },

  /**
   * Clear all validation results
   */
  clearValidations: () => {
    set({
      validationResults: [],
      lastValidatedAt: null,
    });
  },

  /**
   * Toggle validation panel visibility
   */
  toggleValidationPanel: () => {
    set((state) => ({
      showValidationPanel: !state.showValidationPanel,
    }));
  },

  /**
   * Set validation panel visibility
   */
  setShowValidationPanel: (show: boolean) => {
    set({ showValidationPanel: show });
  },

  /**
   * Dismiss a specific validation result
   */
  dismissValidation: (id: string) => {
    set((state) => ({
      validationResults: state.validationResults.filter((r) => r.id !== id),
    }));
  },

  /**
   * Get validation results grouped by severity
   */
  getGroupedResults: (): GroupedValidationResults => {
    const results = get().validationResults;

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
  },

  /**
   * Get validation results for a specific node
   */
  getNodeValidations: (nodeId: string): EnhancedValidationResult[] => {
    return get().validationResults.filter(
      (r) => r.component?.nodeId === nodeId
    );
  },

  /**
   * Get validation results for a specific edge
   */
  getEdgeValidations: (edgeId: string): EnhancedValidationResult[] => {
    return get().validationResults.filter(
      (r) => r.component?.edgeId === edgeId
    );
  },
}));
