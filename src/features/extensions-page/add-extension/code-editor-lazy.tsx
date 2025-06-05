// ABOUTME: Lazy-loaded CodeMirror component for bundle size optimization
// ABOUTME: Dynamically imports CodeMirror editor only when needed

import { FC, lazy, Suspense } from "react";
import { LoadingIndicator } from "@/ui/loading";

// Lazy load the CodeMirror component
const CodeMirrorLazy = lazy(() => 
  import("@uiw/react-codemirror").then(module => ({ default: module.default }))
);

const javascriptLazy = () => 
  import("@codemirror/lang-javascript").then(module => module.javascript);

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  theme?: string;
  height?: string;
}

export const CodeEditor: FC<CodeEditorProps> = ({ 
  value, 
  onChange, 
  placeholder, 
  theme = "light",
  height = "200px" 
}) => {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-[200px] border rounded-md bg-muted/50">
        <LoadingIndicator />
      </div>
    }>
      <CodeEditorContent
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        theme={theme}
        height={height}
      />
    </Suspense>
  );
};

// Separate component to handle the async loading
const CodeEditorContent: FC<CodeEditorProps> = ({ 
  value, 
  onChange, 
  placeholder, 
  theme,
  height 
}) => {
  const [extensions, setExtensions] = useState<any[]>([]);

  useEffect(() => {
    javascriptLazy().then(javascript => {
      setExtensions([javascript()]);
    });
  }, []);

  return (
    <CodeMirrorLazy
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      theme={theme === "dark" ? "dark" : "light"}
      height={height}
      extensions={extensions}
    />
  );
};

import { useEffect, useState } from "react";