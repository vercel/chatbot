"use client";

import { exampleSetup } from "prosemirror-example-setup";
import { inputRules } from "prosemirror-inputrules";
import { EditorState } from "prosemirror-state";
import { type Decoration, DecorationSet, EditorView } from "prosemirror-view";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { Suggestion } from "@/lib/db/schema";
import {
  documentSchema,
  handleTransaction,
  headingRule,
} from "@/lib/editor/config";
import {
  buildContentFromDocument,
  buildDocumentFromContent,
  createDecorations,
} from "@/lib/editor/functions";
import {
  projectWithPositions,
  suggestionsPlugin,
  suggestionsPluginKey,
  type UISuggestion,
} from "@/lib/editor/suggestions";
import { SuggestionDialog } from "./suggestion";

type EditorProps = {
  content: string;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
  status: "streaming" | "idle";
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  suggestions: Suggestion[];
  onSuggestionSelect?: (suggestion: UISuggestion | null) => void;
  onSuggestionApply?: () => void;
  activeSuggestion?: UISuggestion | null;
};

function PureEditor({
  content,
  onSaveContent,
  suggestions,
  status,
}: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState<UISuggestion | null>(
    null
  );
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const suggestionsRef = useRef<UISuggestion[]>([]);

  useEffect(() => {
    if (containerRef.current) {
      const target = containerRef.current.closest("[data-slot='artifact-content']") as HTMLElement | null;
      setPortalTarget(target);
    }
  }, []);

  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      const state = EditorState.create({
        doc: buildDocumentFromContent(content),
        plugins: [
          ...exampleSetup({ schema: documentSchema, menuBar: false }),
          inputRules({
            rules: [
              headingRule(1),
              headingRule(2),
              headingRule(3),
              headingRule(4),
              headingRule(5),
              headingRule(6),
            ],
          }),
          suggestionsPlugin,
        ],
      });

      editorRef.current = new EditorView(containerRef.current, {
        state,
        handleDOMEvents: {
          click(_view, event) {
            const target = event.target as HTMLElement;
            const highlight = target.closest(".suggestion-highlight");
            if (highlight) {
              const id = highlight.getAttribute("data-suggestion-id");
              const found = suggestionsRef.current.find((s) => s.id === id);
              if (found) {
                setActiveSuggestion(found);
              }
              return true;
            }
            return false;
          },
        },
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
      editorRef.current.setProps({
        dispatchTransaction: (transaction) => {
          handleTransaction({
            transaction,
            editorRef,
            onSaveContent,
          });
        },
      });
    }
  }, [onSaveContent]);

  useEffect(() => {
    if (editorRef.current && content) {
      const currentContent = buildContentFromDocument(
        editorRef.current.state.doc
      );

      if (status === "streaming") {
        const newDocument = buildDocumentFromContent(content);

        const transaction = editorRef.current.state.tr.replaceWith(
          0,
          editorRef.current.state.doc.content.size,
          newDocument.content
        );

        transaction.setMeta("no-save", true);
        editorRef.current.dispatch(transaction);
        return;
      }

      if (currentContent !== content) {
        const newDocument = buildDocumentFromContent(content);

        const transaction = editorRef.current.state.tr.replaceWith(
          0,
          editorRef.current.state.doc.content.size,
          newDocument.content
        );

        transaction.setMeta("no-save", true);
        editorRef.current.dispatch(transaction);
      }
    }
  }, [content, status]);

  useEffect(() => {
    if (editorRef.current?.state.doc && content) {
      const projectedSuggestions = projectWithPositions(
        editorRef.current.state.doc,
        suggestions
      ).filter(
        (suggestion) => suggestion.selectionStart && suggestion.selectionEnd
      );

      suggestionsRef.current = projectedSuggestions;

      const decorations = createDecorations(
        projectedSuggestions,
        editorRef.current
      );

      const transaction = editorRef.current.state.tr;
      transaction.setMeta(suggestionsPluginKey, { decorations });
      editorRef.current.dispatch(transaction);
    }
  }, [suggestions, content]);

  const handleApply = useCallback(() => {
    if (!editorRef.current || !activeSuggestion) {
      return;
    }

    const { state, dispatch } = editorRef.current;
    const currentState = suggestionsPluginKey.getState(state);
    const currentDecorations = currentState?.decorations;

    if (currentDecorations) {
      const newDecorations = DecorationSet.create(
        state.doc,
        currentDecorations.find().filter((decoration: Decoration) => {
          return decoration.spec.suggestionId !== activeSuggestion.id;
        })
      );

      const decorationTransaction = state.tr;
      decorationTransaction.setMeta(suggestionsPluginKey, {
        decorations: newDecorations,
        selected: null,
      });
      dispatch(decorationTransaction);
    }

    const textTransaction = editorRef.current.state.tr.replaceWith(
      activeSuggestion.selectionStart,
      activeSuggestion.selectionEnd,
      state.schema.text(activeSuggestion.suggestedText)
    );
    textTransaction.setMeta("no-debounce", true);
    dispatch(textTransaction);

    setActiveSuggestion(null);
  }, [activeSuggestion]);

  return (
    <>
      <div
        className="prose dark:prose-invert prose-neutral relative max-w-none"
        ref={containerRef}
      />
      {activeSuggestion &&
        portalTarget &&
        createPortal(
          <SuggestionDialog
            onApply={handleApply}
            onClose={() => setActiveSuggestion(null)}
            suggestion={activeSuggestion}
          />,
          portalTarget
        )}
    </>
  );
}

function areEqual(prevProps: EditorProps, nextProps: EditorProps) {
  return (
    prevProps.suggestions === nextProps.suggestions &&
    prevProps.currentVersionIndex === nextProps.currentVersionIndex &&
    prevProps.isCurrentVersion === nextProps.isCurrentVersion &&
    !(prevProps.status === "streaming" && nextProps.status === "streaming") &&
    prevProps.content === nextProps.content &&
    prevProps.onSaveContent === nextProps.onSaveContent
  );
}

export const Editor = memo(PureEditor, areEqual);
