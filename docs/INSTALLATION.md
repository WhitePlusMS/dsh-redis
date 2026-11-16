# Install, update and uninstall DSH Redis

English | [简体中文](INSTALLATION.zh.md)

Current source **0.1.2** targets **DSH Web 0.2.2-rc.1**. The older v0.1.0 package targets DSH 0.2.0-rc.2 and should not be installed on the current Host.

## Supported target

- A configured DSH Web `0.2.2-rc.1`; use the profile and `DSH_HOME` serving your browser.
- Node.js `>=24.9.0`, pnpm `11.22.0` and Git. Windows is the verified platform.
- Redis reachable from the Host; dependency download access for building.
- Examples use an existing `web` profile. Skip clone and cd if you already have the checkout.

## Publishing a Release

After committing the release changes, create and push an existing `v<package.json version>` tag, then run **Release package** from GitHub Actions with that tag. The workflow runs `prepack`, installs the package in an isolated DSH profile and runs `scripts/verify-release-package.mjs` before publishing. Stable versions upload both names and checksums; prerelease versions upload the versioned archive and do not set latest. Published assets are downloaded and checked; anonymous fixed-URL verification runs only for a public repository. A failed post-publication check requires investigation: the Release may already exist and must not be blindly overwritten.

## Prepare a built package

The planned stable market URL is `https://github.com/WhitePlusMS/dsh-redis/releases/latest/download/dsh-redis.tgz`. The repository is public, but the current v0.1.2 Release does not yet contain the fixed asset. Register the URL with the market only after a formal Release provides and verifies it. The fixed URL does not automatically update an installed plugin. Keep the versioned archive and checksum for rollback.


