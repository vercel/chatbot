# Playbook Index

Auto-generated master index of all domain playbooks.

| Domain | Path | Description |
|--------|------|-------------|
| Agent Orchestration | playbooks/agent-orchestration/ | Agent routing, dispatch, multi-agent coordination, task delegation |
| Billing | playbooks/billing/ | Payment processing, refunds, CoF health audits, NMI/Hyperswitch billing flow |
| Customer Support | playbooks/customer-support/ | Customer 360, ticket triage, escalations, communications |
| Deploy (Vercel + GitHub) | playbooks/deploy-vercel-github/ | Vercel deployments, GitHub PR workflows, CI/CD automation |
| Disputes | playbooks/disputes/ | Credit disputes, FCRA letters, dispute rounds, evidence submission |
| Engineering | playbooks/engineering/ | Code review, refactoring, PRDs, architecture decisions |
| HR | playbooks/HR/ | Team management, onboarding, compliance, personnel |
| Marketing | playbooks/marketing/ | Campaigns, lead nurture, content strategy |
| Reporting | playbooks/reporting/ | Operational dashboards, morning pulse, analytics queries |
| Vercel Discipline | playbooks/vercel-discipline/ | Vercel deployment standards, security patterns, framework discipline |
| VPS Ops | playbooks/vps-ops/ | VPS management, pm2, nginx, Cloudflare, system health |

## How to Use

Load a playbook via `load_skill`:
```
playbooks/billing
playbooks/disputes
playbooks/customer-support
```

Or browse visually in the sidebar file tree.

## Legacy Path

Previously these lived at `organizations/newleaf-financial/<domain>/`.
The `load_skill` tool still supports legacy paths as a fallback.
