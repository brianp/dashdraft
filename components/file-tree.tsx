'use client';

import { useState, useCallback, useEffect } from 'react';
import type { FileEntry } from '@/lib/types/api';
import { UX } from '@/lib/constants/ux-terms';

interface FileTreeProps {
  owner: string;
  repo: string;
  onFileSelect: (path: string) => void;
  selectedPath?: string;
  filterExtensions?: string[];
}

interface TreeNode {
  entry: FileEntry;
  children?: TreeNode[];
  expanded: boolean;
  loading: boolean;
}

export function FileTree({
  owner,
  repo,
  onFileSelect,
  selectedPath,
  filterExtensions = ['.md', '.mdx'],
}: FileTreeProps) {
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [rootLoading, setRootLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const renderNode = useCallback(
    (node: TreeNode, depth: number = 0) => {
      const { entry, expanded, loading, children } = node;
      const isSelected = selectedPath === entry.path;
      const isEditable = entry.type === 'dir' || isEditableFile(entry.name);

      return (
        <div key={entry.path}>
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
            }`}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
          >
            {entry.type === 'dir' ? (
              <span className="text-[var(--muted)]">
                {loading ? '...' : expanded ? '▼' : '▶'}
              </span>
            ) : (
              <span className="text-[var(--muted)]">📄</span>
            )}
            <span className={entry.type === 'dir' ? 'font-medium' : ''}>
              {entry.name}
            </span>
          </button>

          {expanded && children && (
            <div>
              {children.map((child) => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    },
    [selectedPath, isEditableFile, toggleDirectory, onFileSelect]
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

  if (nodes.length === 0) {
    return (
      <div className="p-4 text-sm text-[var(--muted)]">No files found</div>
    );
  }

  return (
    <div className="text-sm">
      {nodes.map((node) => renderNode(node))}
    </div>
  );
}
