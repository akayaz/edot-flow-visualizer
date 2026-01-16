'use client';

import { memo, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileCode, AlertCircle, CheckCircle, X, FileText } from 'lucide-react';
import type { DetectionResult, DetectionWarning } from '../../lib/detection/types';
import { parseOtelCollectorYaml, parseMultiDocumentYaml, validateOtelYaml } from '../../lib/detection';

interface FileUploaderProps {
  onFileParsed: (result: DetectionResult) => void;
  onError: (error: string) => void;
  acceptedTypes?: string[];
  maxFileSize?: number; // in bytes
}

interface UploadedFile {
  name: string;
  size: number;
  type: string;
  content: string;
}

interface ParsePreview {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  nodeCount: number;
  edgeCount: number;
}

export const FileUploader = memo(({
  onFileParsed,
  onError,
  acceptedTypes = ['.yaml', '.yml', '.json'],
  maxFileSize = 5 * 1024 * 1024, // 5MB default
}: FileUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [parsePreview, setParsePreview] = useState<ParsePreview | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const processFile = useCallback(async (file: File) => {
    // Validate file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedTypes.includes(fileExtension)) {
      onError(`Invalid file type. Accepted types: ${acceptedTypes.join(', ')}`);
      return;
    }

    // Validate file size
    if (file.size > maxFileSize) {
      onError(`File too large. Maximum size: ${Math.round(maxFileSize / 1024 / 1024)}MB`);
      return;
    }

    setIsProcessing(true);

    try {
      const content = await file.text();

      setUploadedFile({
        name: file.name,
        size: file.size,
        type: file.type,
        content,
      });

      // Validate the YAML
      const validation = validateOtelYaml(content);

      // Parse to get preview
      const result = content.includes('---')
        ? parseMultiDocumentYaml(content)
        : parseOtelCollectorYaml(content);

      setParsePreview({
        isValid: validation.isValid && result.confidence > 0.3,
        errors: validation.errors,
        warnings: [...validation.warnings, ...result.warnings.map(w => w.message)],
        nodeCount: result.nodes.length,
        edgeCount: result.edges.length,
      });

    } catch (error) {
      onError(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setUploadedFile(null);
      setParsePreview(null);
    } finally {
      setIsProcessing(false);
    }
  }, [acceptedTypes, maxFileSize, onError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  }, [processFile]);

  const handleApply = useCallback(() => {
    if (!uploadedFile) return;

    setIsProcessing(true);

    try {
      const result = uploadedFile.content.includes('---')
        ? parseMultiDocumentYaml(uploadedFile.content)
        : parseOtelCollectorYaml(uploadedFile.content);

      onFileParsed(result);
    } catch (error) {
      onError(`Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [uploadedFile, onFileParsed, onError]);

  const handleClear = useCallback(() => {
    setUploadedFile(null);
    setParsePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <motion.div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        animate={{
          borderColor: isDragging ? 'rgb(34, 211, 238)' : 'rgb(55, 65, 81)',
          backgroundColor: isDragging ? 'rgba(34, 211, 238, 0.05)' : 'transparent',
        }}
        className={`
          relative border-2 border-dashed rounded-xl p-8 cursor-pointer
          transition-colors hover:border-cyan-500/50 hover:bg-cyan-500/5
          ${isProcessing ? 'pointer-events-none opacity-50' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-3 text-center">
          <motion.div
            animate={{ scale: isDragging ? 1.1 : 1 }}
            className="p-3 bg-gray-800 rounded-xl"
          >
            <Upload size={24} className="text-cyan-400" />
          </motion.div>

          <div>
            <p className="text-white font-medium">
              {isDragging ? 'Drop your file here' : 'Drag & drop your config file'}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              or click to browse
            </p>
          </div>

          <div className="flex flex-wrap gap-2 justify-center mt-2">
            {acceptedTypes.map((type) => (
              <span
                key={type}
                className="px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded"
              >
                {type}
              </span>
            ))}
          </div>
        </div>

        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 rounded-xl">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full"
            />
          </div>
        )}
      </motion.div>

      {/* Uploaded File Preview */}
      <AnimatePresence>
        {uploadedFile && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden"
          >
            {/* File info header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-700/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-700 rounded-lg">
                  <FileCode size={16} className="text-cyan-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{uploadedFile.name}</p>
                  <p className="text-gray-400 text-xs">{formatFileSize(uploadedFile.size)}</p>
                </div>
              </div>
              <button
                onClick={handleClear}
                className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X size={16} className="text-gray-400" />
              </button>
            </div>

            {/* Parse Preview */}
            {parsePreview && (
              <div className="p-3 space-y-3">
                {/* Status */}
                <div className="flex items-center gap-2">
                  {parsePreview.isValid ? (
                    <>
                      <CheckCircle size={16} className="text-green-400" />
                      <span className="text-green-400 text-sm">Valid configuration</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={16} className="text-red-400" />
                      <span className="text-red-400 text-sm">Invalid configuration</span>
                    </>
                  )}
                </div>

                {/* Detection summary */}
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-xs">Nodes:</span>
                    <span className="text-white text-sm font-medium">{parsePreview.nodeCount}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-xs">Connections:</span>
                    <span className="text-white text-sm font-medium">{parsePreview.edgeCount}</span>
                  </div>
                </div>

                {/* Errors */}
                {parsePreview.errors.length > 0 && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                    <p className="text-red-400 text-xs font-medium mb-1">Errors:</p>
                    <ul className="text-red-300 text-xs space-y-0.5">
                      {parsePreview.errors.map((error, i) => (
                        <li key={i}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Warnings */}
                {parsePreview.warnings.length > 0 && (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2">
                    <p className="text-yellow-400 text-xs font-medium mb-1">Warnings:</p>
                    <ul className="text-yellow-300 text-xs space-y-0.5">
                      {parsePreview.warnings.slice(0, 3).map((warning, i) => (
                        <li key={i}>• {warning}</li>
                      ))}
                      {parsePreview.warnings.length > 3 && (
                        <li className="text-yellow-400">
                          +{parsePreview.warnings.length - 3} more warnings
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Content preview */}
                <details className="group">
                  <summary className="cursor-pointer text-gray-400 text-xs hover:text-white flex items-center gap-1">
                    <FileText size={12} />
                    Preview content
                  </summary>
                  <pre className="mt-2 p-2 bg-gray-900 rounded-lg text-xs text-gray-300 overflow-auto max-h-32 font-mono">
                    {uploadedFile.content.slice(0, 500)}
                    {uploadedFile.content.length > 500 && '...'}
                  </pre>
                </details>

                {/* Apply button */}
                <motion.button
                  onClick={handleApply}
                  disabled={!parsePreview.isValid || isProcessing}
                  whileHover={{ scale: parsePreview.isValid ? 1.02 : 1 }}
                  whileTap={{ scale: parsePreview.isValid ? 0.98 : 1 }}
                  className={`
                    w-full py-2.5 rounded-lg font-medium text-sm transition-colors
                    ${parsePreview.isValid
                      ? 'bg-cyan-500 hover:bg-cyan-400 text-white'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }
                  `}
                >
                  {isProcessing ? 'Processing...' : 'Apply to Canvas'}
                </motion.button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

FileUploader.displayName = 'FileUploader';
