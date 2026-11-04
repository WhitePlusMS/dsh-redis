<p align="center">
  <img src="docs/screenshots/readme-header.gif" width="100%" alt="DSH Redis — read-only Redis browsing in DeepSeek Harness">
</p>

# DSH Redis

English | [简体中文](README.zh.md) · [Static title](docs/screenshots/readme-header.svg)

[DSH Redis](https://github.com/WhitePlusMS/dsh-redis) by **WhitePlusMS** is a community plugin for **DeepSeek Harness (DSH)** that brings Redis browsing into the same workspace as the conversation. Find a Key, select a row to inspect its details, then ask DSH about the current selection. It supports six core Redis types and reads through the connection opened manually in that conversation.

**Read-only · Standalone Redis + TLS · Windows / DSH Web `0.2.1-rc.5` (prerelease)**

[Install](#install-and-update) · [First use](#first-use) · [Features](#features) · [Conversation access](#conversation-access) · [Limits](#data-and-limits) · [Uninstall](#uninstall) · [FAQ](#faq)

![Hash table with same-screen field and value previews](docs/screenshots/hash-workbench-dark.jpg)

*Recorded on 2026-10-19 in DSH Web `0.2.0-rc.2`, using isolated fixture data. This is an existing six-type viewer capture, not a new acceptance run for this documentation revision. [Screenshot provenance](docs/screenshots/README.md).*

![Manually connect Redis, browse DB and Keys, inspect the selected row, then ask in the same DSH conversation](docs/screenshots/readme-flow.svg)

## Install and update

Version `0.1.1` targets DSH Web `0.2.1-rc.5`. This version is available from the repository source; a 0.1.1 GitHub Release has not been published. On the Host, from this checkout:

```powershell
pnpm install --frozen-lockfile
pnpm pack --pack-destination .release
$packageForInstall = (Resolve-Path -LiteralPath '.release/dsh-redis-0.1.1.tgz').Path
dsh plugin --profile web add $packageForInstall
```

The pack command runs type checking, build and tests. Keep the archive at that path while the profile references it, and restart the same DSH profile if needed. The earlier [0.1.0 Release](https://github.com/WhitePlusMS/dsh-redis/releases/tag/v0.1.0) targets DSH 0.2.0-rc.2; do not use it with 0.2.1-rc.5. The older [installation guide](docs/INSTALLATION.md) describes that earlier release.

## First use

1. Open a DSH conversation, then select **Redis** in its right sidebar.
2. Choose **Select or create connection**. Enter address, port and optional ACL credentials; expand TLS when needed. A name and optional group let you save non-password settings.
3. Choose **Connect**. A new connection starts at DB 0 and loads Keys automatically in batches. Saving settings alone does not connect.
4. Select the DB, folder and Key. Select a collection row to inspect it directly; change preview format, find or copy from its toolbar.
5. Auto-refresh starts off, with a 5-second interval selected. Enable it with the refresh control. Key/DB/session changes, hiding the view, cancellation or a read failure stop it; showing the view again does not turn it back on automatically.
6. In the same conversation, ask “Explain the selected field”. Ask explicitly when you want to switch DB; the sidebar follows the Host's new DB.

Editing or saving a profile while connected does not change the active server. Disconnect, choose the intended settings and connect manually to change servers.

## Features

<details>
<summary>Full feature list and six-type views</summary>

| Area | Available behavior |
| --- | --- |
| Connections | Standalone Redis address/port, optional ACL username/password, TLS with optional private CA; manual connect/disconnect |
| Saved profiles | Select, create, name, group, update and delete local connection settings; passwords are not saved |
| DB and Keys | DB directory and counts, manual DB selection, automatic batched `SCAN`, MATCH filtering, loaded count and bounded progress |
| Navigation | Namespace tree or flat list, configurable separator, locate and keyboard navigation; cyan DB, purple folder and orange Key icons |
| Data | String, Hash, List, Set, ZSet and Stream; select a row to inspect it on the same screen, scroll to append collection results |
| Previews | Text, JSON, Hex and Base64, find, JSON folding and copying currently read content |
| Refresh | Manual refresh and optional 1/5/10/30-second refresh; selected content and view state are preserved when still present |
| DSH integration | Native sidebar, expanded workbench, light/dark theme, English/Chinese, Lucide action icons |
| Conversation | Four plugin tools registered through the DSH Tool API: status, Key search, value read and explicit DB selection |

| Type | View |
| --- | --- |
| String | Bounded byte-window preview |
| Hash | Field/value table with separate field and value previews |
| List | Index/value table and selected element preview |
| Set | Member table and selected member preview |
| ZSet | Member/score table, range or scan, selected member preview |
| Stream | Message table, ordered field/value pairs and selected pair previews; duplicate field names remain distinct |

The compact Stream layout uses the same row-selection workflow:

![Stream messages and field details in the narrow DSH sidebar](docs/screenshots/stream-sidebar-dark.jpg)

*Recorded on 2026-10-19 with isolated fixture data; the Redis sidebar is approximately 464 px wide. The surrounding DSH workspace is part of the native capture.*

</details>

## Requirements

- **Host:** DSH Web `0.2.1-rc.5`, with matching DSH peer packages declared in `package.json`.
- **Runtime/build:** Node.js `^22.19.0 || >=24.0.0`; verified locally with Node.js `22.22.1` and pnpm `11.22.0`.
- **Redis:** a standalone server reachable from the DSH Host. Existing evidence covers isolated Redis `8.2.6` for six types and live Redis `8.10.0` for Hash, rather than an exhaustive version matrix.
- **Chat:** an available model configured in DSH and permission to use the plugin's tools. Sidebar browsing does not require a separate model API key.

Desktop, macOS and Linux operation have not been verified. The declared Node.js range is broader than the versions actually tested.

## Conversation access

| Tool | Purpose |
| --- | --- |
| `redis_viewer_status` | Report this conversation's connection, DB and current selected identity |
| `redis_viewer_keys` | Search Keys with bounded, independently paged results |
| `redis_viewer_value` | Read a named Key or, with no Key argument, the current sidebar selection |
| `redis_viewer_select_db` | Switch this conversation's DB when explicitly requested and synchronize the sidebar |

These are custom tools registered through DSH's native Tool API, **not an MCP server**. The Client uses Typert RPC to synchronize selection identifiers; values are read from Redis when a tool is called. UI and AI paging state are separate, while both use the same session-owned network connection.

Example requests, rather than recorded model answers: “Explain the selected field”, “Find Keys matching `order:*`”, or “Switch to DB 1 and inspect the Key I name”. A conversation without a manually opened connection cannot borrow another conversation's connection.

## Data and limits

Saved profiles live at `<DSH_HOME>/profiles/<profile>/data/dsh-redis/connections.json`. They contain names/groups, address, port, username and TLS/CA settings, **not passwords**. Profiles are shared within that DSH profile; connections and selections belong to individual conversations. A restarted connection does not automatically restore the previous DB or Key.

AI tool output becomes part of DSH conversation history and may be sent to the model provider configured for that conversation. Selecting a Key does not automatically send the whole DB to the model. Uninstalling retains saved profiles and does not erase conversation history; [cleanup instructions](docs/INSTALLATION.md#disable-uninstall-or-remove-saved-connections) distinguish those operations.

Key scanning is bounded at 5,000 Keys, 2 MiB of encoded results, 1,000 batches or 60 seconds. A filtered or interrupted scan is not a full DB snapshot, and `SCAN` is not a consistent snapshot during concurrent changes. AI replies have a 64 KiB result budget; the default String window and some collection value prefixes are 4,096 bytes. Completion and value truncation are reported separately.

Not included: Redis writes, a free-form command console, direct RDB/AOF loading, snapshots/diagnostics, dedicated special-type views, charts, URI import, profile import/export, Cluster, Sentinel, built-in SSH tunnels or client-certificate authentication. JSON in a normal String can still be formatted; underlying String/ZSet bytes can be inspected without a dedicated Bitmap/HLL/GEO interpretation.

## Verification and known issue

As of 2026-10-19, the existing strict checks and regression suite contain **21 test files / 205 tests**. They do not replace Redis or native DSH acceptance. Prior isolated Redis and native DSH checks cover six types; live-model acceptance against the user's existing data covers Hash, current selection, DB switching and session isolation. The other five types had no live-data samples in that DB and are not claimed as live-data acceptance.

A missing style node and oversized icons were observed once during native testing. Reloading the browser restored styling; the root cause remains unresolved. Historical verification records are in the source checkout; they do not imply every previous feature remains in the slim viewer.

## Future work

These candidates are not implemented or scheduled. The current version stays read-only.

- [ ] Optional writes: start with adding/updating one Hash field; consider field deletion and whole-Key deletion later.
- [ ] Temporary manual unlock for the current session connection, off by default and reset on disconnect/reconnect/replacement. Unlocking is not approval of an operation.
- [ ] Preview each change's server, DB, Key, field, before/after content and TTL impact. AI proposes; the user chooses whether to execute.
- [ ] Host-enforced, single-use human approval bound to that exact operation. An AI-supplied `confirm: true` is not approval; target, DB or data changes invalidate it.
- [ ] Verify locked/unconfirmed/cancelled/repeated and changed-target/data cases, then confirm existing reads and session isolation before considering release.

Bulk deletion, DB flushing, arbitrary commands and script execution are outside this candidate scope.

## Uninstall

In DSH, uninstall **dsh-redis** from **Plugins**, or stop the target profile as required and run:

```powershell
dsh plugin --profile web remove dsh-redis
```

Reload/restart that same profile when required. Uninstalling retains saved connection profiles and DSH conversation history; [settings cleanup](docs/INSTALLATION.md#disable-uninstall-or-remove-saved-connections) is a separate operation.

## FAQ

**Why does the Release URL return 404?**

Check the exact tag and `.tgz` filename, and confirm that your account has repository access. Signing into GitHub in a browser does not authenticate a separate Host download; use the downloaded-file route for this private Release.

**Can I install GitHub's Source code archive instead?**

The current Git tree omits `lib/`, while the package entry points require it. Use the built Release `.tgz`, or [build a local package](docs/INSTALLATION.md#prepare-a-built-package). A source tag alone does not make a loadable Redis package.

**Why does `cannot resolve profile bundle "dsh-redis"` appear?**

Check whether the profile still points to a moved/deleted development directory or archive. In that same profile, remove the old source and add the verified built package, then reload/restart as required. A plain dependency `install` retains the old source. See [troubleshooting](docs/INSTALLATION.md#troubleshooting).

## Documentation and license

- [Installation, update and uninstall](docs/INSTALLATION.md)
- [中文安装、更新与卸载](docs/INSTALLATION.zh.md)
- [Changelog](CHANGELOG.md) · [Repository issues](https://github.com/WhitePlusMS/dsh-redis/issues)
- [Development and maintenance (中文)](docs/DEVELOPMENT.md)
- [Screenshot provenance](docs/screenshots/README.md)

MIT licensed; see [LICENSE](LICENSE). Attributions are retained in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and the [license directory](licenses/). This is a community plugin, not an official Redis or DeepSeek product.
