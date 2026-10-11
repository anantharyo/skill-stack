# skillstack

Portable collection of agent skills from this laptop. The folders below keep each skill's original name and supporting files. **Copy the skill folder containing `SKILL.md` intact; don't flatten its contents.**

## Install a skill

1. Open **Code → Download ZIP** on this repository and extract the archive.
2. Pick a source folder below and copy the specific skill folder (the folder that contains `SKILL.md`) into the destination harness folder on your machine.
3. Restart or refresh the agent harness if it doesn't detect the skill yet.

On Windows, `%USERPROFILE%` is your home folder (for example, `C:\Users\you`). On macOS/Linux, use `~` for your home folder.

| Source in this repo | Copy the skill folder into |
| --- | --- |
| `codex/skills/<skill>` | `%USERPROFILE%\.codex\skills\<skill>` |
| `agents/skills/<skill>` (shared agent skills) | `%USERPROFILE%\.agents\skills\<skill>` |
| `antigravity/config/skills/<skill>` | `%USERPROFILE%\.gemini\config\skills\<skill>` |
| `antigravity/antigravity-cli/skills/<skill>` | `%USERPROFILE%\.gemini\antigravity-cli\skills\<skill>` |
| `antigravity/legacy/skills/<skill>` | `%USERPROFILE%\.gemini\antigravity\skills\<skill>` |
| `hermes/skills/<skill>` | `%USERPROFILE%\.hermes\skills\<skill>` |

The Codex plugin cache is included as a source archive under `codex/plugins/cache/`. To install one of those skills as a user skill, copy the folder containing its `SKILL.md` into `%USERPROFILE%\.codex\skills\<skill>`; plugin runtimes and plugin settings are not included.

Project-local skills are in `projects/` with their original project-relative path. Copy them to a global folder above only if you want to use them outside their original project. `manifest.json` lists the 127 skill folders and their relative paths.

## What's included

- Codex user/system skills and installed plugin skill folders
- Shared agent skills, including agent-reach and ponytail
- Antigravity config, CLI, and legacy skill locations
- Hermes user skills
- Project-local skills found under the Codex projects folder

This repository is a snapshot of skill folders only. It does not include harness applications, plugin runtimes, credentials, or machine-specific settings.
