/**
 * GET /api/playbooks/load?name=<playbook-name> — Load a playbook's full content.
 *
 * Returns playbook.md markdown content + routines.json + workflow YAML listings.
 */

import { NextResponse } from "next/server";
import { readFile, readdir } from "fs/promises";
import { join } from "path";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");

    if (!name) {
      return NextResponse.json(
        { error: "Missing required query parameter: name" },
        { status: 400 }
      );
    }

    // Sanitize: only allow alphanumeric, hyphen, underscore
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return NextResponse.json(
        { error: "Invalid playbook name" },
        { status: 400 }
      );
    }

    const playbookDir = join(process.cwd(), "playbooks", name);

    // Load playbook markdown
    let playbookMd = "";
    try {
      const mdFiles = (await readdir(playbookDir)).filter(
        (f) => f.startsWith("playbook-") && f.endsWith(".md")
      );
      if (mdFiles.length > 0) {
        playbookMd = await readFile(join(playbookDir, mdFiles[0]), "utf-8");
      }
    } catch {
      return NextResponse.json(
        { error: `Playbook '${name}' not found` },
        { status: 404 }
      );
    }

    // Load routines.json
    let routines: any = null;
    try {
      const routinesRaw = await readFile(
        join(playbookDir, "routines.json"),
        "utf-8"
      );
      routines = JSON.parse(routinesRaw);
    } catch {
      // Optional
    }

    // Load workflow YAML listings
    let workflows: string[] = [];
    try {
      const wfDir = join(playbookDir, "workflows");
      workflows = await readdir(wfDir);
    } catch {
      // No workflows directory
    }

    // Load skills if present
    let skills: string[] = [];
    try {
      const skillsDir = join(playbookDir, "skills");
      skills = (await readdir(skillsDir, { withFileTypes: true }))
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    } catch {
      // No skills directory
    }

    return NextResponse.json({
      name,
      playbook: playbookMd,
      routines,
      workflows,
      skills,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to load playbook", detail: err?.message },
      { status: 500 }
    );
  }
}
