'use client';

import * as React from 'react';
import Editor from '@monaco-editor/react';
import { cn } from '@/lib/utils/cn';
import { useToast } from '@/lib/hooks/use-toast';

interface JsonEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
  height?: string;
  className?: string;
  language?: 'json' | 'javascript';
  onValidate?: (isValid: boolean, error: string | null) => void;
}

export function JsonEditor({ 
  value, 
  onChange, 
  height = '500px', 
  className,
  language = 'json',
  onValidate
}: JsonEditorProps) {
  const { toast } = useToast();
  const [isValid, setIsValid] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Strip ES module import lines for validation so "import ..." doesn't trigger
  // "Cannot use import statement outside a module" during the quick syntax check.
  const stripImportsForValidation = (code: string) => {
    const patterns = [
      /import\s+\w+\s*,\s*\{[^}]+\}\s*from\s*['"][^'"]+['"];?/g, // default + named
      /import\s*\{[^}]+\}\s*from\s*['"][^'"]+['"];?/g,
      /import\s+\w+\s+from\s*['"][^'"]+['"];?/g,
      /import\s*\*\s*as\s+\w+\s*from\s*['"][^'"]+['"];?/g,
    ];
    let out = code;
    patterns.forEach((p) => {
      out = out.replace(p, '');
    });
    return out;
  };

  const handleEditorChange = (val: string | undefined) => {
    onChange(val);
    
    // Validate based on language
    if (val) {
      if (language === 'json') {
        try {
          JSON.parse(val);
          setIsValid(true);
          setError(null);
          onValidate?.(true, null);
        } catch (e) {
          setIsValid(false);
          const errorMsg = e instanceof Error ? e.message : 'Invalid JSON';
          setError(errorMsg);
          onValidate?.(false, errorMsg);
        }
      } else if (language === 'javascript') {
        // Basic JavaScript syntax check - allow imports (they will be transformed at runtime)
        try {
          const transformed = stripImportsForValidation(val);
          // Try with bot context first
          new Function('bot', `return (async function(bot) { ${transformed} })(bot);`);
          setIsValid(true);
          setError(null);
          onValidate?.(true, null);
        } catch (e) {
          // If that fails, try without wrapping (might have imports at top level)
          try {
            const transformed = stripImportsForValidation(val);
            new Function(transformed);
            setIsValid(true);
            setError(null);
            onValidate?.(true, null);
          } catch (e2) {
            setIsValid(false);
            const errorMsg = e instanceof Error ? e.message : 'Invalid JavaScript syntax';
            setError(errorMsg);
            onValidate?.(false, errorMsg);
          }
        }
      }
    } else {
      setIsValid(true);
      setError(null);
      onValidate?.(true, null);
    }
  };

  const formatJson = () => {
    if (language === 'json') {
      try {
        const parsed = JSON.parse(value);
        const formatted = JSON.stringify(parsed, null, 2);
        onChange(formatted);
        setIsValid(true);
        setError(null);
        onValidate?.(true, null);
      } catch (e) {
        // Invalid JSON, can't format
      }
    } else if (language === 'javascript') {
      // For JavaScript, we can't auto-format easily
      toast({
        title: 'Info',
        description: 'JavaScript formatting not available. Use a code formatter.',
      });
    }
  };

  // Calculate actual height for editor
  const editorHeight = height === '100%' 
    ? 'calc(100% - 60px)' // Subtract space for status bar and error message
    : height;

  return (
    <div className={cn('relative flex flex-col h-full', className)}>
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          {!isValid && (
            <span className="text-xs text-[var(--neon-red)] flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[var(--neon-red)]" />
              Invalid {language === 'json' ? 'JSON' : 'JavaScript'}
            </span>
          )}
          {isValid && value && (
            <span className="text-xs text-[var(--neon-green)] flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[var(--neon-green)]" />
              Valid {language === 'json' ? 'JSON' : 'JavaScript'}
            </span>
          )}
        </div>
        {language === 'json' && (
          <button
            type="button"
            onClick={formatJson}
            className="text-xs px-2 py-1 rounded neon-border hover:bg-[var(--neon-color-primary)]/10"
            disabled={!isValid}
          >
            Format JSON
          </button>
        )}
      </div>
      
      <div className={cn(
        'border rounded-lg overflow-hidden flex-1 min-h-0',
        isValid ? 'neon-border' : 'border-[var(--neon-red)]'
      )}>
        <Editor
          height={height === '100%' ? '100%' : editorHeight}
          defaultLanguage={language}
          language={language}
          value={value}
          onChange={handleEditorChange}
          theme="vs-dark"
          options={{
            minimap: { enabled: true },
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            readOnly: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            formatOnPaste: language === 'json',
            formatOnType: language === 'json',
          }}
        />
      </div>
      
      {error && (
        <p className="text-xs text-[var(--neon-red)] mt-2 font-mono flex-shrink-0">
          {error}
        </p>
      )}
    </div>
  );
}



