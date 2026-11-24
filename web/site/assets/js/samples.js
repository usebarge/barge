/* Sample agents used by the demo. All keys below are fake and exist only to show redaction. */
(function (root) {
  const SAMPLES = {
    'claude-code': {
      name: 'Cedar',
      blurb: 'Engineering agent: two commands, a changelog skill, a test subagent, two MCP servers and a permission set.',
      files: [
        { path: 'cedar/CLAUDE.md', text: `# Cedar

You are Cedar, the engineering agent for the Basalt web app.

## Workflow
- Read the relevant files before you change anything.
- Run \`npm run test\` after every change and fix what breaks.
- Keep pull requests under 400 lines. Split larger work.

## Code style
- TypeScript strict mode. No \`any\`.
- Prefer small pure functions. Name things for what they do.
- Every exported function gets a short doc comment.

## Memory
- The production database is Postgres 16 on Neon.
- Releases go out on Tuesdays and Thursdays.
- The design system lives in packages/ui.
` },
        { path: 'cedar/.claude/commands/review.md', text: `---
description: Review the current diff like a senior engineer
argument-hint: [focus area]
---

Review the staged changes. Focus on $ARGUMENTS if given.
List bugs first, then risks, then style. Quote file and line for each point.
` },
        { path: 'cedar/.claude/commands/ship.md', text: `---
description: Prepare a release branch and changelog
allowed-tools: Bash(git:*), Bash(npm run build)
---

Create a release branch from main, bump the version, build, and draft the changelog with the changelog skill.
` },
        { path: 'cedar/.claude/skills/changelog/SKILL.md', text: `---
name: changelog
description: Writes a clean changelog from merged pull requests since the last tag
---

# Changelog

1. Run scripts/collect.sh to list merged pull requests since the last tag.
2. Group them under Added, Changed and Fixed.
3. One line per change, written for users, not for engineers.
` },
        { path: 'cedar/.claude/skills/changelog/scripts/collect.sh', text: `#!/usr/bin/env bash
set -euo pipefail
last=$(git describe --tags --abbrev=0)
git log "$last"..HEAD --merges --pretty=format:'%s'
` },
        { path: 'cedar/.claude/agents/test-runner.md', text: `---
name: test-runner
description: Runs the test suite and fixes failing tests without changing behaviour
tools: Read, Edit, Bash
---

You run tests. When a test fails, find the smallest fix in the code under test.
Never delete or skip a test to make the suite pass.
` },
        { path: 'cedar/.mcp.json', text: JSON.stringify({
          mcpServers: {
            github: {
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-github'],
              env: { GITHUB_PERSONAL_ACCESS_TOKEN: 'ghp_BargeDemoToken0000000000000000000000' }
            },
            linear: {
              type: 'http',
              url: 'https://mcp.linear.app/mcp',
              headers: { Authorization: 'Bearer lin_api_BargeDemo1234567890abcdef' }
            }
          }
        }, null, 2) },
        { path: 'cedar/.claude/settings.json', text: JSON.stringify({
          permissions: {
            allow: ['Bash(npm run test:*)', 'Bash(npm run lint)', 'Read(./src/**)'],
            ask: ['Bash(git push:*)'],
            deny: ['Read(./.env)', 'Read(./secrets/**)', 'Bash(rm -rf:*)']
          }
        }, null, 2) }
      ]
    },

    codex: {
      name: 'Sable',
      blurb: 'Codex CLI setup: approval policy, one prompt, a PR skill and a Sentry MCP server.',
      files: [
        { path: 'sable/AGENTS.md', text: `# Sable

Sable maintains the payments service.

## Rules
- Never log card data or customer emails.
- Every migration needs a rollback.
- Explain the risk of a change before you make it.

## Commands
- \`make test\` runs the suite.
- \`make lint\` must pass before a commit.
` },
        { path: 'sable/.codex/config.toml', text: `model = "gpt-5-codex"
approval_policy = "on-request"
sandbox_mode = "workspace-write"

[mcp_servers.sentry]
command = "npx"
args = ["-y", "@sentry/mcp-server"]
env = { SENTRY_AUTH_TOKEN = "sntrys_BargeDemo_abcdef1234567890", SENTRY_ORG = "basalt" }
` },
        { path: 'sable/.codex/prompts/explain.md', text: `---
description: Explain a file or function in plain words
argument-hint: <path or symbol>
---

Explain $ARGUMENTS to a new teammate. Start with what it does, then how, then the traps.
` },
        { path: 'sable/.codex/skills/pr-summary/SKILL.md', text: `---
name: pr-summary
description: Summarises a pull request for reviewers in five lines
---

Read the diff. Write five lines: goal, approach, risk, tests, rollback.
` }
      ]
    },

    cursor: {
      name: 'Wren',
      blurb: 'Cursor workspace: two scoped rules, a refactor command and a Postgres MCP server.',
      files: [
        { path: 'wren/.cursor/rules/workflow.mdc', text: `---
description: How we work in this repo
alwaysApply: true
---

Plan in three bullet points before writing code.
Prefer editing existing files over creating new ones.
` },
        { path: 'wren/.cursor/rules/typescript.mdc', text: `---
description: TypeScript conventions
globs: src/**/*.ts,src/**/*.tsx
alwaysApply: false
---

Use zod for every external input.
Return Result types instead of throwing in domain code.
` },
        { path: 'wren/.cursor/commands/refactor.md', text: `Refactor the selected code for readability without changing behaviour. Keep the public API identical and explain each change in one line.
` },
        { path: 'wren/.cursor/mcp.json', text: JSON.stringify({
          mcpServers: {
            postgres: {
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://readonly@localhost:5432/wren']
            },
            figma: {
              url: 'https://mcp.figma.com/mcp',
              headers: { 'X-Figma-Token': 'figd_BargeDemo_0123456789abcdefghij' }
            }
          }
        }, null, 2) }
      ]
    },

    'gemini-cli': {
      name: 'Ember',
      blurb: 'Docs writer on Gemini CLI: saved memories, two TOML commands and a remote MCP server.',
      files: [
        { path: 'ember/GEMINI.md', text: `# Ember

You help write and edit the product documentation.

## Style
- Short sentences. Active voice.
- Every page starts with what the reader can do after reading it.

## Gemini Added Memories
- The docs site is built with Astro.
- The user prefers British spelling.
` },
        { path: 'ember/.gemini/settings.json', text: JSON.stringify({
          mcpServers: {
            notion: {
              httpUrl: 'https://mcp.notion.com/mcp',
              headers: { Authorization: 'Bearer ntn_BargeDemo0123456789abcdefghij' }
            }
          }
        }, null, 2) },
        { path: 'ember/.gemini/commands/outline.toml', text: `description = "Draft an outline for a new docs page"
prompt = """
Draft an outline for a docs page about {{args}}.
Use at most six sections. Each section gets one sentence of intent.
"""
` },
        { path: 'ember/.gemini/commands/git/commit.toml', text: `description = "Write a commit message for the staged docs changes"
prompt = "Write a one-line commit message in the imperative for the staged changes. {{args}}"
` }
      ]
    },

    openclaw: {
      name: 'Ivy',
      blurb: 'Personal OpenClaw assistant: soul, user profile, daily memories, a weather skill and a heartbeat.',
      files: [
        { path: 'ivy/IDENTITY.md', text: `# IDENTITY.md

- **Name:** Ivy
- **Creature:** a calm assistant who keeps things moving
- **Emoji:** none
` },
        { path: 'ivy/SOUL.md', text: `# SOUL.md

You are warm, brief and direct. You never pad an answer.
You care about the user's time more than about sounding clever.
` },
        { path: 'ivy/USER.md', text: `# USER.md

- Name: Sam
- Timezone: Europe/Paris
- Works as a product designer. Prefers summaries before details.
` },
        { path: 'ivy/AGENTS.md', text: `# AGENTS.md

## Every session
- Read SOUL.md, USER.md and today's memory file first.
- Write anything worth keeping to memory/YYYY-MM-DD.md.

## Safety
- Ask before sending anything on the user's behalf.
` },
        { path: 'ivy/MEMORY.md', text: `# MEMORY.md

- Sam's weekly review is on Friday afternoon.
- Sam does not drink coffee after 2 pm.
- The studio's shared drive is called Atelier.
` },
        { path: 'ivy/memory/2026-11-12.md', text: `- Booked the dentist for 19 November, 9:30.
- Sam asked for a reminder to renew the Figma licence.
` },
        { path: 'ivy/HEARTBEAT.md', text: `# HEARTBEAT.md

- Every morning, summarise new calendar invites.
- On Fridays at 15:00, prepare the weekly review notes.
` },
        { path: 'ivy/TOOLS.md', text: `# TOOLS.md

- The calendar is Google Calendar under the work account.
- Use the weather-brief skill before suggesting outdoor plans.
` },
        { path: 'ivy/skills/weather-brief/SKILL.md', text: `---
name: weather-brief
description: Gives a two-line weather brief for the user's city
---

Fetch today's forecast for the user's city. Reply in two lines: conditions, then what to wear.
` }
      ]
    },
    windsurf: {
      name: 'Rowan',
      blurb: 'Windsurf project: glob rules, a release workflow and a remote MCP server.',
      files: [
        { path: 'rowan/.windsurf/rules/core.md', text: `---
trigger: always_on
description: Core standards
---

Write small, typed components. Composition over inheritance.
Explain any trade-off in one sentence before you make it.
` },
        { path: 'rowan/.windsurf/rules/tests.md', text: `---
trigger: glob
description: Test conventions
globs: **/*.test.ts
---

Every test has one assertion focus. Name tests after behaviour, not functions.
` },
        { path: 'rowan/.windsurf/workflows/release.md', text: `---
description: Cut a release
---

Bump the version, update the changelog, tag the commit and open the release PR.
` },
        { path: 'rowan/.codeium/windsurf/mcp_config.json', text: JSON.stringify({
          mcpServers: {
            linear: { serverUrl: 'https://mcp.linear.app/mcp', headers: { Authorization: 'Bearer lin_api_BargeDemo1234567890abcdef' } }
          }
        }, null, 2) }
      ]
    },

    cline: {
      name: 'Larch',
      blurb: 'Cline project: style and API rules, a hotfix workflow, a SQL skill and an MCP server.',
      files: [
        { path: 'larch/.clinerules/01-style.md', text: `# Style

Prefer pure functions. Keep files under 300 lines.
Use named exports only.
` },
        { path: 'larch/.clinerules/02-api.md', text: `---
paths:
  - src/api/**
---

Every handler validates input with zod and returns typed errors.
` },
        { path: 'larch/.clinerules/workflows/hotfix.md', text: `Create a hotfix branch from the latest tag, apply the fix, add a regression test and open a PR.
` },
        { path: 'larch/.clinerules/skills/sql-review/SKILL.md', text: `---
name: sql-review
description: Reviews SQL migrations for locks and missing indexes
---

Check every migration for table locks, missing indexes and irreversible steps.
` },
        { path: 'larch/cline_mcp_settings.json', text: JSON.stringify({
          mcpServers: {
            postgres: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://readonly@localhost:5432/larch'], env: {}, disabled: false, autoApprove: [] }
          }
        }, null, 2) }
      ]
    },

    goose: {
      name: 'Basalt',
      blurb: 'Goose agent: project hints and two extensions, one of them holding a secret key.',
      files: [
        { path: 'basalt/.goosehints', text: `# Basalt

You help run the data platform.

## Rules
- Never run a write query without showing it first.
- Prefer dbt models over raw SQL.
` },
        { path: 'basalt/.config/goose/config.yaml', text: `GOOSE_PROVIDER: anthropic
extensions:
  developer:
    enabled: true
    name: developer
    type: builtin
  github:
    name: GitHub
    cmd: npx
    args: [-y, "@modelcontextprotocol/server-github"]
    enabled: true
    envs: { "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_BargeDemoToken0000000000000000000000" }
    type: stdio
    timeout: 300
  docs:
    name: Docs
    type: streamable_http
    uri: "https://mcp.docs.example.com/mcp"
    enabled: true
    timeout: 300
` }
      ]
    },

    aider: {
      name: 'Moss',
      blurb: 'Aider project: conventions that load in every session.',
      files: [
        { path: 'moss/CONVENTIONS.md', text: `# Moss

## Python
- Type hints everywhere. Use dataclasses for plain data.
- Prefer httpx over requests.

## Tests
- pytest only. One file per module.
` },
        { path: 'moss/.aider.conf.yml', text: `read: CONVENTIONS.md
auto-commits: false
` }
      ]
    },

    hermes: {
      name: 'Fern',
      blurb: 'Hermes agent: soul, memories, a standup skill and an MCP server.',
      files: [
        { path: 'fern/.hermes/SOUL.md', text: `You are Fern. Calm, exact and quietly funny.
You prefer one good answer over three average ones.
` },
        { path: 'fern/AGENTS.md', text: `# Project notes

- The repo uses pnpm workspaces.
- Deploys run from the main branch only.
` },
        { path: 'fern/.hermes/memories/MEMORY.md', text: `Staging lives at staging.fern.dev
§
The user ships on Wednesdays
` },
        { path: 'fern/.hermes/memories/USER.md', text: `Name: Lea. Backend engineer. Likes short answers.
` },
        { path: 'fern/.hermes/skills/standup/SKILL.md', text: `---
name: standup
description: Writes a three-line standup from yesterday's commits
---

Read yesterday's commits. Write done, doing, blocked. One line each.
` },
        { path: 'fern/.hermes/config.yaml', text: `model:
  default: hermes-4
mcp_servers:
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/home/lea/fern"]
  sentry:
    url: "https://mcp.sentry.dev/mcp"
    headers:
      Authorization: "Bearer sntrys_BargeDemo_abcdef1234567890"
` }
      ]
    }
  };

  function sampleFiles(id) {
    const s = SAMPLES[id];
    return s ? s.files.map(f => ({ path: f.path, text: f.text })) : [];
  }

  const api = { SAMPLES, sampleFiles };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BargeSamples = api;
})(typeof self !== 'undefined' ? self : this);
