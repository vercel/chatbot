/**
 * GET /api/admin/vps-health — VPS CPU, memory, disk, uptime, pm2 status
 */

import { NextResponse } from "next/server";
import { execSync } from "child_process";

export async function GET() {
  try {
    let cpu = "0", mem = "0", disk = "0", uptime = "unknown", pm2Status = "unknown";

    try {
      // CPU usage (1-min load average as %)
      const loadRaw = execSync("cat /proc/loadavg", { timeout: 2000 }).toString().trim();
      const load1 = parseFloat(loadRaw.split(" ")[0]);
      const nproc = parseInt(execSync("nproc", { timeout: 1000 }).toString().trim()) || 1;
      cpu = Math.min(100, Math.round((load1 / nproc) * 100)).toString();
    } catch {}

    try {
      // Memory usage
      const memRaw = execSync("free | grep Mem", { timeout: 2000 }).toString();
      const parts = memRaw.split(/\s+/);
      const memTotal = parseFloat(parts[1]);
      const memUsed = parseFloat(parts[2]);
      mem = Math.round((memUsed / memTotal) * 100).toString();
    } catch {}

    try {
      // Disk usage on /
      const diskRaw = execSync("df / | tail -1", { timeout: 2000 }).toString();
      const diskParts = diskRaw.split(/\s+/);
      disk = diskParts[4]?.replace("%", "") || "0";
    } catch {}

    try {
      // Uptime
      uptime = execSync("uptime -p", { timeout: 1000 }).toString().trim().replace("up ", "");
    } catch {}

    try {
      // pm2 status
      const pm2Raw = execSync("pm2 jlist 2>/dev/null", { timeout: 3000 }).toString();
      const list = JSON.parse(pm2Raw);
      const allOnline = list.every((p: any) => p.pm2_env?.status === "online");
      const anyOnline = list.some((p: any) => p.pm2_env?.status === "online");
      pm2Status = allOnline ? "online" : anyOnline ? "degraded" : "offline";
    } catch {
      pm2Status = "not running";
    }

    return NextResponse.json({ cpu, mem, disk, uptime, pm2Status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, cpu: "0", mem: "0", disk: "0", uptime: "unknown", pm2Status: "error" });
  }
}

