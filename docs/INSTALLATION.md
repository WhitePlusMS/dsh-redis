# Install, update and uninstall DSH Redis

English | [简体中文](INSTALLATION.zh.md)

This guide covers the locally built `dsh-redis` package, version `0.1.0`. No public release, registry publication or downloadable Release asset is asserted here. Obtain a built archive from the maintainer or build it from this source checkout.

## Supported target

| Item | Current baseline |
| --- | --- |
| Host | DeepSeek Harness Web `0.2.0-rc.2` |
| Verified platform | Windows, Node.js `22.22.1` |
| Declared Node.js range | `^22.19.0 || >=24.0.0` |
| Build tool | pnpm `11.22.0` |
| Plugin package | `dsh-redis@0.1.0`, local development version |

`0.2.0-rc.2` is a prerelease. It is the verified baseline, not a claim about the latest stable DSH release. Desktop, macOS and Linux installation have not been accepted for this plugin. The Web client declaration alone does not establish Desktop compatibility.

Use the DSH profile that actually serves your browser. The examples below use an **existing `web` profile**. Use its original `DSH_HOME` environment and CLI installation; do not create a different home while expecting to update the running instance. The standalone npm CLI cannot manage the reserved `desktop` profile.

## Prepare a built package

If you already have a verified `.tgz`, skip the build and use its absolute path in the plugin manager.

From the source checkout root, run in PowerShell:

```powershell
node --version
pnpm --version
dsh --version
pnpm install --frozen-lockfile
pnpm pack --pack-destination .release

$packagePath = (Resolve-Path -LiteralPath '.release\dsh-redis-0.1.0.tgz').Path
$sha256 = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash.ToLowerInvariant()
$packageForInstall = Join-Path (Split-Path -Parent $packagePath) ("dsh-redis-0.1.0-{0}.tgz" -f $sha256)
Copy-Item -LiteralPath $packagePath -Destination $packageForInstall
$packageForInstall
```

`pnpm pack` invokes `prepack`: strict type checking, a fresh build and the unit regression suite. Do not skip that hook. The SHA-named copy distinguishes different development builds sharing version `0.1.0`; changing its filename does not change the archive content. Keep the archive in place while it is referenced by the profile's dependency manifest and lockfile.

A SHA256 value calculated locally identifies the file you have. When an archive comes from someone else, compare it with a checksum received from that same trusted source; calculating a new checksum alone does not verify its origin.

## Install through the DSH interface

1. In DSH, open **Plugins → Add plugin**.
2. Enter the built archive's absolute path. With the build above, use the path printed in `$packageForInstall`.
3. Check that the preview identifies `dsh-redis` and the expected version, then install.
4. Choose **Enable now**. Closing the success dialog without enabling leaves the new bundle disabled.
5. Open a conversation and its right sidebar, then select **Redis**. Follow any DSH restart notice when the profile does not support live reload.

The path is resolved on the **DSH Host machine**. A path on the browser's computer does not upload a file to a remote Host. Transfer the archive to that Host first when they are different machines.

DSH supports package specs, URLs and local packages. This project currently documents the verified local archive route; a bare registry name or an invented GitHub URL is not a download source.

## Install through the CLI

Use the same PowerShell session as the build above, with the intended existing `web` profile and original `DSH_HOME`:

```powershell
dsh plugin --profile web add $packageForInstall --ignore-scripts
dsh plugin --profile web list dsh-redis
```

The archive already contains `lib/`; installation does not need to compile the plugin. `--ignore-scripts` applies to installation, not to the earlier `prepack` checks. Package resolution may still need network access for runtime dependencies.

Check **Plugins** for the bundle and enable it if disabled. A profile without live reload needs its normal Host restart before the running application uses the changed dependency. Refresh the browser after the Host has loaded the new bundle.

For a configuration-only check, the following prints the composed tree without starting a server:

```powershell
dsh --profile web --dump-config
```

The Redis Host entry is `ui-redis`, supplied by the `dsh-redis` bundle. A package listed by pnpm is not, by itself, proof that the bundle or its client is active. The full configuration can contain other profile settings; it is not a public bug-report attachment.

## Connect and check the installation

