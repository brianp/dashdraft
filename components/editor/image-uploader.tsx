'use client';

import { useState, useCallback, useRef } from 'react';
import { validateAssetFilename, computeAssetDestination, generateImageMarkdown } from '@/lib/assets/pathing';
import { resolveCollision } from '@/lib/assets/collision';
import { saveAsset } from '@/lib/autosave/idb';
import { assetDraftKey } from '@/lib/autosave/keys';
import { ALLOWED_ASSET_TYPES, MAX_ASSET_SIZE } from '@/lib/security/validate';
import type { RepoConfig } from '@/lib/types/api';

interface ImageUploaderProps {
  repoFullName: string;
  currentFilePath: string;
  config: RepoConfig;
  existingAssets: Set<string>;
  onInsert: (markdown: string) => void;
  onAssetAdded: (path: string, mimeType: string, size: number) => void;
}

export function ImageUploader({
  repoFullName,
  currentFilePath,
  config,
  existingAssets,
  onInsert,
  onAssetAdded,
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      // Validate file type
      if (!ALLOWED_ASSET_TYPES.includes(file.type)) {
        setError(`File type ${file.type} is not allowed`);
        return;
      }

      // Validate file size
      if (file.size > MAX_ASSET_SIZE) {
        setError(`File is too large. Maximum size is ${MAX_ASSET_SIZE / 1024 / 1024}MB`);
        return;
      }

      // Validate filename
      const validation = validateAssetFilename(file.name);
      if (!validation.valid) {
        setError(validation.error ?? 'Invalid filename');
        return;
      }

      try {
        setUploading(true);

        // Compute destination path
        let destPath = computeAssetDestination(file.name, currentFilePath, config);

        // Handle collisions
        destPath = resolveCollision(destPath, existingAssets);

        // Read file data
        const arrayBuffer = await file.arrayBuffer();

        // Save to IndexedDB
        const key = assetDraftKey(repoFullName, destPath);
        await saveAsset(key, arrayBuffer, file.type);

        // Notify parent of new asset
        onAssetAdded(destPath, file.type, file.size);

        // Generate and insert markdown
        const altText = file.name.replace(/\.[^/.]+$/, ''); // Remove extension for alt text
        const markdown = generateImageMarkdown(destPath, currentFilePath, altText);
        onInsert(markdown);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to upload image');
      } finally {
        setUploading(false);
      }
    },
    [repoFullName, currentFilePath, config, existingAssets, onInsert, onAssetAdded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      const imageFile = files.find((f) => f.type.startsWith('image/'));

      if (imageFile) {
        handleFile(imageFile);
      }
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [handleFile]
  );

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={openFilePicker}
        className={`
          border-2 border-dashed rounded-lg p-4 text-center cursor-pointer
          transition-colors
          ${isDragging
            ? 'border-[var(--primary)] bg-[var(--primary)]/10'
            : 'border-[var(--border)] hover:border-[var(--muted)]'
          }
          ${uploading ? 'opacity-50 cursor-wait' : ''}
        `}
      >
        {uploading ? (
          <p className="text-sm text-[var(--muted)]">Uploading...</p>
        ) : (
          <>
            <p className="text-sm">
              Drop an image here or{' '}
              <span className="text-[var(--primary)]">click to browse</span>
            </p>
            <p className="text-xs text-[var(--muted)] mt-1">
              PNG, JPG, GIF, WebP, or SVG up to {MAX_ASSET_SIZE / 1024 / 1024}MB
            </p>
          </>
        )}
      </div>

      {error && (
        <p className="text-sm text-[var(--error)]">{error}</p>
      )}
    </div>
  );
}

// ============================================================================
// Paste Handler Hook
// ============================================================================

/**
 * Hook to handle paste events for image upload
 */
export function useImagePaste(
  repoFullName: string,
  currentFilePath: string,
  config: RepoConfig,
  existingAssets: Set<string>,
  onInsert: (markdown: string) => void,
  onAssetAdded: (path: string, mimeType: string, size: number) => void
) {
  const handlePaste = useCallback(
    async (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItem = items.find((item) => item.type.startsWith('image/'));

      if (!imageItem) {
        return; // Not an image paste, let default behavior handle it
      }

      e.preventDefault();

      const file = imageItem.getAsFile();
      if (!file) return;

      // Validate
      if (!ALLOWED_ASSET_TYPES.includes(file.type)) {
        console.warn('Pasted image type not allowed:', file.type);
        return;
      }

      if (file.size > MAX_ASSET_SIZE) {
        console.warn('Pasted image too large:', file.size);
        return;
      }

      try {
        // Generate filename from type
        const ext = file.type.split('/')[1] ?? 'png';
        const filename = `pasted-image-${Date.now()}.${ext}`;

        // Compute destination
        let destPath = computeAssetDestination(filename, currentFilePath, config);
        destPath = resolveCollision(destPath, existingAssets);

        // Save to IndexedDB
        const arrayBuffer = await file.arrayBuffer();
        const key = assetDraftKey(repoFullName, destPath);
        await saveAsset(key, arrayBuffer, file.type);

        // Notify and insert
        onAssetAdded(destPath, file.type, file.size);
        const markdown = generateImageMarkdown(destPath, currentFilePath, 'Pasted image');
        onInsert(markdown);
      } catch (err) {
        console.error('Failed to handle pasted image:', err);
      }
    },
    [repoFullName, currentFilePath, config, existingAssets, onInsert, onAssetAdded]
  );

  return handlePaste;
}
