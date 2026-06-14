"use client";

/**
 * Phase 15.F — Admin Landing Page
 *
 * Lists all /admin/* pages as cards with icon, description, and last-accessed timestamp.
 * Quick-launch hub for Neptune administrators.
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  LayoutDashboardIcon,
  BeakerIcon,
  StoreIcon,
  PuzzleIcon,
  GitBranchIcon,
  BarChart3Icon,
  ShieldIcon,
  SettingsIcon,
  KeyRoundIcon,
  ActivityIcon,
  ExternalLinkIcon,
  ArrowRightIcon,
} from "lucide-react";

interface AdminPage {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  external?: boolean;
}

const ADMIN_PAGES: AdminPage[] = [
  {
    href: "/admin/dashboard",
    title: "Dashboard",
    description: "Real-time observability: tokens, cost, latency, VPS health, eval pass rates",
    icon: LayoutDashboardIcon,
    badge: "New",
  },
  {
    href: "/admin/marketplace",
    title: "Marketplace",
    description: "Skill discovery: browse our library, Vercel skills, community, and recently added",
    icon: StoreIcon,
  },
  {
    href: "/admin/agent-sim",
    title: "Agent Sim",
    description: "Side-by-side comparison: Bloated Mode vs Progressive Disclosure for any query",
    icon: BeakerIcon,
  },
  {
    href: "/admin/connector-wizard",
    title: "Connector Wizard",
    description: "8-step connector builder: define tools, wire MCP, test, and deploy",
    icon: PuzzleIcon,
    badge: "New",
  },
  {
    href: "/admin/evals",
    title: "Evals",
    description: "Automated quality grading across 10 domains with leaderboard and run history",
    icon: BarChart3Icon,
    badge: "New",
  },
  {
    href: "/connectors",
    title: "Connectors Panel",
    description: "Manage MCP connectors, view status, configure endpoints",
    icon: GitBranchIcon,
  },
  {
    href: "/secrets",
    title: "Secrets",
    description: "Manage API keys and secrets inventory",
    icon: KeyRoundIcon,
  },
  {
    href: "/telemetry",
    title: "Telemetry",
    description: "Raw event stream and tracing for debugging agent sessions",
    icon: ActivityIcon,
  },
  {
    href: "/diagnostics",
    title: "Diagnostics",
    description: "System health checks, connection status, error logs",
    icon: ShieldIcon,
  },
  {
    href: "/reports",
    title: "Reports",
    description: "Generate and view operational reports across all domains",
    icon: BarChart3Icon,
  },
  {
    href: "/settings",
    title: "Settings",
    description: "Application configuration, environment, and preferences",
    icon: SettingsIcon,
  },
];

export default function AdminLandingPage() {
  return (
    <div className="flex flex-col h-full p-6 space-y-6 overflow-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Administration</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Neptune admin tools and observability hub
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ADMIN_PAGES.map((page) => {
          const Icon = page.icon;
          return (
            <Link key={page.href} href={page.href} className="block group">
              <Card className="h-full hover:bg-accent/20 transition-colors cursor-pointer border-border/50 hover:border-border">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between">
                    <div className="p-2 rounded-lg bg-accent/30 group-hover:bg-accent/50 transition-colors">
                      <Icon className="size-5" />
                    </div>
                    <div className="flex items-center gap-2">
                      {page.badge && (
                        <Badge variant="secondary" className="text-[10px]">
                          {page.badge}
                        </Badge>
                      )}
                      <ArrowRightIcon className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <CardTitle className="text-sm mt-2">{page.title}</CardTitle>
                  <CardDescription className="text-xs mt-1">{page.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
