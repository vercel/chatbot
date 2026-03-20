"use client";

import { python } from "@codemirror/lang-python";
import { EditorState, Transaction } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { memo, useEffect, useRef } from "react";
import type { Suggestion } from "@/lib/db/schema";

type EditorProps = {
  content: string;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
  status: "streaming" | "idle";
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  suggestions: Suggestion[];
};

function PureCodeEditor({ content, onSaveContent, status }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);
  const userScrolledRef = useRef(false);

  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      const startState = EditorState.create({
        doc: content,
        extensions: [basicSetup, python(), oneDark],
      });

      editorRef.current = new EditorView({
        state: startState,
        parent: containerRef.current,
      });
    }

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
  }, [content]);

  useEffect(() => {
    if (editorRef.current) {
      const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const transaction = update.transactions.find(
            (tr) => !tr.annotation(Transaction.remote)
          );

          if (transaction) {
            const newContent = update.state.doc.toString();
            onSaveContent(newContent, true);
          }
        }
      });

      const scrollListener = EditorView.domEventHandlers({
        scroll() {
          if (status !== "streaming") return;
          const dom = editorRef.current?.scrollDOM;
          if (!dom) return;
          const atBottom =
            dom.scrollHeight - dom.scrollTop - dom.clientHeight < 40;
          userScrolledRef.current = !atBottom;
        },
      });

      const currentSelection = editorRef.current.state.selection;

      const newState = EditorState.create({
        doc: editorRef.current.state.doc,
        extensions: [
          basicSetup,
          python(),
          oneDark,
          updateListener,
          scrollListener,
        ],
        selection: currentSelection,
      });

      editorRef.current.setState(newState);
    }
  }, [onSaveContent, status]);

  useEffect(() => {
    if (status !== "streaming") {
      userScrolledRef.current = false;
    }
  }, [status]);

  useEffect(() => {
    if (editorRef.current && content) {
      const currentContent = editorRef.current.state.doc.toString();

      if (status === "streaming" || currentContent !== content) {
        const transaction = editorRef.current.state.update({
          changes: {
            from: 0,
            to: currentContent.length,
            insert: content,
          },
          annotations: [Transaction.remote.of(true)],
        });

        editorRef.current.dispatch(transaction);

        if (status === "streaming" && !userScrolledRef.current) {
          requestAnimationFrame(() => {
            const dom = editorRef.current?.scrollDOM;
            if (dom) {
              dom.scrollTo({ top: dom.scrollHeight });
            }
          });
        }
      }
    }
  }, [content, status]);

  return (
    <div
      className="not-prose relative w-full min-h-[300px] pb-[calc(50dvh)]"
      ref={containerRef}
    />
  );
}

export const CodeEditor = memo(PureCodeEditor, (prevProps, nextProps) => {
  if (prevProps.status === "streaming" && nextProps.status === "streaming") {
    return false;
  }

  if (prevProps.content !== nextProps.content) {
    return false;
  }

  if (prevProps.status !== nextProps.status) {
    return false;
  }

  if (prevProps.currentVersionIndex !== nextProps.currentVersionIndex) {
    return false;
  }

  return true;
});
