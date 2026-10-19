# DSH Redis

English | [简体中文](README.zh.md)

A community Redis viewer for the native right sidebar in **DeepSeek Harness (DSH)**. Browse six core Redis types and let the conversation read the connection you opened manually. All current data operations are read-only.

**Status:** local development package `dsh-redis@0.1.0`. No public release or registry download is claimed. Verified against **DSH Web `0.2.0-rc.2` on Windows**; that Host version is a prerelease.

![Hash table with same-screen field and value previews](docs/screenshots/hash-workbench-dark.jpg)

*Recorded on 2026-10-19 in DSH Web `0.2.0-rc.2`, using isolated fixture data. This is an existing six-type viewer capture, not a new acceptance run for this documentation revision. [Screenshot provenance](docs/screenshots/README.md).*

## Features

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

## Requirements

- **Host:** DSH Web `0.2.0-rc.2`, with matching DSH peer packages declared in `package.json`.
- **Runtime/build:** Node.js `^22.19.0 || >=24.0.0`; verified locally with Node.js `22.22.1` and pnpm `11.22.0`.
- **Redis:** a standalone server reachable from the DSH Host. Existing evidence covers isolated Redis `8.2.6` for six types and live Redis `8.10.0` for Hash, rather than an exhaustive version matrix.
- **Chat:** an available model configured in DSH and permission to use the plugin's tools. Sidebar browsing does not require a separate model API key.

Desktop, macOS and Linux operation have not been verified. The declared Node.js range is broader than the versions actually tested.

## Install and update

Use a verified built `.tgz`, not a source-only archive. There is currently no verified public download URL in this workspace.

In DSH, choose **Plugins → Add plugin**, enter the archive's absolute path on the Host machine, install, then choose **Enable now**. Use the same profile that serves your DSH browser. Follow a requested Host restart when live reload is unavailable.

To build the local archive from this checkout:

```powershell
pnpm install --frozen-lockfile
pnpm pack --pack-destination .release
```

The default `prepack` runs strict type checking, a fresh build and the regression suite. See the [installation guide](docs/INSTALLATION.md) for complete SHA-named package and CLI commands, profile selection, update/rollback and uninstall steps. The verified DSH plugin manager updates this bundle by uninstalling it and installing the new archive.

## First use

1. Open a DSH conversation, then select **Redis** in its right sidebar.
2. Choose **Select or create connection**. Enter address, port and optional ACL credentials; expand TLS when needed. A name and optional group let you save non-password settings.
3. Choose **Connect**. A new connection starts at DB 0 and loads Keys automatically in batches. Saving settings alone does not connect.
4. Select the DB, folder and Key. Select a collection row to inspect it directly; change preview format, find or copy from its toolbar.
5. Auto-refresh starts off, with a 5-second interval selected. Enable it with the refresh control. Key/DB/session changes, hiding the view, cancellation or a read failure stop it; showing the view again does not turn it back on automatically.
6. In the same conversation, ask to read the current selection or search for a Key. Ask explicitly when you want to switch DB; the sidebar follows the Host's new DB.

Editing or saving a profile while connected does not change the active server. Disconnect, choose the intended settings and connect manually to change servers.

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

## Documentation and license

- [Installation, update and uninstall](docs/INSTALLATION.md)
- [中文安装、更新与卸载](docs/INSTALLATION.zh.md)
- [Changelog](CHANGELOG.md)
- [Development and maintenance (中文)](docs/DEVELOPMENT.md)
- [Screenshot provenance](docs/screenshots/README.md)

MIT licensed; see [LICENSE](LICENSE). Attributions are retained in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and the [license directory](licenses/). This is a community plugin, not an official Redis or DeepSeek product.
