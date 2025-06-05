import Markdoc from "@markdoc/markdoc";
import React, { FC, useMemo } from "react";
import { Citation } from "./citation";
import { CodeBlock } from "./code-block";
import { citationConfig } from "./config";
import { MarkdownProvider } from "./markdown-context";
import { Paragraph } from "./paragraph";

interface Props {
  content: string;
  onCitationClick: (
    previousState: any,
    formData: FormData
  ) => Promise<JSX.Element>;
}

export const Markdown: FC<Props> = React.memo((props) => {
  // Memoize the parsed and transformed content to avoid re-processing
  const renderedContent = useMemo(() => {
    const ast = Markdoc.parse(props.content);
    const content = Markdoc.transform(ast, {
      ...citationConfig,
    });
    
    return Markdoc.renderers.react(content, React, {
      components: { Citation, Paragraph, CodeBlock },
    });
  }, [props.content]);

  return (
    <MarkdownProvider onCitationClick={props.onCitationClick}>
      {renderedContent}
    </MarkdownProvider>
  );
});

Markdown.displayName = 'Markdown';
