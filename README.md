<p align="center">
  <img src="docs/screenshots/readme-header.gif" width="100%" alt="DSH Redis — read-only Redis browsing in DeepSeek Harness">
</p>

# DSH Redis

English | [简体中文](README.zh.md) · [Static title](docs/screenshots/readme-header.svg)

[DSH Redis](https://github.com/WhitePlusMS/dsh-redis) by **WhitePlusMS** is a community plugin for **DeepSeek Harness (DSH)** that brings Redis browsing into the same workspace as the conversation. Find a Key, select a row to inspect its details, then ask DSH about the current selection. It supports six core Redis types and reads through the connection opened manually in that conversation.

**Read-only · Standalone Redis + TLS · Windows / DSH Web `0.2.0-rc.2` (prerelease)**

[Install](#install-and-update) · [First use](#first-use) · [Features](#features) · [Conversation access](#conversation-access) · [Limits](#data-and-limits) · [Uninstall](#uninstall) · [FAQ](#faq)

![Hash table with same-screen field and value previews](docs/screenshots/hash-workbench-dark.jpg)

*Recorded on 2026-10-19 in DSH Web `0.2.0-rc.2`, using isolated fixture data. This is an existing six-type viewer capture, not a new acceptance run for this documentation revision. [Screenshot provenance](docs/screenshots/README.md).*

![Manually connect Redis, browse DB and Keys, inspect the selected row, then ask in the same DSH conversation](docs/screenshots/readme-flow.svg)

## Install and update

Use the verified **DSH Web `0.2.0-rc.2`** environment and a working pnpm on the Host. The CLI method also requires `dsh` in that Host's terminal. Both methods below install the same prebuilt Release `.tgz`, using DSH's supported tarball mechanism. See the [official packaging guide](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/docs/user/develop/basic/publish.zh.md) and [plugin manager](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/client/ui-plugin-manager/README.zh.md).

**Version: `v0.1.0`.** Obtain `dsh-redis-0.1.0.tgz` and `SHA256SUMS.txt` from the [versioned Release](https://github.com/WhitePlusMS/dsh-redis/releases/tag/v0.1.0). [WhitePlusMS/dsh-redis](https://github.com/WhitePlusMS/dsh-redis) remains private, so sign in with an account that has repository access before downloading.

The maintainer's delivery order is **checked commit → build and `pnpm pack` → `v<version>` tag → GitHub Release with `.tgz` and `SHA256SUMS.txt` → installation**. Ordinary users receive the built package; [release preparation](docs/DEVELOPMENT.md#8-版本化发布与安装入口) belongs to the maintainer.

### 1. Install through DSH

1. Open [Releases](https://github.com/WhitePlusMS/dsh-redis/releases) and select a published version. Obtain its `dsh-redis-<version>.tgz` and `SHA256SUMS.txt`, and verify the checksum.
2. In DSH, open **Plugins → Add plugin**. For a public Release, paste its complete, versioned asset URL. For this private repository, sign in to GitHub, download the asset, place it on the Host, and enter that file's absolute path.
3. Install, then choose **Enable now**. Open the installed plugin's details to confirm `dsh-redis`, `v0.1.0` and its running `ui-redis` component, then open **Redis** in a conversation's right sidebar. Follow a Host restart notice when live reload is unavailable.

Fixed `v0.1.0` asset address (authenticated access required while private):

```text
https://github.com/WhitePlusMS/dsh-redis/releases/download/v0.1.0/dsh-redis-0.1.0.tgz
```

A browser's GitHub login is not passed to the Host's package installer. Keep using the authenticated-download/local-file route while the repository is private.

### 2. Install through the CLI

For a published, publicly downloadable Release, run on the Host:

```powershell
dsh plugin --profile web add https://github.com/WhitePlusMS/dsh-redis/releases/download/v0.1.0/dsh-redis-0.1.0.tgz
dsh plugin --profile web list dsh-redis
```

For a private Release, download the same asset first, replace this example path with its actual Host location, then run:

```powershell
$packageForInstall = (Resolve-Path -LiteralPath 'C:\dsh-plugins\dsh-redis-0.1.0.tgz').Path
dsh plugin --profile web add $packageForInstall
dsh plugin --profile web list dsh-redis
```

Use the profile and `DSH_HOME` that serve your browser; `web` is the Web example, not a Desktop profile. Start Web with its existing command (`dsh web` for the default Web setup), or restart that original instance if required. The Release archive contains `lib/`; GitHub's automatically generated **Source code** archive is a different artifact.

### Update an installed version

Obtain the target version's Release asset and checksum. In **Plugins**, uninstall the old package, install the new asset through the same route, then enable it. For CLI replacement, stop the target Host when needed and run:

```powershell
dsh plugin --profile web remove dsh-redis
dsh plugin --profile web add $packageForInstall
```

Here `$packageForInstall` must identify the **new** verified asset path or its publicly downloadable fixed-version URL. Restart the same profile when required. Keep the old asset for rollback; see the [installation guide](docs/INSTALLATION.md) for profile checks, local builds, update/rollback and saved data.

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

- **Host:** DSH Web `0.2.0-rc.2`, with matching DSH peer packages declared in `package.json`.
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

The Key list caches at most 5,000 Keys or 2 MiB of encoded results. Each automatic scan starts at most 1,000 batches and does not start another batch after 60 seconds; you can continue it manually. If the cache limit causes part of a batch to be dropped, narrow the filter and scan again. A filtered or interrupted scan is not a full DB snapshot, and `SCAN` is not a consistent snapshot during concurrent changes. AI replies have a 64 KiB result budget; the default String window and some collection value prefixes are 4,096 bytes. Completion and value truncation are reported separately.

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
