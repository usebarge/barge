# bargedot

Move your AI agent between 25 platforms from the terminal. Part of [Barge](https://bargedot.fun).

```
npx -y https://bargedot.fun/bargedot.tgz cursor        # no install needed
npx bargedot cursor            # the agent in this folder, laid out for Cursor
npx bargedot everywhere        # one zip with the agent for all 25 platforms
npx bargedot list              # platform ids
```

Barge reads instructions, memory, skills, commands, subagents, MCP servers and permissions from
Claude Code, Codex CLI, Cursor, Gemini CLI, Windsurf, GitHub Copilot, OpenClaw and more, and writes
them in the target platform's own format. It only reads your folder and writes a zip next to it.
Keys and tokens are stripped before anything is written.

Options: `--out <file.zip>`, `--name <agent name>`, `--force`.
