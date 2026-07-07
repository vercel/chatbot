import type { Node } from "prosemirror-model";
import { Plugin, PluginKey } from "prosemirror-state";
import { DecorationSet } from "prosemirror-view";
import type { Suggestion } from "@/lib/db/schema";

export interface UISuggestion extends Suggestion {
  selectionEnd: number;
  selectionStart: number;
}

type Position = {
  start: number;
  end: number;
};

function findPositionsInDoc(doc: Node, searchText: string): Position | null {
  let positions: { start: number; end: number } | null = null;

  doc.nodesBetween(0, doc.content.size, (node, pos) => {
    if (node.isText && node.text) {
      const index = node.text.indexOf(searchText);

      if (index !== -1) {
        positions = {
          start: pos + index,
          end: pos + index + searchText.length,
        };

        return false;
      }
    }

    return true;
  });

  return positions;
}

export function projectWithPositions(
  doc: Node,
  suggestions: Suggestion[]
): UISuggestion[] {
  return suggestions.map((suggestion) => {
    const positions = findPositionsInDoc(doc, suggestion.originalText);

    if (!positions) {
      return {
        ...suggestion,
        selectionStart: 0,
        selectionEnd: 0,
      };
    }

    return {
      ...suggestion,
      selectionStart: positions.start,
      selectionEnd: positions.end,
    };
  });
}

export const suggestionsPluginKey = new PluginKey("suggestions");
export const suggestionsPlugin = new Plugin({
  key: suggestionsPluginKey,
  state: {
    init() {
      return { decorations: DecorationSet.empty, selected: null };
    },
    apply(tr, state) {
      const newDecorations = tr.getMeta(suggestionsPluginKey);
      if (newDecorations) {
        return newDecorations;
      }

      return {
        decorations: state.decorations.map(tr.mapping, tr.doc),
        selected: state.selected,
      };
    },
  },
  props: {
    decorations(state) {
      return this.getState(state)?.decorations ?? DecorationSet.empty;
    },
    handleDOMEvents: {
      mousedown(_view, event) {
        const target = event.target as HTMLElement;
        if (target.closest(".suggestion-highlight")) {
          event.preventDefault();
          return true;
        }
        return false;
      },
    },
  },
});
