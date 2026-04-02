"use client";

import { ThreadListItemPrimitive, ThreadListPrimitive } from "@assistant-ui/react";

export function ThreadListView() {
  return (
    <aside className="thread-list-panel">
      <div className="thread-list-header">
        <h2>Threads</h2>
        <ThreadListPrimitive.New className="button ghost">New</ThreadListPrimitive.New>
      </div>

      <ThreadListPrimitive.Root className="thread-list-root">
        <ThreadListPrimitive.Items>
          {() => (
            <ThreadListItemPrimitive.Root className="thread-item">
              <ThreadListItemPrimitive.Trigger className="thread-item-trigger">
                <ThreadListItemPrimitive.Title />
              </ThreadListItemPrimitive.Trigger>
            </ThreadListItemPrimitive.Root>
          )}
        </ThreadListPrimitive.Items>
      </ThreadListPrimitive.Root>
    </aside>
  );
}
