import { NextResponse } from "next/server";

// GET /api/vault — returns key names with status (never values)
export async function GET() {
  const keyInfo = [
    { key: "DEEPSEEK_API_KEY", status: "configured" },
    { key: "AI_GATEWAY_API_KEY", status: "configured" },
    { key: "SLACK_BOT_TOKEN", status: "configured" },
    { key: "NMI_SECURITY_KEY", status: "configured" },
    { key: "BASE44_API_KEY", status: "configured" },
    { key: "LINEAR_API_KEY", status: "configured" },
    { key: "VERCEL_TOKEN", status: "configured" },
    { key: "ANTHROPIC_API_KEY", status: "pending" },
    { key: "OPENAI_API_KEY", status: "pending" },
    { key: "GOOGLE_API_KEY", status: "pending" },
    { key: "XAI_API_KEY", status: "pending" },
    { key: "GROQ_API_KEY", status: "pending" },
    { key: "FORTH_API_TOKEN", status: "pending" },
    { key: "NEPTUNE_V2_API_KEY", status: "pending" },
    { key: "VERCEL_PARTNER_TOKEN", status: "pending" },
  ];
  return NextResponse.json({
    keys: keyInfo,
    vaultUrl: "https://187.127.250.171:8400",
  });
}
