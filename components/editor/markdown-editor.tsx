'use client';

import { useCallback, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { EditorView } from '@codemirror/view';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}

export function MarkdownEditor({
  value,
  onChange,
  readOnly = false,
  placeholder,
}: MarkdownEditorProps) {
  const handleChange = useCallback(
    (val: string) => {
      onChange(val);
    },
    [onChange]
  );

  // Editor extensions
  const extensions = useMemo(() => {
    return [
      markdown({ base: markdownLanguage }),
      EditorView.lineWrapping,
      EditorView.theme({
        '&': {
          fontSize: '14px',
        },
        '.cm-content': {
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          padding: '16px',
        },
        '.cm-gutters': {
          backgroundColor: 'var(--background)',
          borderRight: '1px solid var(--border)',
        },
        '.cm-activeLineGutter': {
          backgroundColor: 'var(--border)',
        },
        '.cm-activeLine': {
          backgroundColor: 'rgba(128, 128, 128, 0.1)',
        },
        '.cm-selectionMatch': {
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
        },
        '&.cm-focused .cm-cursor': {
          borderLeftColor: 'var(--primary)',
        },
        '&.cm-focused .cm-selectionBackground, ::selection': {
          backgroundColor: 'rgba(59, 130, 246, 0.3)',
        },
      }),
    ];
  }, []);

  return (
    <div className="h-full border border-[var(--border)] rounded-lg overflow-hidden">
      <CodeMirror
        value={value}
        onChange={handleChange}
        extensions={extensions}
        readOnly={readOnly}
        placeholder={placeholder}
        theme="dark"
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightActiveLine: true,
          foldGutter: true,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: false,
          rectangularSelection: true,
          crosshairCursor: false,
          highlightSelectionMatches: true,
        }}
        className="h-full"
        style={{ height: '100%' }}
      />
    </div>
  );
}
