# Changelog

User-facing changes for DSH Redis. [English README](README.md) · [中文 README](README.zh.md)

## [Unreleased]

Recorded through **2026-10-20**, including documentation maintenance; runtime acceptance cited below was recorded on 2026-10-19. The manifest currently uses `0.1.0` as a local development package version. This repository has no release tag or configured public remote at this checkpoint; this entry is not a published `0.1.0` release or a release date.

以下为截至 **2026-10-20** 的未发布记录（含文档整理），所引用运行验收发生于2026-10-19。`package.json` 的 `0.1.0` 是本地开发包标识，不代表已经发布；本轮只整理本地交付材料。

### Added

- A native DSH Redis sidebar and expanded workbench with light/dark themes and English/Chinese text.
- Standalone Redis connections with ACL credentials, TLS and optional private CA, plus named/grouped local connection profiles without saved passwords.
- DB navigation, automatic batched Key loading, counts/progress, MATCH filters, tree/list navigation and Key location.
- Read-only String, Hash, List, Set, ZSet and Stream viewers. Collection rows show details on the same screen and append results on scroll; Stream preserves duplicate field identities.
- Text/JSON/Hex/Base64 previews, find, JSON folding and copying the currently read content.
- Four custom tools through the native DSH Tool API: `redis_viewer_status`, `redis_viewer_keys`, `redis_viewer_value`, `redis_viewer_select_db`. Chat reuses the connection owned by the same conversation and can read its selected Key or row.
- Explicit conversation-driven DB selection with sidebar synchronization, without opening a second Redis connection.
- English/Chinese READMEs, installation/update/uninstall guides, screenshot provenance and a development guide for local maintenance.

### Changed

- Consolidated the product around the six core types and daily read-only browsing.
- Replaced repeated “continue scan” interactions with automatic bounded Key batches and scroll-based collection loading.
- Standardized compact toolbars and same-screen collection inspection; retained cyan/purple/orange navigation and standardized action icons on Lucide.
- Kept UI paging and AI paging independent while sharing the session-owned Redis connection.

### Fixed

- Separated the saved-profile edit draft from the actual connected server, so editing/saving a different profile does not silently change the active target.
- Preserved the selected row and applicable preview/find/fold/scroll state during a refresh of the same query; refresh does not schedule overlapping reads.
- Stopped automatic refresh on target/session changes, hidden views, cancellation and read failure, instead of silently resuming it later.
- Bound AI selection reads to raw identities and the current connection generation, including binary identities and duplicate Stream fields.

### Removed from the current viewer

- Dedicated special-type viewers and charts, diagnostic snapshots, URI and profile import/export, a separate connection-test action and automatic DB/Key restoration.
- The separate explicit Base64 decode workflow. Base64 as a preview format remains available.

### Verification and remaining work

- Existing local checks: strict Host/Client/tests type checking, fresh build and **21 test files / 205 tests**.
- Existing isolated Redis/native DSH evidence covers six types. Real-model testing with existing live Redis data covers Hash, current selection, DB switching and session isolation; the other five types did not have live samples in that DB.
- The one observed missing-style/oversized-icon issue recovered after browser reload. Its root cause is unresolved; it is not listed as fixed.
- Writes and per-operation human approval are future candidates only. Current tools do not create, modify or delete Redis data.

## Maintenance convention / 维护约定

Keep future changes under `Unreleased` until a release is explicitly authorized. For an actual release, record its real version and full `YYYY-MM-DD` publication date, move the relevant entries, and verify the tag, built archive and checksum together. Packaging and local Git commits alone do not establish a public release.

Detailed file-level local changes remain in the source checkout's `UPDATE_LOG.md`; this changelog intentionally summarizes user-visible behavior rather than reproducing every internal commit.
