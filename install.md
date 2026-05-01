# Installing quickstart-template (agent-readable)

This file is the agent-driven mirror of `install.sh`. If a user pastes "Read this and follow it" with a link to this file, the agent should execute the steps below in their working directory.

## Inputs

- `<TARGET>`: the directory name for the new project (kebab-case, e.g., `my-app`).

## Pre-flight checks

Before any action, verify these tools are available; abort with a clear error if any are missing:

```bash
git --version
pnpm --version
node --version    # require >= 20
```

## Steps

1. **Verify the target does not exist.** If `<TARGET>` already exists as a file or directory, stop and report: "`<TARGET>` already exists; choose a different name."

2. **Clone the template.**
   ```bash
   git clone --depth=1 https://github.com/__GH_USER__/quickstart-template.git <TARGET>
   ```
   (`__GH_USER__` is the GitHub user/org hosting the template — replace with the actual value before running.)

3. **Enter the cloned directory.**
   ```bash
   cd <TARGET>
   ```

4. **Install dependencies.**
   ```bash
   pnpm install
   ```

5. **Re-initialize git.** The template's history is not the user's history.
   ```bash
   rm -rf .git
   git init
   git add -A
   git commit -m "chore: initial commit from quickstart-template"
   ```

6. **Tell the user what to do next.** Print:
   > Template ready. Open this directory in Claude Code, Codex, or Cursor and say "run quickstart-setup". The setup skill will interview you, provision Cloudflare resources, customize the template, and clean up after itself.

## What the agent should NOT do at this step

- Do **not** run the `quickstart-setup` skill yet — `install.md` is the *bootstrap*; the skill runs in a fresh session after the user opens the cloned directory.
- Do **not** modify `.quickstart-template` (the marker file the skill uses for entry detection).
- Do **not** delete the `.claude/skills/quickstart-setup/` directory — the skill self-removes at its own completion (Stage 3 behavior).

## Troubleshooting

- `git clone` fails with "Could not resolve host": GitHub may be unreachable; retry with VPN off.
- `pnpm install` fails on a missing platform binary (esbuild/lightningcss): re-run `pnpm install`; the `pnpm.onlyBuiltDependencies` whitelist ensures these can rebuild.
- User forgot to install pnpm: run `corepack enable pnpm` and retry.