Download dsh-redis-0.1.2.tgz and SHA256SUMS.txt from the [v0.1.2 Release](https://github.com/WhitePlusMS/dsh-redis/releases/tag/v0.1.2), compare the archive's SHA-256 to the checksum file, and place it on the DSH Host. Set $packageForInstall to its absolute path before following the installation steps below.

Build the current version from source. Skip building if you already have a trusted built archive. This same-version SHA filename is a development checkpoint, not a replacement for release versions.

In PowerShell, start in the directory where the checkout should be created. If you already have a checkout, enter it and skip `git clone` and `cd`:

```powershell
node --version
pnpm --version
dsh --version
git clone https://github.com/WhitePlusMS/dsh-redis.git
cd dsh-redis
pnpm install --frozen-lockfile
New-Item -ItemType Directory -Force .release | Out-Null
pnpm pack --pack-destination .release

$packagePath = (Resolve-Path -LiteralPath '.release\dsh-redis-0.1.2.tgz').Path
$sha256 = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash.ToLowerInvariant()
$packageForInstall = Join-Path (Split-Path -Parent $packagePath) ("dsh-redis-0.1.2-{0}.tgz" -f $sha256)
Copy-Item -LiteralPath $packagePath -Destination $packageForInstall
$packageForInstall
```

`pnpm pack` invokes `prepack`: strict type checking, a fresh build and the unit regression suite. Do not skip that hook. The SHA-named copy distinguishes different development builds sharing version `0.1.2`; changing its filename does not change the archive content. Keep the archive in place while it is referenced by the profile's dependency manifest and lockfile.

A SHA256 value calculated locally identifies the file you have. When an archive comes from someone else, compare it with a checksum received from that same trusted source; calculating a new checksum alone does not verify its origin.

## Install through the DSH interface

1. In DSH, open **Plugins → Add plugin**.
2. Enter the absolute Host path printed as `$packageForInstall` above, or the path to a trusted built archive you already have. The source must be a built `.tgz`, not a repository page or Source code archive.
3. Choose **Install**. For a local archive, DSH checks the source and installs it; a separate package/version preview is not shown in this verified flow.
4. Choose **Enable now**, then open the installed plugin's details to confirm `dsh-redis`, `0.1.2` and the running `ui-redis` component. Closing the success dialog without enabling leaves the new bundle disabled.
5. Open a conversation and its right sidebar, then select **Redis**. Follow any DSH restart notice when the profile does not support live reload.

The path is resolved on the **DSH Host machine**. A path on the browser's computer does not upload a file to a remote Host. Transfer the archive to that Host first when they are different machines.

DSH supports package specs, Git sources, tarballs and local paths. This project uses built Release tarballs; installation by the bare registry name `dsh-redis` would require a separate npm publication. GitHub Release delivery follows the same supported mechanism as [GitGraph](https://github.com/WhitePlusMS/dsh-git-graph/blob/f4ae9a9b8ed40233f7322df5f967708be9e29316/README.zh.md#安装与更新); it is this project's distribution convention, not DSH's only supported channel.

## Install through the CLI

In the same PowerShell session, use `$packageForInstall` generated above.

Add the selected built package and check it:

```powershell
dsh plugin --profile web add $packageForInstall
dsh plugin --profile web list dsh-redis
```

The archive already contains this plugin's `lib/`; users do not compile it during installation. Package resolution may still download runtime dependencies.

Check **Plugins** for the bundle and enable it if disabled. A profile without live reload needs its normal Host restart before the running application uses the changed dependency. Use the existing start command (`dsh web` for the default Web setup), then refresh the browser after loading completes.

For a configuration-only check, print the composed tree without starting a server:

```powershell
dsh --profile web --dump-config
```

The Redis Host entry is `ui-redis`, supplied by the `dsh-redis` bundle. A package listed by pnpm does not establish that the bundle or Client is active. The configuration can contain other profile settings; do not use the full output as a public attachment.

## Connect and check the installation

1. Open **Select or create connection** in the Redis sidebar.
2. Enter the address and port, optional ACL username and password. Enable TLS when required; provide the CA certificate when the server uses a private CA.
3. Give the connection a name and optional group if you want to save its non-password settings. Choose **Connect** to establish the connection; saving alone does not connect.
4. A new connection starts at DB 0. Select the intended DB and wait for automatic Key loading. Select a Key to view its data.
5. To use chat, stay in this same DSH conversation and ask about the selected Key or field. The model service and DSH tool policy must be available.
6. For AI writes, confirm the connection and DB, then open **Plugin info → Enable AI writes** in the sidebar. Specify an existing String or Hash field and the complete new value in the same conversation. DSH may allow execution directly or request approval according to its policy. See the [README](../README.md#data-and-limits) for supported writes and result lookup.

The Host, rather than the browser, must be able to reach Redis. TLS certificate validation remains enabled. There is no built-in SSH tunnel, Cluster or Sentinel connection mode.

## Update

The verified DSH version has no automatic update operation for this installed bundle. Use **uninstall, then install the new built archive**.

1. Keep the old verified archive and checksum for rollback. Back up the target profile's `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` when present, `cordis.yml` when present and `cordis.patch.yml` when present. Back up the Redis connection file described below if you use saved connections.
2. Build the target version's archive or obtain a trusted built archive and checksum. Use a new version/tag for released updates and keep old assets unchanged. For local development builds sharing a version, use a new SHA-named path.
3. In **Plugins**, disable/unload DSH Redis and uninstall it. If DSH requires stopping the non-live-reload Host, close that profile using its normal shutdown procedure first.
4. Install the new archive and enable the bundle. Restart the same profile when required, then refresh the browser.
5. Manually connect again and verify the expected DB, Key list and value view. Check chat in that same conversation if you use the AI tools.

The CLI equivalent, with `$packageForInstall` set to the new verified archive path or its publicly downloadable fixed-version Release URL, is:

```powershell
dsh plugin --profile web remove dsh-redis
dsh plugin --profile web add $packageForInstall
dsh plugin --profile web list dsh-redis
```

CLI dependency changes alone do not unload an already running Host. For this route, stop the target profile before replacement and start it again using its existing command and environment. Check its bundle switch after reinstalling: an explicitly disabled bundle can remain disabled.

To roll back, repeat the same removal and installation steps with the old verified archive. The current package has a versioned connection-file schema and no general backward-compatibility or downgrade guarantee. Keep the matching connection-file backup if a future version changes that schema.

## Data and settings

| Data | Location and lifetime |
| --- | --- |
| Saved connection profiles | `<DSH_HOME>/profiles/<profile>/data/dsh-redis/connections.json` |
| Saved fields | Name, optional group, host, port, optional username and TLS/CA settings |
| Password | Current form/Host connection only; not written to the saved connection file |
| Open Redis connection | Owned by one DSH conversation; not shared with another conversation |
| Current DB, Key and selected row | Runtime state; not restored as a new network connection |
| AI tool results | Enter DSH conversation history and can be sent to its configured model provider |

`DSH_HOME` defaults to `~/.dsh`. For a default Windows `web` profile, the connection file is `%USERPROFILE%\.dsh\profiles\web\data\dsh-redis\connections.json`. A custom `DSH_HOME` changes that location. Connection profiles are shared only within that DSH profile, and the file can contain private addresses, usernames and CA material.

There is no Redis-specific model API key. Sidebar browsing uses the Redis connection; chat uses the model already configured in DSH. The historical Release does not export diagnostic snapshots. Current source can save explicitly requested diagnostic reports under `data/dsh-redis/reports`; these files and saved MATCH presets remain in the profile after uninstall.

## Disable, uninstall or remove saved connections

- **Disable:** turn off the DSH Redis bundle in **Plugins**. Once the Host actually unloads it, its runtime connections and readers are disposed. A restart may be required without live reload.
- **Uninstall:** use the plugin manager's uninstall action, or stop the target profile and run `dsh plugin --profile web remove dsh-redis`. Reload/restart as required so the running Host releases the old plugin.
- **Retain settings:** uninstalling removes the package dependency and bundle selection, but does not remove `data/dsh-redis/connections.json`. Reinstalling in the same profile can reuse saved settings; enter the password again and connect manually.
- **Remove settings:** delete individual saved profiles in the connection chooser. For complete cleanup, first unload the plugin, back up the exact connection file if needed, and remove only that plugin-owned file. Do not delete the whole DSH home or profile to remove Redis settings.

Disabling or uninstalling the plugin does not delete Redis Keys or model-provider settings. Existing DSH conversation history is managed by DSH and is not removed by uninstalling this package.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Release URL returns 404/403 | Confirm the tag and named asset exist, then check access. A private browser login is not installer authentication; download the asset and use its Host path |
| Source code archive has no loadable entry | Use the built `.tgz`; the current source Git tree omits `lib/` |
| `cannot resolve profile bundle "dsh-redis"` | Replace a moved/deleted development source in the same profile: remove, then add the verified built package; a plain `install` reuses the old source |
| Package installed, no Redis entry | Target profile, bundle enable switch, Host reload/restart, browser refresh and Host diagnostics |
| DSH rejects compatibility | Match the package to its declared DSH version: historical v0.1.0 evidence uses `0.2.0-rc.2`, current 0.1.2 source declares `0.2.2-rc.1`. Do not force a version exemption or downgrade the current build to the old baseline |
| Connection fails | Host-to-Redis reachability, port, ACL credentials, TLS and CA; inspect the actual returned error |
| Connection appears elsewhere | Open the conversation where you manually connected; network connections are session-specific |
| Keys stop loading below the total | MATCH filters and bounded scanning can produce a partial result; inspect the progress state before refreshing or narrowing the search |
| Unstyled or oversized icons after reload | An intermittent missing style-node issue was observed once; a browser reload restored it. Its cause is unresolved, so report the versions and reproduction steps rather than assuming a cache fault |

## References

These are historical references pinned to DSH 0.2.0-rc.2, rather than an assertion that current upstream behaves identically:

- [Official plugin publishing and installation guide](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/docs/user/develop/basic/publish.zh.md)
- [Official plugin manager: installation, enablement and update limits](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/client/ui-plugin-manager/README.zh.md)
- [Official CLI: profiles, plugin commands and reload behavior](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/apps/cli/README.zh.md)
- [Official package operations implementation](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/boot/plugin-manager/src/operations.ts)
- [Project README](../README.md)
