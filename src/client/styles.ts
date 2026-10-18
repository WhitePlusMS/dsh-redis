/** Compact Database/RESP workbench; only the plugin owns these surfaces. */
export function installRedisStyles(): () => void {
  const style = document.createElement('style')
  style.dataset.dshRedis = 'true'
  style.textContent = `

.dsh-redis { height:100%; min-height:0; min-width:0; display:flex; flex-direction:column; overflow:hidden; container:redis-sidebar / inline-size; color:var(--dsw-alias-label-primary); background:var(--dsw-alias-bg-base); font-family:inherit; font-size:12px; line-height:1.45; --redis-error:#b42318; --redis-accent:#007fa9; --redis-folder:#7945ce; --redis-key:#bc480d; --redis-panel:color-mix(in srgb,var(--dsw-alias-bg-base) 97%,var(--dsw-alias-label-primary)); --redis-selected:color-mix(in srgb,var(--dsw-alias-bg-base) 86%,var(--redis-accent)); }
body[data-ds-dark-theme] .dsh-redis { --redis-error:#ffb4ab; --redis-accent:#23bbed; --redis-folder:#a27cff; --redis-key:#ff7f49; }
.dsh-redis * { box-sizing:border-box; }
.dsh-redis [hidden] { display:none; }
.dsh-redis h2, .dsh-redis p { margin:0; }
.dsh-redis h2 { font-size:12px; font-weight:600; }
.dsh-redis p { line-height:1.45; overflow-wrap:anywhere; color:var(--dsw-alias-label-secondary); font-size:11px; }
.dsh-redis button { display:inline-flex; align-items:center; justify-content:center; gap:5px; min-height:26px; padding:3px 8px; color:inherit; background:var(--dsw-alias-bg-base); border:1px solid var(--dsw-alias-border-l2); border-radius:4px; cursor:pointer; font:inherit; font-size:11px; }
.dsh-redis button:hover { background:var(--redis-panel); }
.dsh-redis button:disabled { opacity:.45; cursor:default; }
.dsh-redis :is(button,input,select,textarea,summary,[tabindex]):focus-visible { outline:2px solid var(--dsw-alias-label-primary); outline-offset:1px; }
.dsh-redis .redis-icon { width:16px; height:16px; flex-shrink:0; fill:none; stroke:currentColor; stroke-width:1.75; stroke-linecap:round; stroke-linejoin:round; }
.dsh-redis .redis-icon-duotone { fill:currentColor; stroke:none; }
.dsh-redis .redis-icon-duotone[data-icon=database] { color:var(--redis-accent); }
.dsh-redis .redis-icon-duotone:is([data-icon=folder],[data-icon=folderOpen]) { color:var(--redis-folder); }
.dsh-redis .redis-icon-duotone[data-icon=key] { color:var(--redis-key); }
.dsh-redis .redis-icon-button { width:28px; min-width:28px; min-height:28px; padding:4px; border-color:transparent; background:transparent; }
.dsh-redis .redis-icon-button:hover { border-color:var(--dsw-alias-border-l2); }
.dsh-redis .redis-workspace-heading { display:flex; align-items:center; gap:8px; height:34px; padding:0 9px; flex-shrink:0; border-bottom:1px solid var(--dsw-alias-border-l2); position:relative; }
.dsh-redis .redis-readonly { display:flex; align-items:center; color:var(--dsw-alias-label-secondary); }
.dsh-redis .redis-plugin-info-toggle { margin-left:auto; }
.dsh-redis .redis-plugin-info { display:flex; align-items:center; flex-wrap:wrap; gap:4px 12px; padding:6px 9px; border-bottom:1px solid var(--dsw-alias-border-l2); font-size:10px; color:var(--dsw-alias-label-secondary); flex-shrink:0; }
.dsh-redis .redis-connection-indicator { display:flex; align-items:center; gap:4px; }
.dsh-redis .redis-connection-indicator.redis-connected { color:var(--redis-accent); }
.dsh-redis .redis-empty, .dsh-redis .redis-connect-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:16px; min-height:0; text-align:center; }
.dsh-redis .redis-empty { flex:1; }
.dsh-redis .redis-connect-empty { grid-area:browser; }
.dsh-redis .redis-connect-empty > .redis-icon { width:38px; height:38px; color:var(--redis-accent); }
.dsh-redis .redis-connect-empty h2 { font-size:16px; }
.dsh-redis .redis-connect-empty p { max-width:32em; }
.dsh-redis .redis-status { padding:3px 9px; flex-shrink:0; border-top:1px solid var(--dsw-alias-border-l2); font-size:10px; color:var(--dsw-alias-label-secondary); }
.dsh-redis .redis-error { color:var(--redis-error); }
.dsh-redis .redis-connection { flex:1; min-height:0; min-width:0; display:grid; grid-template-columns:minmax(0,1fr); grid-template-rows:minmax(0,1fr) auto; grid-template-areas:"browser" "status"; overflow:hidden; }
.dsh-redis .redis-connection[data-connected=false] { grid-template-rows:32px minmax(0,1fr) auto; grid-template-areas:"compact" "browser" "status"; }
.dsh-redis .redis-compact-connection { grid-area:compact; display:flex; align-items:center; justify-content:space-between; gap:5px; padding:2px 6px; border-bottom:1px solid var(--dsw-alias-border-l2); }
.dsh-redis .redis-compact-connection > button:first-child { min-width:0; border:0; justify-content:start; background:transparent; }
.dsh-redis .redis-connection-status { grid-area:status; display:flex; align-items:center; flex-wrap:wrap; gap:5px; min-height:28px; padding:2px 7px; border-top:1px solid var(--dsw-alias-border-l2); color:var(--dsw-alias-label-secondary); font-size:10px; background:var(--redis-panel); }
.dsh-redis .redis-status-spacer { flex:1; }
.dsh-redis .redis-connection-status > p { flex-basis:100%; padding:3px 0; }
.dsh-redis .redis-connection-status time { font-variant-numeric:tabular-nums; }
.dsh-redis .redis-connected { color:var(--dsw-alias-label-primary); }
.dsh-redis .redis-connection-dialog { position:fixed; inset:0; margin:auto; width:min(470px,calc(100% - 24px)); max-height:90dvh; padding:0; color:inherit; background:var(--dsw-alias-bg-base); border:1px solid var(--dsw-alias-border-l2); border-radius:8px; box-shadow:0 12px 40px #0003; overflow:hidden; }
.dsh-redis .redis-connection-dialog[open] { display:flex; flex-direction:column; }
.dsh-redis .redis-connection-dialog::backdrop { background:#10182766; }
.dsh-redis .redis-dialog-heading { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:9px 12px; border-bottom:1px solid var(--dsw-alias-border-l2); flex-shrink:0; }
.dsh-redis .redis-dialog-content { min-height:0; overflow:auto; padding:12px; display:flex; flex-direction:column; gap:10px; overscroll-behavior:contain; }
.dsh-redis .redis-connection-dialog { width:min(740px,calc(100% - 24px)); }
.dsh-redis .redis-connection-dialog .redis-dialog-heading { padding:15px 18px; }
.dsh-redis .redis-connection-title { display:flex; align-items:center; gap:12px; min-width:0; }
.dsh-redis .redis-connection-title > .redis-icon { width:32px; height:32px; color:var(--redis-accent); padding:5px; border:1px solid var(--dsw-alias-border-l2); border-radius:7px; background:var(--redis-selected); }
.dsh-redis .redis-connection-title h2 { font-size:15px; }
.dsh-redis .redis-connection-title p { font-size:11px; margin-top:3px; }
.dsh-redis .redis-connection-layout { display:grid; grid-template-columns:200px minmax(0,1fr); gap:18px; padding:18px; align-items:start; }
.dsh-redis .redis-connection-layout .redis-profiles { min-width:0; display:flex; flex-direction:column; gap:12px; border:0; border-right:1px solid var(--dsw-alias-border-l2); padding:0 18px 0 0; }
.dsh-redis .redis-connection-editor { min-width:0; display:flex; flex-direction:column; gap:12px; }
.dsh-redis .redis-connection-dialog :is(input,select) { min-height:33px; padding:6px 8px; }
.dsh-redis .redis-form-section { display:flex; flex-direction:column; gap:10px; }
.dsh-redis .redis-form-section h3 { font-size:11px; font-weight:500; margin:0; color:var(--dsw-alias-label-secondary); }
.dsh-redis .redis-connect-form > fieldset { gap:18px; }
.dsh-redis .redis-connection-dialog summary { cursor:pointer; min-height:28px; padding:5px 0; }
.dsh-redis .redis-profile-confirm { display:flex; flex-direction:column; gap:8px; padding:10px; border:1px solid var(--dsw-alias-border-l2); border-radius:4px; background:var(--redis-panel); }
.dsh-redis .redis-tls-section { padding-top:12px; border-top:1px solid var(--dsw-alias-border-l2); }
.dsh-redis .redis-tls-section .redis-checkbox input { min-height:0; accent-color:var(--redis-accent); }
.dsh-redis .redis-connect-actions { justify-content:flex-end; padding-top:4px; }
.dsh-redis .redis-connect-actions button { min-height:33px; padding:6px 12px; }
.dsh-redis .redis-primary-button { background:var(--redis-accent); border-color:var(--redis-accent); color:var(--dsw-alias-bg-base); font-weight:600; }
.dsh-redis .redis-primary-button:hover { background:color-mix(in srgb,var(--redis-accent) 88%,var(--dsw-alias-label-primary)); }
.dsh-redis .redis-connection-notice { display:flex; flex-direction:column; align-items:flex-start; gap:7px; padding:10px 12px; border-left:2px solid var(--redis-accent); background:var(--redis-selected); border-radius:0 5px 5px 0; }
.dsh-redis .redis-connection-notice strong { font-size:11px; font-weight:500; }
@media (max-width:600px) { .dsh-redis .redis-connection-layout { grid-template-columns:minmax(0,1fr); padding:14px; gap:14px; } .dsh-redis .redis-connection-layout .redis-profiles { border-right:0; border-bottom:1px solid var(--dsw-alias-border-l2); padding:0 0 14px; } }
.dsh-redis fieldset { padding:0; margin:0; border:0; display:flex; flex-direction:column; gap:10px; min-width:0; }
.dsh-redis label { display:flex; flex-direction:column; gap:4px; min-width:0; font-size:11px; color:var(--dsw-alias-label-secondary); }
.dsh-redis input, .dsh-redis textarea, .dsh-redis select { min-width:0; width:100%; min-height:27px; padding:4px 6px; border:1px solid var(--dsw-alias-border-l2); border-radius:4px; color:var(--dsw-alias-label-primary); background:var(--dsw-alias-bg-base); font:inherit; }
.dsh-redis textarea { resize:vertical; }
.dsh-redis .redis-profiles { padding-bottom:10px; border-bottom:1px solid var(--dsw-alias-border-l2); }
.dsh-redis .redis-checkbox { flex-direction:row; align-items:center; }
.dsh-redis .redis-checkbox input { width:auto; min-height:0; }
.dsh-redis .redis-address { display:grid; grid-template-columns:minmax(0,1fr) 85px; gap:8px; }
.dsh-redis .redis-bounds { grid-template-columns:repeat(2,minmax(0,1fr)); }
.dsh-redis .redis-actions { display:flex; align-items:center; flex-wrap:wrap; gap:5px; }
.dsh-redis .redis-keys { grid-area:browser; display:grid; grid-template-columns:clamp(190px,32%,300px) minmax(0,1fr); min-height:0; min-width:0; overflow:hidden; }
.dsh-redis .redis-key-catalog { display:flex; flex-direction:column; gap:0; min-height:0; min-width:0; overflow:hidden; padding:0; border-right:1px solid var(--dsw-alias-border-l2); background:var(--redis-panel); }
.dsh-redis .redis-key-catalog > h2 { font-size:11px; padding:0 2px; }
.dsh-redis .redis-key-catalog > small { color:var(--dsw-alias-label-secondary); font-size:9px; }
.dsh-redis .redis-key-catalog form { display:flex; flex-direction:column; gap:5px; }
.dsh-redis .redis-key-catalog .redis-db { display:flex; flex-direction:row; align-items:end; }
.dsh-redis .redis-db label { flex:1; }
.dsh-redis .redis-key-catalog > p[role=status] { font-size:10px; }
.dsh-redis .redis-namespace-tools { display:flex; align-items:center; gap:1px; position:relative; flex-shrink:0; }
.dsh-redis .redis-namespace-tools [aria-pressed=true] { background:var(--redis-selected); }
.dsh-redis .redis-namespace-settings-toggle { margin-left:auto; }
.dsh-redis .redis-namespace-settings { flex-shrink:0; max-height:50%; overflow:auto; padding:6px 8px; border-bottom:1px solid var(--dsw-alias-border-l2); display:flex; flex-direction:column; gap:6px; }
.dsh-redis .redis-section-heading { display:flex; align-items:center; justify-content:space-between; gap:6px; }
.dsh-redis .redis-section-heading strong { font-size:11px; font-weight:500; }
.dsh-redis .redis-key-list { flex:1; min-height:60px; overflow:auto; overscroll-behavior:contain; overflow-anchor:none; }
.dsh-redis .redis-key-spacer { position:relative; min-width:0; }
.dsh-redis .redis-key-list button { position:absolute; left:0; width:100%; height:30px; min-height:30px; gap:5px; padding:4px; text-align:left; justify-content:flex-start; min-width:0; border:0; border-radius:2px; background:transparent; }
.dsh-redis .redis-key-list button:hover { background:var(--redis-selected); }
.dsh-redis .redis-key-list span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; font-size:11px; }
.dsh-redis .redis-key-list small { flex-shrink:0; color:var(--dsw-alias-label-secondary); font-size:9px; }
.dsh-redis .redis-key-list [aria-selected=true] { background:var(--redis-selected); }
.dsh-redis .redis-key-list:focus-visible [data-active=true] { outline:1px solid var(--dsw-alias-label-primary); outline-offset:-1px; }
.dsh-redis .redis-key-detail { display:flex; flex-direction:column; min-height:0; min-width:0; overflow:hidden; }
.dsh-redis .redis-keys[data-focused=true] { grid-template-columns:minmax(0,1fr); }
.dsh-redis .redis-keys[data-focused=true] .redis-key-catalog { display:none; }
.dsh-redis .redis-focus-button { margin-left:auto; flex-shrink:0; }
.dsh-redis .redis-inspector-heading { display:flex; align-items:center; gap:6px; padding:6px 9px; min-height:31px; border-bottom:1px solid var(--dsw-alias-border-l2); flex-shrink:0; }
.dsh-redis .redis-inspector-heading strong { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font:500 11px/1.4 Consolas,monospace; }
.dsh-redis .redis-inspector-toolbar { display:flex; align-items:center; justify-content:space-between; gap:4px; min-height:33px; border-bottom:1px solid var(--dsw-alias-border-l2); flex-shrink:0; padding-right:4px; }
.dsh-redis .redis-inspector-tabs { display:flex; gap:7px; padding:0 7px; height:31px; flex-shrink:0; }
.dsh-redis .redis-inspector-tabs button { border:0; border-radius:0; border-bottom:2px solid transparent; padding:4px 9px; color:var(--dsw-alias-label-secondary); }
.dsh-redis .redis-inspector-tabs [aria-selected=true] { color:var(--dsw-alias-label-primary); border-bottom-color:var(--dsw-alias-label-primary); }
.dsh-redis .redis-reader-tools { display:flex; align-items:center; gap:2px; flex-shrink:0; }
.dsh-redis .redis-auto-refresh { display:flex; align-items:stretch; border:1px solid var(--dsw-alias-border-l2); border-radius:4px; flex-shrink:0; }
.dsh-redis .redis-auto-refresh > button { width:27px; min-height:25px; padding:3px; border:0; border-radius:3px 0 0 3px; }
.dsh-redis .redis-auto-refresh [aria-pressed=true] { color:var(--redis-accent); background:var(--redis-selected); }
.dsh-redis .redis-auto-refresh select { width:48px; min-height:25px; padding:2px; border:0; border-left:1px solid var(--dsw-alias-border-l2); border-radius:0 3px 3px 0; font:10px Consolas,monospace; }
.dsh-redis .redis-auto-refresh[data-auto-refresh=on] { border-color:var(--redis-accent); }
.dsh-redis .redis-auto-refresh[data-busy=true] > button .redis-icon, .dsh-redis .redis-spinning .redis-icon { animation:redis-spin 1.2s linear infinite; }
@keyframes redis-spin { to { transform:rotate(360deg); } }
@media (prefers-reduced-motion:reduce) { .dsh-redis .redis-auto-refresh[data-busy=true] > button .redis-icon, .dsh-redis .redis-spinning .redis-icon { animation:none; } }
.dsh-redis .redis-sr-only { position:absolute !important; width:1px !important; height:1px !important; margin:-1px !important; padding:0 !important; overflow:hidden !important; clip-path:inset(50%); white-space:nowrap; border:0 !important; }
.dsh-redis .redis-read-info { display:flex; align-items:center; flex-wrap:wrap; gap:4px 9px; padding:6px 8px; border-bottom:1px solid var(--dsw-alias-border-l2); flex-shrink:0; font-size:10px; color:var(--dsw-alias-label-secondary); }
.dsh-redis .redis-read-info > button { margin-left:auto; }
.dsh-redis .redis-copy-button[data-copy-state=copied] { color:var(--redis-accent); }
.dsh-redis .redis-reader-actions, .dsh-redis .redis-load-count { display:flex; align-items:center; flex-wrap:wrap; gap:4px; }
.dsh-redis .redis-view-tools { display:flex; align-items:center; justify-content:space-between; gap:4px; padding:5px 7px; border-bottom:1px solid var(--dsw-alias-border-l2); flex-shrink:0; }
.dsh-redis .redis-view-tools > label { min-width:0; }
.dsh-redis .redis-view-tools select { width:auto; max-width:150px; font-size:11px; }
.dsh-redis .redis-collection-state > span { display:inline-flex; align-items:center; gap:4px; }
.dsh-redis .redis-key-facts { margin-left:auto; border:0; background:transparent; padding:2px 4px; gap:7px; flex-shrink:0; }
.dsh-redis .redis-type { color:var(--redis-key); font-size:10px; text-transform:uppercase; max-width:86px; overflow:hidden; text-overflow:ellipsis; }
.dsh-redis .redis-ttl { display:inline-flex; align-items:center; gap:3px; font:10px Consolas,monospace; color:var(--dsw-alias-label-secondary); }
.dsh-redis .redis-ttl .redis-icon { width:12px; height:12px; }
.dsh-redis .redis-chip, .dsh-redis .redis-filter-chip { display:inline-flex; align-items:center; gap:4px; min-width:0; border:1px solid var(--dsw-alias-border-l2); border-radius:4px; font-size:10px; }
.dsh-redis .redis-chip { min-height:22px; padding:2px 5px; }
.dsh-redis .redis-filter-chip > button { border:0; min-height:22px; padding:2px 4px; font-size:10px; max-width:100%; }
.dsh-redis .redis-filter-chip > button > span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dsh-redis .redis-warning { color:var(--redis-key); }
.dsh-redis .redis-scan-mark { display:inline-flex; gap:4px; align-items:center; }
.dsh-redis .redis-scan-mark .redis-icon { width:13px; height:13px; }
.dsh-redis .redis-read-time { display:inline-flex; font-size:10px; color:var(--dsw-alias-label-secondary); }
.dsh-redis .redis-read-time[open] { flex-wrap:wrap; gap:4px; }
.dsh-redis .redis-read-time summary { display:flex; align-items:center; justify-content:center; width:26px; min-height:26px; cursor:pointer; list-style:none; }
.dsh-redis .redis-read-time summary::-webkit-details-marker { display:none; }
.dsh-redis .redis-inspector { flex:1; display:flex; flex-direction:column; min-height:0; min-width:0; overflow:auto; overscroll-behavior:contain; }
.dsh-redis .redis-key-identity { padding:9px; flex-shrink:0; }
.dsh-redis .redis-details { position:relative; display:flex; flex-direction:column; flex:1; gap:6px; min-height:100%; min-width:0; padding:8px; overflow:auto; overscroll-behavior:contain; }
.dsh-redis .redis-details > h2 { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }
.dsh-redis .redis-details > :is(form,p,small,label,dl,button,.redis-actions,.redis-reader-actions,.redis-collection-state) { flex-shrink:0; }
.dsh-redis .redis-details > form { display:flex; align-items:end; flex-wrap:wrap; gap:6px; padding-bottom:6px; border-bottom:1px solid var(--dsw-alias-border-l2); }
.dsh-redis .redis-details > form > .redis-address { display:contents; }
.dsh-redis .redis-details > form label { flex:1 1 95px; }
.dsh-redis .redis-details > form .redis-actions { flex:0 1 auto; min-width:0; max-width:100%; }
.dsh-redis .redis-details > label { max-width:190px; }
.dsh-redis .redis-details > small { order:8; color:var(--dsw-alias-label-secondary); font-size:10px; }
.dsh-redis .redis-metadata { display:grid; grid-template-columns:minmax(100px,1fr) minmax(0,2fr); gap:6px 12px; margin:0; font-size:11px; }
.dsh-redis .redis-metadata dt { color:var(--dsw-alias-label-secondary); overflow-wrap:anywhere; }
.dsh-redis .redis-metadata dd { margin:0; min-width:0; overflow-wrap:anywhere; font-family:Consolas,monospace; font-variant-numeric:tabular-nums; }
.dsh-redis .redis-inspector[data-view=data] .redis-key-metadata, .dsh-redis .redis-inspector[data-view=data] .redis-secondary-metadata { display:none; }
.dsh-redis .redis-inspector[data-view=metadata] .redis-details > :not(.redis-metadata):not(small):not([role=alert]):not([role=status]) { display:none; }
.dsh-redis .redis-inspector[data-view=metadata] > button { display:none; }
.dsh-redis .redis-format-toolbar { display:flex; align-items:center; gap:3px; flex-wrap:wrap; min-height:28px; border-bottom:1px solid var(--dsw-alias-border-l2); padding-bottom:4px; flex-shrink:0; }
.dsh-redis .redis-format-toolbar > button { padding:3px 6px; border-color:transparent; }
.dsh-redis .redis-format-toolbar [aria-pressed=true] { background:var(--redis-panel); border-color:var(--dsw-alias-border-l2); }
.dsh-redis .redis-format-toolbar select { width:116px; min-height:24px; padding:3px; font-size:10px; }
.dsh-redis .redis-format-toolbar .redis-copy-button { margin-left:0; }
.dsh-redis .redis-format-toolbar small { font-size:10px; color:var(--dsw-alias-label-secondary); }
.dsh-redis .redis-preview-caption { display:flex; align-items:center; flex-wrap:wrap; gap:3px 8px; flex:1; min-width:0; }
.dsh-redis .redis-preview-caption strong { font-size:11px; font-weight:500; }
.dsh-redis .redis-value { flex:1 1 200px; min-height:100px; white-space:pre; overflow:auto; overscroll-behavior:contain; max-width:100%; margin:0; padding:8px; border:0; border-radius:0; font:12px/1.65 Consolas,"SFMono-Regular",monospace; }
.dsh-redis .redis-byte-preview { display:flex; flex-direction:column; flex:1 1 200px; min-height:160px; min-width:0; gap:5px; overflow:hidden; }
.dsh-redis .redis-content-search { display:flex; align-items:center; flex-wrap:wrap; gap:3px; flex-shrink:0; }
.dsh-redis .redis-content-search input { flex:1 1 90px; width:90px; min-height:25px; font-size:11px; }
.dsh-redis .redis-content-search small { font-size:10px; color:var(--dsw-alias-label-secondary); }
.dsh-redis .redis-content-scope { flex-basis:100%; }
.dsh-redis .redis-value mark { background:color-mix(in srgb,#e3bd38 50%,var(--dsw-alias-bg-base)); color:inherit; }
.dsh-redis .redis-value [data-search-current=true] { outline:1px solid var(--dsw-alias-label-primary); }
.dsh-redis .redis-value .redis-json-toggle { display:inline-flex; vertical-align:middle; padding:0; width:14px; min-height:16px; height:16px; border:0; background:transparent; }
.dsh-redis .redis-json-summary { color:var(--dsw-alias-label-secondary); }
.dsh-redis .redis-collection-table { flex:1 1 240px; min-height:120px; max-height:58dvh; overflow:auto; overscroll-behavior:contain; min-width:0; border-top:1px solid var(--dsw-alias-border-l2); overflow-anchor:none; }
.dsh-redis .redis-collection-table table { border-collapse:collapse; width:100%; min-width:460px; table-layout:fixed; }
.dsh-redis .redis-collection-table th, .dsh-redis .redis-collection-table td { text-align:left; padding:5px 9px; border-bottom:1px solid var(--dsw-alias-border-l2); vertical-align:middle; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font:11px/20px Consolas,monospace; }
.dsh-redis .redis-collection-table th { position:sticky; top:0; z-index:1; background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-secondary); font-family:inherit; font-weight:500; }
.dsh-redis .redis-collection-table button { display:block; width:100%; min-height:20px; border:0; padding:0; text-align:left; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; background:transparent; font:inherit; }
.dsh-redis .redis-collection-table small { display:none; }
.dsh-redis .redis-collection-table [data-column=field] { width:155px; }
.dsh-redis .redis-collection-table :is([data-column=index],[data-column=rank],[data-column=fields]) { width:70px; }
.dsh-redis .redis-collection-table :is([data-column=timestamp],[data-column=id]) { width:185px; }
.dsh-redis .redis-collection-table [data-column=score] { width:135px; }
.dsh-redis .redis-collection-table [aria-selected=true] { background:var(--redis-selected); box-shadow:inset 2px 0 var(--redis-accent); }
.dsh-redis .redis-collection-table tr[tabindex] { cursor:pointer; }
.dsh-redis .redis-collection-table tr[tabindex]:focus-visible { outline-offset:-2px; }
.dsh-redis .redis-collection-table .redis-collection-empty { text-align:center; padding:18px 8px; color:var(--dsw-alias-label-secondary); font-family:inherit; }
/* Hash keeps the table and both byte viewers mounted in fixed, independently
 * scrollable areas. Row selection cannot cover or replace its own table.
 */
.dsh-redis :is(.redis-hash-workbench,.redis-collection-workbench) { min-height:0; padding:0; gap:0; overflow:hidden; }
.dsh-redis .redis-hash-controls { display:flex; align-items:center; gap:3px; padding:5px 7px; flex-shrink:0; border-bottom:1px solid var(--dsw-alias-border-l2); }
.dsh-redis .redis-hash-controls > strong { color:var(--redis-key); font-size:10px; padding-right:3px; }
.dsh-redis .redis-hash-controls > input { flex:1; width:90px; font-size:11px; }
.dsh-redis .redis-hash-controls [aria-pressed=true] { background:var(--redis-selected); }
.dsh-redis .redis-hash-workbench > .redis-hash-filter { margin:0; padding:7px; gap:6px; flex-shrink:0; }
.dsh-redis :is(.redis-hash-summary,.redis-collection-summary) { display:flex; flex-wrap:wrap; align-items:center; gap:3px 12px; padding:5px 8px; flex-shrink:0; font-size:10px; color:var(--dsw-alias-label-secondary); border-bottom:1px solid var(--dsw-alias-border-l2); }
.dsh-redis :is(.redis-hash-summary,.redis-collection-summary) b { font-weight:500; font-variant-numeric:tabular-nums; }
.dsh-redis .redis-hash-body { display:grid; grid-template-rows:minmax(110px,1.4fr) minmax(74px,.6fr) minmax(120px,1.4fr); flex:1; min-height:0; min-width:0; }
.dsh-redis .redis-hash-body > .redis-collection-table { min-height:0; max-height:none; border:0; }
.dsh-redis .redis-hash-body table { min-width:280px; }
.dsh-redis .redis-hash-body [data-column=number] { width:35px; text-align:right; color:var(--dsw-alias-label-secondary); }
.dsh-redis .redis-hash-body [data-column=field] { width:36%; }
.dsh-redis .redis-hash-body :is(th,td) { padding:4px 7px; }
.dsh-redis .redis-hash-body td > span { display:block; overflow:hidden; text-overflow:ellipsis; }
.dsh-redis :is(.redis-hash-preview,.redis-collection-preview) { display:flex; flex-direction:column; min-height:0; min-width:0; overflow:hidden; border-top:1px solid var(--dsw-alias-border-l2); }
.dsh-redis :is(.redis-hash-preview,.redis-collection-preview) > strong { padding:6px 8px; font-size:11px; font-weight:500; background:var(--redis-panel); }
.dsh-redis :is(.redis-hash-preview,.redis-collection-preview) > p { padding:8px; }
.dsh-redis :is(.redis-hash-preview,.redis-collection-preview) .redis-byte-preview { min-height:0; flex:1; gap:0; }
.dsh-redis :is(.redis-hash-preview,.redis-collection-preview) .redis-format-toolbar { padding:3px 6px; gap:2px; background:var(--redis-panel); }
.dsh-redis :is(.redis-hash-preview,.redis-collection-preview) .redis-value { min-height:0; flex:1; }
.dsh-redis :is(.redis-hash-preview,.redis-collection-preview) .redis-content-search { padding:4px 6px; }
.dsh-redis .redis-inspector[data-view=metadata] :is(.redis-hash-workbench,.redis-collection-workbench) { padding:8px; overflow:auto; }
/* List/Set/ZSet use the same selected-row viewer; no hidden detail pages. */
.dsh-redis .redis-collection-body { display:grid; grid-template-rows:minmax(0,1fr) minmax(0,1fr); flex:1; min-height:0; min-width:0; }
.dsh-redis .redis-collection-body > .redis-collection-table { min-height:0; max-height:none; border:0; }
.dsh-redis .redis-collection-body table { min-width:280px; }
.dsh-redis .redis-collection-body [data-column=number] { width:35px; text-align:right; color:var(--dsw-alias-label-secondary); }
.dsh-redis .redis-collection-body td > span { display:block; overflow:hidden; text-overflow:ellipsis; }
.dsh-redis .redis-collection-workbench > .redis-collection-controls { padding:6px 8px; margin:0; }
.dsh-redis .redis-collection-workbench > :is([role=alert],p[role=status]) { padding:4px 8px; }
/* Selecting a message exposes its first pair immediately; field occurrences
 * remain a separate table so duplicate names are never collapsed into an object.
 */
.dsh-redis .redis-stream-controls { display:flex; align-items:center; gap:5px; padding:5px 7px; flex-shrink:0; border-bottom:1px solid var(--dsw-alias-border-l2); }
.dsh-redis .redis-stream-controls > strong { color:var(--redis-key); font-size:10px; }
.dsh-redis .redis-stream-controls > label { flex:1; flex-direction:row; align-items:center; gap:5px; }
.dsh-redis .redis-stream-controls select { width:auto; max-width:140px; }
.dsh-redis .redis-stream-body { grid-template-rows:minmax(0,1fr) minmax(0,1fr) minmax(74px,.55fr) minmax(0,1fr); }
.dsh-redis .redis-stream-pairs { display:flex; flex-direction:column; min-height:0; min-width:0; overflow:hidden; border-top:1px solid var(--dsw-alias-border-l2); }
.dsh-redis .redis-stream-pairs > strong { padding:3px 7px; flex-shrink:0; font-size:10px; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-label-secondary); }
.dsh-redis .redis-stream-pairs > .redis-collection-table { min-height:0; max-height:none; border:0; }
.dsh-redis .redis-stream-pairs [data-column=index] { width:40px; }
.dsh-redis .redis-stream-pairs [data-column=field] { width:34%; }
.dsh-redis .redis-stream-body :is(th,td) { padding:3px 7px; }
@container redis-sidebar (max-width:560px) {
  .dsh-redis .redis-hash-controls > strong { display:none; }
  .dsh-redis :is(.redis-hash-preview,.redis-collection-preview) .redis-format-toolbar select { width:76px; font-size:10px; }
  .dsh-redis :is(.redis-hash-preview,.redis-collection-preview) .redis-preview-caption { flex-basis:100%; }
  .dsh-redis :is(.redis-hash-summary,.redis-collection-summary) { gap:2px 8px; }
}
.dsh-redis .redis-page-sentinel { height:2px; width:1px; }
@container redis-sidebar (max-width:760px) {
  .dsh-redis .redis-keys { grid-template-columns:190px minmax(0,1fr); }
  .dsh-redis .redis-inspector[data-view=metadata] .redis-metadata { grid-template-columns:minmax(0,1fr); }
  .dsh-redis .redis-inspector[data-view=metadata] .redis-metadata dd { margin-bottom:7px; }
}
@container redis-sidebar (max-width:480px) {
  .dsh-redis .redis-keys { grid-template-columns:155px minmax(0,1fr); }
  .dsh-redis .redis-key-catalog { padding:0; }
  .dsh-redis .redis-key-catalog .redis-db { flex-wrap:wrap; align-items:stretch; }
  .dsh-redis .redis-key-catalog .redis-db label { flex-basis:100%; }
  .dsh-redis .redis-key-list small { display:inline; }
  .dsh-redis .redis-key-list [data-namespace-count] { display:inline; }
  .dsh-redis .redis-key-list span { font-size:10px; }
  .dsh-redis .redis-key-catalog .redis-actions { gap:3px; }
  .dsh-redis .redis-key-catalog button { font-size:10px; padding:3px; }
  .dsh-redis .redis-inspector-heading { padding:6px; }
  .dsh-redis .redis-inspector-tabs { padding:0 4px; }
  .dsh-redis .redis-inspector-tabs button { padding:3px 6px; font-size:10px; }
  .dsh-redis .redis-details { padding:6px; }
  .dsh-redis .redis-format-toolbar select { width:100px; }
  .dsh-redis .redis-target { display:none; }
}
.dsh-redis [hidden] { display:none !important; }
.dsh-redis .redis-tree-connection { display:flex; align-items:center; gap:7px; min-height:35px; padding:3px 7px; flex-shrink:0; border-bottom:1px solid var(--dsw-alias-border-l2); }
.dsh-redis .redis-tree-connection > .redis-icon { color:var(--redis-accent); }
.dsh-redis .redis-tree-connection strong { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; font-weight:500; }
.dsh-redis .redis-catalog-actions { display:flex; gap:2px; align-items:center; padding:2px 5px; flex-shrink:0; }
.dsh-redis .redis-catalog-filters { padding:5px 7px; border-bottom:1px solid var(--dsw-alias-border-l2); }
.dsh-redis .redis-catalog-filters form { flex-direction:row; align-items:end; margin-bottom:5px; }
.dsh-redis .redis-catalog-filters label { flex:1; }
.dsh-redis .redis-namespace-tools { padding:0 5px 3px; border-bottom:1px solid var(--dsw-alias-border-l2); }
.dsh-redis .redis-key-list button { border-radius:0; }
.dsh-redis .redis-key-list button > .redis-icon { color:var(--redis-key); }
.dsh-redis .redis-key-list button > .redis-icon-duotone { width:17px; height:17px; }
.dsh-redis .redis-key-list button[data-namespace-id] > .redis-icon { color:var(--redis-folder); }
.dsh-redis .redis-key-list button[data-db] > .redis-icon { color:var(--redis-accent); }
.dsh-redis .redis-key-list button[data-db] > .redis-icon:first-child { color:inherit; width:10px; }
.dsh-redis .redis-key-list [aria-selected=true] { background:var(--redis-selected); box-shadow:inset 2px 0 var(--redis-accent); }
.dsh-redis .redis-key-list [data-namespace-count] { display:inline; font-size:inherit; color:inherit; }
.dsh-redis .redis-load-status { display:flex; flex-direction:column; gap:4px; padding:5px 7px; border-top:1px solid var(--dsw-alias-border-l2); font-size:10px; color:var(--dsw-alias-label-secondary); flex-shrink:0; }
.dsh-redis .redis-load-status b { font-weight:500; }
.dsh-redis .redis-load-status progress { width:100%; height:3px; accent-color:var(--redis-accent); }
.dsh-redis .redis-load-status small { font-size:10px; }
.dsh-redis .redis-welcome { display:flex; flex:1; align-items:center; justify-content:center; flex-direction:column; gap:9px; color:var(--dsw-alias-label-secondary); }
.dsh-redis .redis-welcome > .redis-icon { width:42px; height:42px; color:var(--redis-accent); }
.dsh-redis .redis-welcome strong { font-size:22px; font-weight:400; }

`
  document.head.append(style)
  return () => style.remove()
}
