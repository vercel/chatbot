/**
 * Phase 40 — Test Playbook Parser
 * Parses NKS-compliant markdown playbooks into executable scenarios.
 * Playbook format: YAML frontmatter + numbered scenario sections.
 * @author abhiswami2121@gmail.com
 */

import type {
  TestPlaybook, PlaybookScenario, PlaybookStep,
  PlaybookAssertion, TargetSystem, TestUserRole,
} from './types';

// ===== YAML Frontmatter Parser =====

interface PlaybookFrontmatter {
  name: string;
  type: string;
  description: string;
  version: string;
  targetUrl: string;
  targetSystem: string;
  user: string;
  severity: string;
  estimatedMinutes: number;
  tags: string[];
}

function parseFrontmatter(markdown: string): { frontmatter: PlaybookFrontmatter; body: string } {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    throw new Error('Invalid playbook: missing YAML frontmatter (---)');
  }

  const yamlBlock = match[1];
  const body = match[2];
  const frontmatter: Record<string, unknown> = {};

  // Simple YAML parser (handles our specific format)
  for (const line of yamlBlock.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    let value: string | string[] = trimmed.slice(colonIndex + 1).trim();

    // Remove quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    // Parse array values [tag1, tag2]
    if (value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1);
      value = inner.split(',').map(s => s.trim().replace(/['"]/g, ''));
    }

    frontmatter[key] = value;
  }

  const fm = frontmatter as unknown as PlaybookFrontmatter;

  // Validate required fields
  const required = ['name', 'type', 'description', 'version', 'targetUrl'];
  for (const field of required) {
    if (!frontmatter[field]) {
      throw new Error(`Missing required frontmatter field: ${field}`);
    }
  }

  if (fm.type !== 'test-playbook') {
    throw new Error(`Invalid playbook type: "${fm.type}". Must be "test-playbook"`);
  }

  return { frontmatter: fm, body };
}

// ===== Scenario Parser =====

function parseScenarios(body: string): PlaybookScenario[] {
  const scenarios: PlaybookScenario[] = [];

  // Split by ## Scenario headers
  const scenarioBlocks = body.split(/^## Scenario \d+:/m).slice(1);

  for (const block of scenarioBlocks) {
    const lines = block.trim().split('\n');
    const name = lines[0].replace(/^\*\*/, '').replace(/\*\*$/, '').trim();
    const description: string[] = [];
    const steps: PlaybookStep[] = [];
    const assertions: PlaybookAssertion[] = [];

    let inSteps = false;
    let inAssertions = false;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith('### Steps')) {
        inSteps = true;
        inAssertions = false;
        continue;
      }
      if (line.startsWith('### Assertions')) {
        inSteps = false;
        inAssertions = true;
        continue;
      }
      if (line.startsWith('### ')) {
        inSteps = false;
        inAssertions = false;
        continue;
      }

      if (inSteps) {
        const step = parseStep(line);
        if (step) steps.push(step);
      } else if (inAssertions) {
        const assertion = parseAssertion(line);
        if (assertion) assertions.push(assertion);
      } else {
        description.push(line);
      }
    }

    scenarios.push({
      name,
      description: description.join(' '),
      steps,
      assertions,
    });
  }

  return scenarios;
}