1. Open **Select or create connection** in the Redis sidebar.
2. Enter the address and port, optional ACL username and password. Enable TLS when required; provide the CA certificate when the server uses a private CA.
3. Give the connection a name and optional group if you want to save its non-password settings. Choose **Connect** to establish the connection; saving alone does not connect.
4. A new connection starts at DB 0. Select the intended DB and wait for automatic Key loading. Select a Key to view its data.
5. To use chat, stay in this same DSH conversation and ask about the selected Key or field. The model service and DSH tool policy must be available.

The Host, rather than the browser, must be able to reach Redis. TLS certificate validation remains enabled. There is no built-in SSH tunnel, Cluster or Sentinel connection mode.

## Update

The verified DSH version has no automatic update operation for this installed bundle. Use **uninstall, then install the new built archive**.

1. Keep the old verified archive and checksum for rollback. Back up the target profile's `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` when present, `cordis.yml` when present and `cordis.patch.yml` when present. Back up the Redis connection file described below if you use saved connections.
2. Build or obtain the new archive and check its checksum. During development, use a new SHA-named path even if the package version is unchanged.
3. In **Plugins**, disable/unload DSH Redis and uninstall it. If DSH requires stopping the non-live-reload Host, close that profile using its normal shutdown procedure first.
4. Install the new archive and enable the bundle. Restart the same profile when required, then refresh the browser.
5. Manually connect again and verify the expected DB, Key list and value view. Check chat in that same conversation if you use the AI tools.

The CLI equivalent, with `$packageForInstall` set to the new archive, is:

```powershell
dsh plugin --profile web remove dsh-redis
dsh plugin --profile web add $packageForInstall --ignore-scripts
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

There is no Redis-specific model API key. Sidebar browsing uses the Redis connection; chat uses the model already configured in DSH. The plugin does not open RDB/AOF snapshot files or export diagnostic snapshots.

## Disable, uninstall or remove saved connections

- **Disable:** turn off the DSH Redis bundle in **Plugins**. Once the Host actually unloads it, its runtime connections and readers are disposed. A restart may be required without live reload.
- **Uninstall:** use the plugin manager's uninstall action, or stop the target profile and run `dsh plugin --profile web remove dsh-redis`. Reload/restart as required so the running Host releases the old plugin.
- **Retain settings:** uninstalling removes the package dependency and bundle selection, but does not remove `data/dsh-redis/connections.json`. Reinstalling in the same profile can reuse saved settings; enter the password again and connect manually.
- **Remove settings:** delete individual saved profiles in the connection chooser. For complete cleanup, first unload the plugin, back up the exact connection file if needed, and remove only that plugin-owned file. Do not delete the whole DSH home or profile to remove Redis settings.

Disabling or uninstalling the plugin does not delete Redis Keys or model-provider settings. Existing DSH conversation history is managed by DSH and is not removed by uninstalling this package.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Package installed, no Redis entry | Target profile, bundle enable switch, Host reload/restart, browser refresh and Host diagnostics |
| DSH rejects compatibility | Use the documented `0.2.0-rc.2` baseline; do not treat a forced version exemption as verified compatibility |
| Connection fails | Host-to-Redis reachability, port, ACL credentials, TLS and CA; inspect the actual returned error |
| Connection appears elsewhere | Open the conversation where you manually connected; network connections are session-specific |
| Keys stop loading below the total | MATCH filters and bounded scanning can produce a partial result; inspect the progress state before refreshing or narrowing the search |
| Unstyled or oversized icons after reload | An intermittent missing style-node issue was observed once; a browser reload restored it. Its cause is unresolved, so report the versions and reproduction steps rather than assuming a cache fault |

## References

These are pinned to the verified DSH version, rather than an assertion that current upstream behaves identically:

- [Official plugin publishing and installation guide](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/docs/user/develop/basic/publish.zh.md)
- [Official plugin manager: installation, enablement and update limits](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/client/ui-plugin-manager/README.zh.md)
- [Official CLI: profiles, plugin commands and reload behavior](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/apps/cli/README.zh.md)
- [Official package operations implementation](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/boot/plugin-manager/src/operations.ts)
- [Project README](../README.md)
