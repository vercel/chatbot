import OrderedMap from "orderedmap";
import {
  DOMParser,
  type MarkSpec,
  type Node as ProsemirrorNode,
  Schema,
} from "prosemirror-model";
import { schema } from "prosemirror-schema-basic";
import { addListNodes } from "prosemirror-schema-list";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { useEffect, useRef } from "react";
import { renderToString } from "react-dom/server";

import { MessageResponse } from "@/components/ai-elements/message";
import { DiffType, diffEditor } from "@/lib/editor/diff";

const diffSchema = new Schema({
  marks: OrderedMap.from({
    ...schema.spec.marks.toObject(),
    diffMark: {
      attrs: { type: { default: "" } },
      toDOM(mark) {
        let className = "";

        switch (mark.attrs.type) {
          case DiffType.Inserted:
            className =
              "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 rounded-sm px-0.5 -mx-0.5";
            break;
          case DiffType.Deleted:
            className =
              "bg-red-500/15 line-through text-red-600 dark:text-red-400 rounded-sm px-0.5 -mx-0.5 opacity-70";
            break;
          default:
            className = "";
        }
        return ["span", { class: className }, 0];
      },
    } as MarkSpec,
  }),
  nodes: addListNodes(schema.spec.nodes, "paragraph block*", "block"),
});

function computeDiff(oldDoc: ProsemirrorNode, newDoc: ProsemirrorNode) {
  return diffEditor(diffSchema, oldDoc.toJSON(), newDoc.toJSON());
}

type DiffEditorProps = {
  oldContent: string;
  newContent: string;
};

export const DiffView = ({ oldContent, newContent }: DiffEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (editorRef.current && !viewRef.current) {
      const parser = DOMParser.fromSchema(diffSchema);

      const oldHtmlContent = renderToString(
        <MessageResponse>{oldContent}</MessageResponse>
      );
      const newHtmlContent = renderToString(
        <MessageResponse>{newContent}</MessageResponse>
      );

      const oldContainer = document.createElement("div");
      oldContainer.innerHTML = oldHtmlContent;

      const newContainer = document.createElement("div");
      newContainer.innerHTML = newHtmlContent;

      const oldDoc = parser.parse(oldContainer);
      const newDoc = parser.parse(newContainer);

      const diffedDoc = computeDiff(oldDoc, newDoc);

      const state = EditorState.create({
        doc: diffedDoc,
        plugins: [],
      });

      viewRef.current = new EditorView(editorRef.current, {
        editable: () => false,
        state,
      });

      requestAnimationFrame(() => {
        const firstDiff = editorRef.current?.querySelector(
          "[class*='bg-emerald'], [class*='bg-red']"
        );
        if (firstDiff) {
          firstDiff.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    }

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, [oldContent, newContent]);

  return (
    <div
      className="diff-editor prose dark:prose-invert prose-neutral relative max-w-none"
      ref={editorRef}
    />
  );
};
