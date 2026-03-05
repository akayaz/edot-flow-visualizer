'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useFlowStore } from '../store/flowStore';
import { generateCollectorYAML } from '../lib/yaml-generator';
import { yamlToCollectorConfig, validateYamlSyntax } from '../lib/yaml-to-collector-config';
import type { CollectorNodeData, DeploymentModel } from '../types';

// ============ Types ============

export interface YamlValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface UseYamlEditorReturn {
  /** The current text in the editor */
  editedYaml: string;
  /** Update the editor text */
  setEditedYaml: (value: string) => void;
  /** Whether the editor content differs from the generated YAML */
  isDirty: boolean;
  /** Validation state (debounced) */
  validation: YamlValidation;
  /** Whether validation is in progress (debounce pending) */
  isValidating: boolean;
  /** Apply the edited YAML back to the collector node */
  applyChanges: () => boolean;
  /** Revert editor text to the generated YAML */
  resetToGenerated: () => void;
  /** The generated (source-of-truth) YAML */
  generatedYaml: string;
}

// ============ Constants ============

const VALIDATION_DEBOUNCE_MS = 500;

// ============ Hook ============

/**
 * Custom hook encapsulating YAML editor state with debounced validation.
 *
 * State is local (React useState/useRef) — ephemeral, no Zustand needed.
 * Validation runs after a 500ms debounce to avoid lag while typing.
 *
 * @param nodeId - The ID of the collector node being edited
 * @param nodeData - The current collector node data
 * @param deploymentModel - Current deployment model for YAML generation
 */
export function useYamlEditor(
  nodeId: string,
  nodeData: CollectorNodeData,
  deploymentModel: DeploymentModel
): UseYamlEditorReturn {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);

  // Generate the "source of truth" YAML from current node data
  const generatedYaml = useMemo(
    () => generateCollectorYAML(nodeData, { deploymentModel }),
    [nodeData, deploymentModel]
  );

  // Editor state
  const [editedYaml, setEditedYaml] = useState(generatedYaml);
  const [validation, setValidation] = useState<YamlValidation>({
    isValid: true,
    errors: [],
    warnings: [],
  });
  const [isValidating, setIsValidating] = useState(false);

  // Ref for debounce timer
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Compute isDirty by comparing editor text to generated YAML
  const isDirty = editedYaml !== generatedYaml;

  // Sync editor text when the generated YAML changes (e.g. chip toggles)
  // but only if the user hasn't made edits (not dirty)
  const prevGeneratedRef = useRef(generatedYaml);
  useEffect(() => {
    if (prevGeneratedRef.current !== generatedYaml && !isDirty) {
      setEditedYaml(generatedYaml);
    }
    prevGeneratedRef.current = generatedYaml;
  }, [generatedYaml, isDirty]);

  // Debounced validation effect
  useEffect(() => {
    setIsValidating(true);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      // Quick syntax check first
      const syntaxError = validateYamlSyntax(editedYaml);
      if (syntaxError) {
        setValidation({
          isValid: false,
          errors: [syntaxError],
          warnings: [],
        });
        setIsValidating(false);
        return;
      }

      // Full structural validation
      const result = yamlToCollectorConfig(editedYaml);
      setValidation({
        isValid: result.errors.length === 0,
        errors: result.errors,
        warnings: result.warnings,
      });
      setIsValidating(false);
    }, VALIDATION_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [editedYaml]);

  // Apply changes: parse YAML → update node data
  const applyChanges = useCallback((): boolean => {
    const result = yamlToCollectorConfig(editedYaml);

    if (result.errors.length > 0 || !result.config) {
      // Update validation to show errors
      setValidation({
        isValid: false,
        errors: result.errors,
        warnings: result.warnings,
      });
      return false;
    }

    // Apply the parsed config to the node
    updateNodeData(nodeId, { config: result.config });

    // After applying, the generated YAML will update via the store change,
    // and the editor will resync on next render if not dirty.
    // We DON'T reset editedYaml here — the useEffect above handles it
    // once generatedYaml updates from the store change.
    return true;
  }, [editedYaml, nodeId, updateNodeData]);

  // Reset editor to generated YAML
  const resetToGenerated = useCallback(() => {
    setEditedYaml(generatedYaml);
    setValidation({ isValid: true, errors: [], warnings: [] });
  }, [generatedYaml]);

  return {
    editedYaml,
    setEditedYaml,
    isDirty,
    validation,
    isValidating,
    applyChanges,
    resetToGenerated,
    generatedYaml,
  };
}