function parseStep(line: string): PlaybookStep | null {
  // Format: "- **[action]** Description — `target`" or variants
  const cleaned = line.replace(/^[\s-]*\*?/, '').trim();
  if (!cleaned) return null;

  // Extract action from bold
  const actionMatch = cleaned.match(/^\*\*(\w+)\*\*/);
  if (!actionMatch) {
    // Try plain format: "- action Description — target"
    const stepMatch = cleaned.match(/^-?\s*(\w+)\s+(.+?)(?:\s+[—–-]\s*(.+))?$/);
    if (stepMatch) {
      return {
        action: normalizeAction(stepMatch[1]),
        description: stepMatch[2].trim(),
        target: stepMatch[3]?.trim(),
      };
    }
    return null;
  }

  const action = normalizeAction(actionMatch[1]);
  const rest = cleaned.slice(actionMatch[0].length).trim();

  // Split description and target
  const parts = rest.split(/\s+[—–-]\s+/);
  const description = parts[0]?.replace(/^:\s*/, '').trim() || '';
  const targetValue = parts[1]?.trim() || '';

  // Extract backtick-quoted values
  const backtickMatch = targetValue.match(/`([^`]+)`/g);
  const values = backtickMatch?.map(v => v.slice(1, -1)) || [];

  return {
    action,
    description,
    target: values[0] || targetValue,
    value: values[1],
  };
}

function parseAssertion(line: string): PlaybookAssertion | null {
  const cleaned = line.replace(/^[\s-]*/, '').trim();
  if (!cleaned) return null;

  // Format: "- **[type]** Description — expected: `value`"
  const typeMatch = cleaned.match(/^\*\*(\w+)\*\*/);
  if (!typeMatch) {
    // Try plain assertion: "Expected `value` in `target`"
    return {
      type: 'visible',
      expected: cleaned,
      description: cleaned,
    };
  }

  const type = typeMatch[1].toLowerCase() as PlaybookAssertion['type'];
  const rest = cleaned.slice(typeMatch[0].length).trim();

  // Extract expected value from backticks
  const expectedMatch = rest.match(/`([^`]+)`/);
  const targetMatch = rest.match(/`([^`]+)`/g);

  return {
    type,
    description: rest.replace(/`[^`]+`/g, '').replace(/[—–-]/g, '').trim(),
    expected: expectedMatch?.[1] || '',
    target: targetMatch?.[1] || undefined,
  };
}

function normalizeAction(action: string): PlaybookStep['action'] {
  const map: Record<string, PlaybookStep['action']> = {
    navigate: 'navigate', goto: 'navigate', open: 'navigate',
    click: 'click', tap: 'click', press: 'click',
    fill: 'fill', input: 'fill', type: 'type', enter: 'type',
    select: 'select', choose: 'select', pick: 'select',
    wait: 'wait', pause: 'wait', sleep: 'wait',
    screenshot: 'screenshot', capture: 'screenshot',
    assert: 'assert', verify: 'assert', check: 'assert', expect: 'assert',
    sign_in: 'sign_in', login: 'sign_in', authenticate: 'sign_in',
    sign_out: 'sign_out', logout: 'sign_out',
  };
  return map[action.toLowerCase()] || 'click';
}

// ===== Full Parser =====

/**
 * Parse a complete test playbook from NKS markdown.
 */
export function parsePlaybook(markdown: string): TestPlaybook {
  const { frontmatter, body } = parseFrontmatter(markdown);
  const scenarios = parseScenarios(body);

  if (scenarios.length === 0) {
    throw new Error(`Playbook "${frontmatter.name}" has no scenarios defined`);
  }

  return {
    name: frontmatter.name,
    type: 'test-playbook',
    description: frontmatter.description,
    version: frontmatter.version,
    targetUrl: frontmatter.targetUrl,
    targetSystem: (frontmatter.targetSystem || 'neptune-chat') as TargetSystem,
    user: (frontmatter.user || 'tester') as TestUserRole,
    severity: (frontmatter.severity || 'medium') as TestPlaybook['severity'],
    estimatedMinutes: frontmatter.estimatedMinutes || 5,
    tags: frontmatter.tags || [],
    scenarios,
  };
}

/**
 * Validate a playbook's structure and content.
 * Returns { valid, errors[] }
 */
export function validatePlaybook(playbook: TestPlaybook): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!playbook.name) errors.push('Missing name');
  if (!playbook.targetUrl) errors.push('Missing targetUrl');
  if (!playbook.scenarios || playbook.scenarios.length === 0) errors.push('No scenarios');
  if (!playbook.version) errors.push('Missing version');

  for (const scenario of playbook.scenarios) {
    if (!scenario.name) errors.push(`Scenario missing name`);
    if (!scenario.steps || scenario.steps.length === 0) {
      errors.push(`Scenario "${scenario.name}" has no steps`);
    }
    for (const step of scenario.steps) {
      if (!step.action) errors.push(`Step in "${scenario.name}" missing action`);
    }
  }

  return { valid: errors.length === 0, errors };
}
