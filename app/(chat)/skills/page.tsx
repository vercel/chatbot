/**
 * Skills Page — Cortex skill browser.
 */
import { auth } from "@/app/(auth)/auth";

export default async function SkillsPage() {
  const session = await auth();
  if (!session?.user) {
    return (
      <div className="p-8 text-muted-foreground">Sign in to browse skills.</div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4">
        <h1 className="text-lg font-semibold">Skills</h1>
        <p className="text-sm text-muted-foreground">
          Cortex skill browser — loaded from Jarvis VPS file system bridge.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-sm text-muted-foreground p-8 text-center border rounded-lg bg-card">
          <p className="font-medium mb-2">Skill browser</p>
          <p>Skills are loaded dynamically from the VPS file system bridge.</p>
          <p className="mt-1">
            Use the file system browser in the sidebar or send a chat message to
            explore skills.
          </p>
          <p className="mt-2 text-xs">
            Available via:{" "}
            <code className="bg-muted px-1 rounded">readSkill</code>,{" "}
            <code className="bg-muted px-1 rounded">listSkills</code>,{" "}
            <code className="bg-muted px-1 rounded">searchKnowledge</code> tools
          </p>
        </div>
      </div>
    </div>
  );
}
