# Twenty CRM — Apps & Marketplace

## Overview
Apps are TypeScript packages that extend a Twenty workspace with custom entities. Each app can define objects, fields, relations, logic functions, skills, agents, frontend components, views, navigation items, roles, and connection providers — up to 14 entity types.

## App Lifecycle
```
npx create-twenty-app → Write defineEntity code → yarn twenty dev (test locally)
→ yarn twenty dev:build (compile + detect entities) → yarn twenty app:publish (deploy)
→ Server syncs catalog (hourly for npm) → Workspace installs via UI/CLI
```

## Distribution Paths

### npm (Public Marketplace)
```bash
yarn twenty app:publish
yarn twenty app:publish --tag beta
```
Requirements:
- npm account
- `"keywords": ["twenty-app"]` in package.json
- Optional: logoUrl, screenshots (1600×1000 px), author, category, aboutDescription
- Server syncs npm catalog every hour
- Force sync: `yarn twenty dev:catalog-sync`

### Tarball (Private/Enterprise)
```bash
yarn twenty remote:add --url https://crm.newleaf.financial --as production
yarn twenty app:publish --private --remote production
```
- Strict semver enforcement
- Share across workspaces requires Enterprise license
- `engines.twenty` in package.json sets minimum server version

## Version Management
- Same version re-deployed → `VERSION_ALREADY_EXISTS`
- Lower version deployed → `CANNOT_DOWNGRADE_APPLICATION`
- Pre-release tags: `1.0.0-rc.1` → `1.0.0-rc.2` → `1.0.0`
- Server compatibility via `engines.twenty` semver range
- Incompatible: `SERVER_VERSION_INCOMPATIBLE`

## What Apps Can Extend (14 Entity Types)
| Entity | Purpose | define* Function |
|--------|---------|-----------------|
| Objects | Custom record types (tables) | `defineObject()` |
| Fields | Extend existing objects | `defineField()` |
| Relations | Bidirectional object links | `defineRelation()` |
| Logic Functions | Server-side TypeScript handlers | `defineLogicFunction()` |
| Skills | AI agent instruction sets | `defineSkill()` |
| Agents | Custom AI assistants | `defineAgent()` |
| Front Components | Sandboxed React UI | `defineFrontComponent()` |
| Views | Prebuilt record list configs | `defineView()` |
| Navigation Items | Sidebar menu entries | `defineNavigationMenuItem()` |
| Page Layouts | Detail page tabs/widgets | `definePageLayout()` |
| Command Menu Items | Cmd+K palette entries | `defineCommandMenuItem()` |
| Connection Providers | OAuth for external APIs | `defineConnectionProvider()` |
| Roles | Permission sets | `defineRole()` |
| Application | App identity + metadata | `defineApplication()` |

## NewLeaf App Strategy
**App Name:** `newleaf-foundation`
**Distribution:** Private tarball (not published to npm)
**Contains:**
- 5 custom objects (PaymentRecord, Subscription, CreditDispute, Enrollment, RecoveryTask)
- 8 logic functions (payment webhook, NMI sync, GHL sync, credit parser, dispute generator, monthly reconciliation, SLA monitor, enrollment health)
- 1 custom role (billing_system) for API key access
- Custom views for each object with NewLeaf-specific column configs
- Slack integration via workflow actions

## Deploy Workflow
```bash
# 1. Scaffold
npx create-twenty-app newleaf-foundation

# 2. Write code (defineObject, defineLogicFunction, etc.)

# 3. Build
yarn twenty dev:build

# 4. Dry-run (preview schema changes)
yarn twenty dev --once --dry-run

# 5. Deploy to production
yarn twenty app:publish --private --remote production

# 6. Verify installation
yarn twenty app:status
```

## CI/CD
Built-in GitHub Actions for:
- **CI:** Isolated Twenty test instance → run tests → validate
- **CD:** Deploy on push to main (needs `TWENTY_DEPLOY_URL` + `TWENTY_DEPLOY_API_KEY`)
- **npm CD:** Trigger on GitHub release → build → npm publish

## App Discovery
After publishing, the app appears in:
- Settings → Applications → Available apps (for workspace admins)
- CLI: `yarn twenty app:list --remote production`
