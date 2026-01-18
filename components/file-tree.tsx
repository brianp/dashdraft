'use client';

import { useState, useCallback, useEffect } from 'react';
import type { FileEntry } from '@/lib/types/api';
import { UX } from '@/lib/constants/ux-terms';

interface FileTreeProps {
  owner: string;
  repo: string;
  onFileSelect: (path: string) => void;
  onCreateFile?: (folderPath: string) => void;
  onRenameFile?: (path: string) => void;
  onDeleteFile?: (path: string) => void;
  selectedPath?: string;
  filterExtensions?: string[];
  pendingNewFiles?: string[];
  pendingDeletedFiles?: string[];
  pendingRenamedFiles?: Map<string, string>; // oldPath -> newPath
}

interface TreeNode {
  entry: FileEntry;
  children?: TreeNode[];
  expanded: boolean;
  loading: boolean;
  isPending?: boolean; // For new files not yet on server
  isDeleted?: boolean; // For files marked for deletion
  renamedTo?: string; // New name if renamed
}

export function FileTree({
  owner,
  repo,
  onFileSelect,
  onCreateFile,
  onRenameFile,
  onDeleteFile,
  selectedPath,
  filterExtensions = ['.md', '.mdx'],
  pendingNewFiles = [],
  pendingDeletedFiles = [],
  pendingRenamedFiles = new Map(),
}: FileTreeProps) {
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [rootLoading, setRootLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

  const loadDirectory = useCallback(
    async (path: string): Promise<FileEntry[]> => {
      const response = await fetch(
        `/api/repo/${owner}/${repo}/tree?path=${encodeURIComponent(path)}`
      );
      const data = await response.json();

      if (data.error) {
        throw new Error(data.message);
      }

      return data.data.entries;
    },
    [owner, repo]
  );

  // Load root directory on mount
  useEffect(() => {
    loadDirectory('').then((entries) => {
      setNodes(
        entries.map((entry) => ({
          entry,
          expanded: false,
          loading: false,
        }))
      );
      setRootLoading(false);
    }).catch((err) => {
      setError(err.message);
      setRootLoading(false);
    });
  }, [loadDirectory]);

  const toggleDirectory = useCallback(
    async (path: string) => {
      setNodes((prevNodes) => {
        const updateNode = (nodes: TreeNode[]): TreeNode[] => {
          return nodes.map((node) => {
            if (node.entry.path === path) {
              if (node.expanded) {
                // Collapse
                return { ...node, expanded: false };
              }
              // Expand - need to load children if not loaded
              if (!node.children) {
                return { ...node, loading: true };
              }
              return { ...node, expanded: true };
            }
            if (node.children) {
              return { ...node, children: updateNode(node.children) };
            }
            return node;
          });
        };
        return updateNode(prevNodes);
      });

      // Check if we need to load children
      const findNode = (nodes: TreeNode[], path: string): TreeNode | null => {
        for (const node of nodes) {
          if (node.entry.path === path) return node;
          if (node.children) {
            const found = findNode(node.children, path);
            if (found) return found;
          }
        }
        return null;
      };

      const currentNode = findNode(nodes, path);
      if (currentNode && !currentNode.children && !currentNode.expanded) {
        try {
          const entries = await loadDirectory(path);
          setNodes((prevNodes) => {
            const updateNodeWithChildren = (nodes: TreeNode[]): TreeNode[] => {
              return nodes.map((node) => {
                if (node.entry.path === path) {
                  return {
                    ...node,
                    expanded: true,
                    loading: false,
                    children: entries.map((entry) => ({
                      entry,
                      expanded: false,
                      loading: false,
                    })),
                  };
                }
                if (node.children) {
                  return { ...node, children: updateNodeWithChildren(node.children) };
                }
                return node;
              });
            };
            return updateNodeWithChildren(prevNodes);
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load directory');
          setNodes((prevNodes) => {
            const updateNodeError = (nodes: TreeNode[]): TreeNode[] => {
              return nodes.map((node) => {
                if (node.entry.path === path) {
                  return { ...node, loading: false };
                }
                if (node.children) {
                  return { ...node, children: updateNodeError(node.children) };
                }
                return node;
              });
            };
            return updateNodeError(prevNodes);
          });
        }
      }
    },
    [nodes, loadDirectory]
  );

  const isEditableFile = useCallback(
    (name: string): boolean => {
      if (filterExtensions.length === 0) return true;
      return filterExtensions.some((ext) => name.endsWith(ext));
    },
    [filterExtensions]
  );

  // Get pending new files for a specific folder
  const getPendingFilesForFolder = useCallback((folderPath: string): FileEntry[] => {
    return pendingNewFiles
      .filter(path => {
        const pathFolder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
        return pathFolder === folderPath;
      })
      .map(path => ({
        name: path.includes('/') ? path.slice(path.lastIndexOf('/') + 1) : path,
        path,
        type: 'file' as const,
      }));
  }, [pendingNewFiles]);

  const renderNode = useCallback(
    (node: TreeNode, depth: number = 0) => {
      const { entry, expanded, loading, children } = node;
      const isSelected = selectedPath === entry.path;
      const isEditable = entry.type === 'dir' || isEditableFile(entry.name);
      const isHovered = hoveredPath === entry.path;
      const isDeleted = pendingDeletedFiles.includes(entry.path);
      const renamedTo = pendingRenamedFiles.get(entry.path);
      const isPendingNew = pendingNewFiles.includes(entry.path);

      // Skip deleted files
      if (isDeleted && !isPendingNew) {
        return null;
      }

      return (
        <div key={entry.path}>
          <div
            className="relative group"
            onMouseEnter={() => setHoveredPath(entry.path)}
            onMouseLeave={() => setHoveredPath(null)}
          >
            <button
              onClick={() => {
                if (entry.type === 'dir') {
                  toggleDirectory(entry.path);
                } else if (isEditable) {
                  onFileSelect(entry.path);
                }
              }}
              disabled={entry.type === 'file' && !isEditable}
              className={`w-full text-left px-2 py-1 flex items-center gap-2 text-sm ${
                isSelected ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : ''
              } ${
                entry.type === 'file' && !isEditable
                  ? 'opacity-40 cursor-not-allowed'
                  : 'hover:bg-[var(--border)]/50'
              } ${isPendingNew ? 'italic text-[var(--primary)]' : ''}`}
              style={{ paddingLeft: `${depth * 16 + 8}px` }}
            >
              {entry.type === 'dir' ? (
                <span className="text-[var(--muted)]">
                  {loading ? '...' : expanded ? '▼' : '▶'}
                </span>
              ) : (
                <span className="text-[var(--muted)]">📄</span>
              )}
              <span className={`flex-1 ${entry.type === 'dir' ? 'font-medium' : ''}`}>
                {renamedTo ? (
                  <>
                    <span className="line-through opacity-50">{entry.name}</span>
                    {' → '}
                    <span>{renamedTo.split('/').pop()}</span>
                  </>
                ) : (
                  entry.name
                )}
              </span>
              {isPendingNew && (
                <span className="text-xs text-[var(--primary)] font-normal">(new)</span>
              )}
            </button>

            {/* Action buttons on hover */}
            {isHovered && entry.type === 'file' && isEditable && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                {onRenameFile && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRenameFile(entry.path);
                    }}
                    className="p-1 hover:bg-[var(--border)] rounded text-[var(--muted)] hover:text-[var(--foreground)]"
                    title="Rename"
                  >
                    <RenameIcon />
                  </button>
                )}
                {onDeleteFile && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFile(entry.path);
                    }}
                    className="p-1 hover:bg-[var(--border)] rounded text-[var(--muted)] hover:text-[var(--error)]"
                    title="Delete"
                  >
                    <DeleteIcon />
                  </button>
                )}
              </div>
            )}

            {/* New file button for folders on hover */}
            {isHovered && entry.type === 'dir' && onCreateFile && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateFile(entry.path);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-[var(--border)] rounded text-[var(--muted)] hover:text-[var(--foreground)]"
                title="New file in folder"
              >
                <PlusIcon />
              </button>
            )}
          </div>

          {expanded && children && (
            <div>
              {children.map((child) => renderNode(child, depth + 1))}
              {/* Render pending new files in this folder */}
              {getPendingFilesForFolder(entry.path).map(pendingFile => (
                <div key={pendingFile.path} className="relative group">
                  <button
                    onClick={() => onFileSelect(pendingFile.path)}
                    className={`w-full text-left px-2 py-1 flex items-center gap-2 text-sm italic text-[var(--primary)] hover:bg-[var(--border)]/50 ${
                      selectedPath === pendingFile.path ? 'bg-[var(--primary)]/10' : ''
                    }`}
                    style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
                  >
                    <span className="text-[var(--muted)]">📄</span>
                    <span className="flex-1">{pendingFile.name}</span>
                    <span className="text-xs font-normal">(new)</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    },
    [selectedPath, isEditableFile, toggleDirectory, onFileSelect, onCreateFile, onRenameFile, onDeleteFile, hoveredPath, pendingNewFiles, pendingDeletedFiles, pendingRenamedFiles, getPendingFilesForFolder]
  );

  if (rootLoading) {
    return (
      <div className="p-4 text-sm text-[var(--muted)]">{UX.LOADING}</div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-[var(--error)]">{error}</div>
    );
  }

  if (nodes.length === 0 && pendingNewFiles.length === 0) {
    return (
      <div className="p-4 text-sm text-[var(--muted)]">No files found</div>
    );
  }

  // Get pending files at root level
  const rootPendingFiles = getPendingFilesForFolder('');

  return (
    <div className="text-sm">
      {/* Header with new file button */}
      {onCreateFile && (
        <div className="px-3 py-2 flex items-center justify-between border-b border-[var(--border)]">
          <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Files</span>
          <button
            onClick={() => onCreateFile('')}
            className="p-1 hover:bg-[var(--border)] rounded text-[var(--muted)] hover:text-[var(--foreground)]"
            title="New file"
          >
            <PlusIcon />
          </button>
        </div>
      )}

      <div className="py-1">
        {nodes.map((node) => renderNode(node))}
        {/* Render root-level pending new files */}
        {rootPendingFiles.map(pendingFile => (
          <div key={pendingFile.path} className="relative group">
            <button
              onClick={() => onFileSelect(pendingFile.path)}
              className={`w-full text-left px-2 py-1 flex items-center gap-2 text-sm italic text-[var(--primary)] hover:bg-[var(--border)]/50 ${
                selectedPath === pendingFile.path ? 'bg-[var(--primary)]/10' : ''
              }`}
              style={{ paddingLeft: '8px' }}
            >
              <span className="text-[var(--muted)]">📄</span>
              <span className="flex-1">{pendingFile.name}</span>
              <span className="text-xs font-normal">(new)</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Icons
function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function RenameIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
