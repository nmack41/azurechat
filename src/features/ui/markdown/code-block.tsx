import { CheckIcon, ClipboardIcon } from "lucide-react";
import { FC, memo, useEffect, useState } from "react";
import { Button } from "../button";

export const fence = {
  render: "CodeBlock",
  attributes: {
    language: {
      type: String,
    },
    value: {
      type: String,
    },
  },
};

interface Props {
  language: string;
  children: string;
}

export const CodeBlock: FC<Props> = memo(({ language, children }) => {
  const [isIconChecked, setIsIconChecked] = useState(false);
  const [highlightedCode, setHighlightedCode] = useState<string>("");

  const handleButtonClick = () => {
    navigator.clipboard.writeText(children);
    setIsIconChecked(true);
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsIconChecked(false);
    }, 2000);

    return () => clearTimeout(timeout);
  }, [isIconChecked]);

  useEffect(() => {
    const highlightCode = async () => {
      try {
        const { createHighlighter } = await import('shiki');
        const highlighter = await createHighlighter({
          themes: ['vitesse-dark'],
          langs: [language || 'text', 'javascript', 'typescript', 'json', 'bash', 'python', 'sql']
        });
        
        const html = highlighter.codeToHtml(children, {
          lang: language || 'text',
          theme: 'vitesse-dark'
        });
        setHighlightedCode(html);
      } catch (error) {
        // Fallback to plain text if highlighting fails
        setHighlightedCode(`<pre><code>${children}</code></pre>`);
      }
    };

    highlightCode();
  }, [children, language]);

  return (
    <div className="flex flex-col -mx-9">
      <div className="flex items-center justify-end">
        <Button
          variant={"ghost"}
          size={"sm"}
          title="Copy text"
          className="justify-right flex gap-2"
          onClick={handleButtonClick}
        >
          <span className="text-xs text-muted-foreground">Copy {language}</span>
          {isIconChecked ? (
            <CheckIcon size={16} />
          ) : (
            <ClipboardIcon size={16} />
          )}
        </Button>
      </div>

      <div 
        className="shiki-container"
        dangerouslySetInnerHTML={{ __html: highlightedCode || `<pre><code>${children}</code></pre>` }}
      />
    </div>
  );
});

CodeBlock.displayName = "CodeBlock";
