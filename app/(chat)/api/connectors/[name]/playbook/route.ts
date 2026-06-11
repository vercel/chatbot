/**
 * GET /api/connectors/[name]/playbook — Fetch connector PLAYBOOK.md content
 * Parses Markdown into sections for the detail sheet's Playbook tab
 */
import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { initConnectors, manifests } from "@/lib/connectors/init";

initConnectors();

const PROJECT_ROOT = "/home/neptune/neptune-chat";

function parseMarkdownSections(md: string): { heading: string; content: string; level: number }[] {
  const lines = md.split("\n");
  const sections: { heading: string; content: string; level: number }[] = [];
  let currentHeading = "(preamble)";
  let currentContent: string[] = [];
  let currentLevel = 0;

  for (const line of lines) {
    const h1Match = line.match(/^# (.+)/);
    const h2Match = line.match(/^## (.+)/);
    const h3Match = line.match(/^### (.+)/);

    if (h1Match) {
      if (currentContent.length > 0 || currentHeading !== "(preamble)") {
        sections.push({ heading: currentHeading, content: currentContent.join("\n").trim(), level: currentLevel });
      }
      currentHeading = h1Match[1];
      currentContent = [];
      currentLevel = 1;
    } else if (h2Match) {
      if (currentContent.length > 0 || currentHeading !== "(preamble)") {
        sections.push({ heading: currentHeading, content: currentContent.join("\n").trim(), level: currentLevel });
      }
      currentHeading = h2Match[1];
      currentContent = [];
      currentLevel = 2;
    } else if (h3Match) {
      if (currentContent.length > 0 || currentHeading !== "(preamble)") {
        sections.push({ heading: currentHeading, content: currentContent.join("\n").trim(), level: currentLevel });
      }
      currentHeading = h3Match[1];
      currentContent = [];
      currentLevel = 3;
    } else {
      currentContent.push(line);
    }
  }

  // Final section
  if (currentContent.length > 0 || currentHeading !== "(preamble)") {
    sections.push({ heading: currentHeading, content: currentContent.join("\n").trim(), level: currentLevel });
  }

  return sections;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const manifest = manifests.find((m) => m.id === name);

  if (!manifest) {
    return NextResponse.json(
      { error: `Connector not found: ${name}` },
      { status: 404 }
    );
  }

  const playbookPath = join(PROJECT_ROOT, manifest.playbookPath);
  let rawMarkdown = "";
  let sections: { heading: string; content: string; level: number }[] = [];

  try {
    if (existsSync(playbookPath)) {
      rawMarkdown = readFileSync(playbookPath, "utf-8");
      sections = parseMarkdownSections(rawMarkdown);
    }
  } catch {
    // Return empty
  }

  return NextResponse.json({
    connectorId: name,
    rawMarkdown,
    sections,
    found: rawMarkdown.length > 0,
  });
}
