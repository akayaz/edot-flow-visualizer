/**
 * Validation Rules Registry
 *
 * Central registry for all validation rules.
 * Import this file to initialize the validation engine with all rules.
 */

import { getValidationEngine } from '../validation-engine';
import { adapterRules } from './existing-validators-adapter';

// Future: Import additional rule sets here
// import { edotSpecificRules } from './edot-validator';
// import { securityRules } from './security-validator';
// import { performanceRules } from './performance-validator';

/**
 * Initialize the validation engine with all rules
 */
export function initializeValidationEngine(): void {
  const engine = getValidationEngine();

  // Register existing validator adapters
  engine.registerRules(adapterRules);

  // Future: Register additional rule sets
  // engine.registerRules(edotSpecificRules);
  // engine.registerRules(securityRules);
  // engine.registerRules(performanceRules);

  console.log(`Validation engine initialized with ${engine.getRules().length} rules`);
}

// Auto-initialize on import
initializeValidationEngine();

// Re-export for convenience
export { getValidationEngine } from '../validation-engine';
export * from './existing-validators-adapter';
