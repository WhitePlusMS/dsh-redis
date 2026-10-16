/** Compact Database/RESP workbench; only the plugin owns these surfaces. */
export function installRedisStyles(): () => void {
  const style = document.createElement('style')
  style.dataset.dshRedis = 'true'
  style.textContent = `

.dsh-redis { height:100%; min-height:0; min-width:0; display:flex; flex-direction:column; overflow:hidden; container:redis-sidebar / inline-size; color:var(--dsw-alias-label-primary); background:var(--dsw-alias-bg-base); font-family:inherit; font-size:12px; line-height:1.45; --redis-error:#b42318; --redis-panel:color-mix(in srgb,var(--dsw-alias-bg-base) 97%,var(--dsw-alias-label-primary)); --redis-selected:color-mix(in srgb,var(--dsw-alias-bg-base) 89%,var(--dsw-alias-label-primary)); }
body[data-ds-dark-theme] .dsh-redis { --redis-error:#ffb4ab; }
.dsh-redis * { box-sizing:border-box; }
.dsh-redis [hidden] { display:none; }
.dsh-redis h2, .dsh-redis p { margin:0; }
.dsh-redis h2 { font-size:12px; font-weight:600; }
.dsh-redis p { line-height:1.45; overflow-wrap:anywhere; color:var(--dsw-alias-label-secondary); font-size:11px; }
.dsh-redis button { display:inline-flex; align-items:center; justify-content:center; gap:5px; min-height:26px; padding:3px 8px; color:inherit; background:var(--dsw-alias-bg-base); border:1px solid var(--dsw-alias-border-l2); border-radius:4px; cursor:pointer; font:inherit; font-size:11px; }
.dsh-redis button:hover { background:var(--redis-panel); }
.dsh-redis button:disabled { opacity:.45; cursor:default; }
.dsh-redis :is(button,input,select,textarea,summary,[tabindex]):focus-visible { outline:2px solid var(--dsw-alias-label-primary); outline-offset:1px; }
.dsh-redis .redis-icon { width:14px; height:14px; flex-shrink:0; fill:none; stroke:currentColor; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round; }
.dsh-redis .redis-icon-button { width:26px; min-width:26px; padding:3px; border-color:transparent; background:transparent; }
.dsh-redis .redis-icon-button:hover { border-color:var(--dsw-alias-border-l2); }
.dsh-redis .redis-workspace-heading { display:flex; align-items:center; gap:8px; height:34px; padding:0 9px; flex-shrink:0; border-bottom:1px solid var(--dsw-alias-border-l2); position:relative; }
.dsh-redis .redis-badge { border:1px solid var(--dsw-alias-border-l2); border-radius:3px; padding:0 4px; color:var(--dsw-alias-label-secondary); font-size:10px; }
.dsh-redis .redis-workspace-heading > .redis-help { margin-left:auto; }
.dsh-redis .redis-empty, .dsh-redis .redis-connect-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:16px; min-height:0; text-align:center; }
.dsh-redis .redis-empty { flex:1; }
.dsh-redis .redis-connect-empty { grid-area:browser; }
.dsh-redis .redis-connect-empty > .redis-icon { width:28px; height:28px; color:var(--dsw-alias-label-secondary); }
.dsh-redis .redis-status { padding:3px 9px; flex-shrink:0; border-top:1px solid var(--dsw-alias-border-l2); font-size:10px; color:var(--dsw-alias-label-secondary); }
.dsh-redis .redis-error { color:var(--redis-error); }
.dsh-redis .redis-connection { flex:1; min-height:0; min-width:0; display:grid; grid-template-columns:164px minmax(0,1fr); grid-template-rows:minmax(0,1fr) auto; grid-template-areas:"connections browser" "status status"; overflow:hidden; }
.dsh-redis .redis-profile-navigation { grid-area:connections; min-height:0; min-width:0; display:flex; flex-direction:column; background:var(--redis-panel); border-right:1px solid var(--dsw-alias-border-l2); }
.dsh-redis .redis-navigation-heading { display:flex; align-items:center; justify-content:space-between; gap:4px; min-height:34px; padding:3px 6px 3px 9px; color:var(--dsw-alias-label-secondary); font-size:11px; }
.dsh-redis .redis-profile-group-title { display:flex; align-items:center; gap:5px; padding:8px 7px 4px; color:var(--dsw-alias-label-secondary); font-size:10px; min-width:0; }
.dsh-redis .redis-profile-group-title span { min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.dsh-redis .redis-profile-list { flex:1; min-height:0; overflow:auto; padding:0 4px; overscroll-behavior:contain; }
.dsh-redis .redis-profile-entry { width:100%; min-width:0; min-height:37px; justify-content:flex-start; border:0; background:transparent; text-align:left; padding:5px 7px; }
.dsh-redis .redis-profile-entry > span { display:flex; flex-direction:column; min-width:0; gap:2px; }
.dsh-redis .redis-profile-entry strong { font-weight:500; }
.dsh-redis .redis-profile-entry :is(strong,small) { min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.dsh-redis .redis-profile-entry small { font-size:10px; color:var(--dsw-alias-label-secondary); }
.dsh-redis .redis-profile-entry[aria-pressed=true] { background:var(--redis-selected); }
.dsh-redis .redis-database-entry { width:100%; justify-content:flex-start; padding-left:27px; border:0; background:transparent; min-height:28px; }
.dsh-redis .redis-navigation-settings { justify-content:flex-start; border:0; border-top:1px solid var(--dsw-alias-border-l2); border-radius:0; padding:5px 9px; background:transparent; color:var(--dsw-alias-label-secondary); }
.dsh-redis .redis-compact-connection { display:none; grid-area:compact; align-items:center; justify-content:space-between; gap:5px; border-bottom:1px solid var(--dsw-alias-border-l2); padding:2px 6px; background:var(--redis-panel); }
.dsh-redis .redis-compact-connection > button:first-child { min-width:0; border:0; justify-content:start; background:transparent; }
.dsh-redis .redis-compact-connection span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dsh-redis .redis-connection:has(.redis-keys[data-focused=true]) { grid-template-columns:minmax(0,1fr); grid-template-rows:32px minmax(0,1fr) auto; grid-template-areas:"compact" "browser" "status"; }
.dsh-redis .redis-connection:has(.redis-keys[data-focused=true]) .redis-profile-navigation { display:none; }
.dsh-redis .redis-connection:has(.redis-keys[data-focused=true]) .redis-compact-connection { display:flex; }
.dsh-redis .redis-connection-status { grid-area:status; display:flex; align-items:center; flex-wrap:wrap; gap:5px; min-height:28px; padding:2px 7px; border-top:1px solid var(--dsw-alias-border-l2); color:var(--dsw-alias-label-secondary); font-size:10px; background:var(--redis-panel); }
.dsh-redis .redis-status-spacer { flex:1; }
.dsh-redis .redis-connection-status > p { flex-basis:100%; padding:3px 0; }
.dsh-redis .redis-connection-status time { font-variant-numeric:tabular-nums; }
.dsh-redis .redis-connected { color:var(--dsw-alias-label-primary); }
.dsh-redis :is(.redis-connection-dialog,.redis-snapshot-dialog) { position:fixed; inset:0; margin:auto; width:min(470px,calc(100% - 24px)); max-height:90dvh; padding:0; color:inherit; background:var(--dsw-alias-bg-base); border:1px solid var(--dsw-alias-border-l2); border-radius:8px; box-shadow:0 12px 40px #0003; overflow:hidden; }
.dsh-redis :is(.redis-connection-dialog,.redis-snapshot-dialog)[open] { display:flex; flex-direction:column; }
.dsh-redis :is(.redis-connection-dialog,.redis-snapshot-dialog)::backdrop { background:#10182766; }
.dsh-redis .redis-dialog-heading { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:9px 12px; border-bottom:1px solid var(--dsw-alias-border-l2); flex-shrink:0; }
.dsh-redis .redis-dialog-content { min-height:0; overflow:auto; padding:12px; display:flex; flex-direction:column; gap:10px; overscroll-behavior:contain; }
.dsh-redis .redis-snapshot-dialog { width:min(680px,calc(100% - 24px)); }
.dsh-redis .redis-clients-dialog [aria-pressed=true] { background:var(--redis-selected); }
.dsh-redis .redis-client-details { padding-top:8px; border-top:1px solid var(--dsw-alias-border-l2); }
.dsh-redis .redis-client-details h2 { margin-bottom:8px; }
.dsh-redis .redis-overview-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
.dsh-redis .redis-overview-card { min-width:0; padding:10px; border:1px solid var(--dsw-alias-border-l2); border-radius:5px; background:var(--redis-panel); }
.dsh-redis .redis-overview-card > h2 { padding-bottom:8px; }
.dsh-redis .redis-overview-card dl { display:grid; grid-template-columns:minmax(0,1fr); gap:4px; margin:0; }
.dsh-redis .redis-overview-card dt { color:var(--dsw-alias-label-secondary); font-size:10px; }
.dsh-redis .redis-overview-card dd { margin:0 0 5px; overflow-wrap:anywhere; font:13px/1.5 Consolas,monospace; font-variant-numeric:tabular-nums; }
.dsh-redis .redis-overview-card dd small, .dsh-redis .redis-snapshot-time { font-size:10px; color:var(--dsw-alias-label-secondary); }
@media (max-width:500px) { .dsh-redis .redis-overview-grid { grid-template-columns:minmax(0,1fr); } }
.dsh-redis fieldset { padding:0; margin:0; border:0; display:flex; flex-direction:column; gap:10px; min-width:0; }
.dsh-redis label { display:flex; flex-direction:column; gap:4px; min-width:0; font-size:11px; color:var(--dsw-alias-label-secondary); }
.dsh-redis input, .dsh-redis textarea, .dsh-redis select { min-width:0; width:100%; min-height:27px; padding:4px 6px; border:1px solid var(--dsw-alias-border-l2); border-radius:4px; color:var(--dsw-alias-label-primary); background:var(--dsw-alias-bg-base); font:inherit; }
.dsh-redis textarea { resize:vertical; }
.dsh-redis .redis-profile-tools { min-width:0; padding-bottom:8px; border-bottom:1px solid var(--dsw-alias-border-l2); }
.dsh-redis .redis-profile-tools > summary { cursor:pointer; font-size:11px; padding:3px 0; }
.dsh-redis .redis-profile-tools[open] { display:flex; flex-direction:column; gap:8px; }
.dsh-redis .redis-import-preview { max-height:320px; overflow:auto; overscroll-behavior:contain; display:flex; flex-direction:column; gap:8px; }
.dsh-redis .redis-import-row { padding:8px; border:1px solid var(--dsw-alias-border-l2); border-radius:4px; }
.dsh-redis .redis-profiles { padding-bottom:10px; border-bottom:1px solid var(--dsw-alias-border-l2); }
.dsh-redis .redis-checkbox { flex-direction:row; align-items:center; }
.dsh-redis .redis-checkbox input { width:auto; min-height:0; }
.dsh-redis .redis-address { display:grid; grid-template-columns:minmax(0,1fr) 85px; gap:8px; }
.dsh-redis .redis-bounds { grid-template-columns:repeat(2,minmax(0,1fr)); }
.dsh-redis .redis-actions { display:flex; align-items:center; flex-wrap:wrap; gap:5px; }
.dsh-redis .redis-keys { grid-area:browser; display:grid; grid-template-columns:minmax(140px,210px) minmax(0,1fr); min-height:0; min-width:0; overflow:hidden; }
.dsh-redis .redis-key-catalog { display:flex; flex-direction:column; gap:6px; min-height:0; min-width:0; overflow:hidden; padding:7px 6px; border-right:1px solid var(--dsw-alias-border-l2); background:var(--redis-panel); }
.dsh-redis .redis-key-catalog > h2 { font-size:11px; padding:0 2px; }
.dsh-redis .redis-key-catalog > small { color:var(--dsw-alias-label-secondary); font-size:9px; }
.dsh-redis .redis-key-catalog form { display:flex; flex-direction:column; gap:5px; }
.dsh-redis .redis-key-catalog .redis-db { display:flex; flex-direction:row; align-items:end; }
.dsh-redis .redis-db label { flex:1; }
.dsh-redis .redis-key-catalog > p[role=status] { font-size:10px; }
.dsh-redis .redis-namespace-tools { display:flex; align-items:center; gap:1px; position:relative; flex-shrink:0; }
.dsh-redis .redis-namespace-tools [aria-pressed=true] { background:var(--redis-selected); }
.dsh-redis .redis-namespace-tools .redis-help { margin-left:auto; }
.dsh-redis .redis-namespace-tools .redis-help-content { position:absolute; z-index:4; top:29px; left:0; width:min(240px,calc(100cqw - 14px)); max-height:55dvh; overflow:auto; }
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
.dsh-redis .redis-inspector-tabs { display:flex; gap:7px; padding:0 7px; height:31px; border-bottom:1px solid var(--dsw-alias-border-l2); flex-shrink:0; }
.dsh-redis .redis-inspector-tabs button { border:0; border-radius:0; border-bottom:2px solid transparent; padding:4px 9px; color:var(--dsw-alias-label-secondary); }
.dsh-redis .redis-inspector-tabs [aria-selected=true] { color:var(--dsw-alias-label-primary); border-bottom-color:var(--dsw-alias-label-primary); }
.dsh-redis .redis-auto-refresh { display:flex; align-items:center; flex-wrap:wrap; gap:3px; min-width:0; padding:4px 6px; border-bottom:1px solid var(--dsw-alias-border-l2); flex-shrink:0; position:relative; }
.dsh-redis .redis-auto-refresh > button { padding:3px 5px; }
.dsh-redis .redis-auto-refresh [aria-pressed=true] { background:var(--redis-selected); }
.dsh-redis .redis-auto-refresh select { width:auto; max-width:100%; min-height:25px; padding:2px; font-size:10px; }
.dsh-redis .redis-auto-refresh > small { flex-basis:100%; font-size:9px; color:var(--dsw-alias-label-secondary); overflow-wrap:anywhere; }
.dsh-redis .redis-auto-refresh .redis-help-content { position:absolute; z-index:5; top:30px; right:0; width:min(310px,100%); max-height:50dvh; overflow:auto; }
@container redis-sidebar (max-width:480px) { .dsh-redis .redis-auto-refresh > button > span { display:none; } }
.dsh-redis .redis-inspector { flex:1; display:flex; flex-direction:column; min-height:0; min-width:0; overflow:auto; overscroll-behavior:contain; }
.dsh-redis .redis-key-identity { padding:9px; flex-shrink:0; }
.dsh-redis .redis-details { position:relative; display:flex; flex-direction:column; flex:1; gap:6px; min-height:100%; min-width:0; padding:8px; overflow:auto; overscroll-behavior:contain; }
.dsh-redis .redis-details > h2 { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }
.dsh-redis .redis-details > :is(form,p,small,label,dl,button,.redis-actions,.redis-help) { flex-shrink:0; }
.dsh-redis .redis-details > form { display:flex; align-items:end; flex-wrap:wrap; gap:6px; padding-bottom:6px; border-bottom:1px solid var(--dsw-alias-border-l2); }
.dsh-redis .redis-details > form > .redis-address { display:contents; }
.dsh-redis .redis-details > form label { flex:1 1 95px; }
.dsh-redis .redis-details > form .redis-actions { flex:0 1 auto; min-width:0; max-width:100%; }
.dsh-redis .redis-details > label { max-width:190px; }
.dsh-redis .redis-details > small { order:8; color:var(--dsw-alias-label-secondary); font-size:10px; }
.dsh-redis .redis-metadata { display:grid; grid-template-columns:minmax(100px,1fr) minmax(0,2fr); gap:6px 12px; margin:0; font-size:11px; }
.dsh-redis .redis-metadata dt { color:var(--dsw-alias-label-secondary); overflow-wrap:anywhere; }
.dsh-redis .redis-metadata dd { margin:0; min-width:0; overflow-wrap:anywhere; font-family:Consolas,monospace; font-variant-numeric:tabular-nums; }
.dsh-redis .redis-inspector[data-view=data] .redis-details > .redis-metadata:first-of-type { display:flex; align-items:center; gap:5px 9px; flex-wrap:wrap; order:-2; min-height:23px; }
.dsh-redis .redis-inspector[data-view=data] .redis-details > .redis-metadata:first-of-type > :nth-child(n+5) { display:none; }
.dsh-redis .redis-inspector[data-view=data] .redis-timeseries > .redis-metadata:not(:first-of-type) { display:none; }
.dsh-redis .redis-inspector[data-view=metadata] .redis-details > :not(.redis-metadata):not(small):not([role=alert]):not([role=status]) { display:none; }
.dsh-redis .redis-inspector[data-view=metadata] > button { display:none; }
.dsh-redis .redis-format-toolbar { display:flex; align-items:center; gap:3px; flex-wrap:wrap; min-height:28px; border-bottom:1px solid var(--dsw-alias-border-l2); padding-bottom:4px; flex-shrink:0; }
.dsh-redis .redis-format-toolbar > button { padding:3px 6px; border-color:transparent; }
.dsh-redis .redis-format-toolbar [aria-pressed=true] { background:var(--redis-panel); border-color:var(--dsw-alias-border-l2); }
.dsh-redis .redis-format-toolbar select { width:128px; min-height:24px; padding:3px; font-size:10px; }
.dsh-redis .redis-format-toolbar .redis-copy-button { margin-left:auto; }
.dsh-redis .redis-format-toolbar small { font-size:10px; color:var(--dsw-alias-label-secondary); }
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
.dsh-redis .redis-cell-preview .redis-byte-preview { flex:none; }
.dsh-redis .redis-collection-table { flex:1 1 180px; min-height:100px; max-height:58dvh; overflow:auto; overscroll-behavior:contain; min-width:0; border-top:1px solid var(--dsw-alias-border-l2); }
.dsh-redis .redis-collection-table table { border-collapse:collapse; width:100%; min-width:320px; table-layout:auto; }
.dsh-redis .redis-collection-table th, .dsh-redis .redis-collection-table td { text-align:left; padding:6px 8px; border-bottom:1px solid var(--dsw-alias-border-l2); vertical-align:top; overflow-wrap:anywhere; font-size:11px; }
.dsh-redis .redis-collection-table th { position:sticky; top:0; white-space:nowrap; overflow-wrap:normal; background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-secondary); font-weight:500; }
.dsh-redis .redis-collection-table button { display:flex; flex-direction:column; align-items:start; gap:2px; width:100%; border:0; padding:0; text-align:left; overflow-wrap:anywhere; background:transparent; }
.dsh-redis .redis-collection-table small { color:var(--dsw-alias-label-secondary); font-size:9px; }
.dsh-redis .redis-collection-table [data-column=member] { min-width:120px; }
.dsh-redis .redis-collection-table :is([data-column=longitude],[data-column=latitude],[data-column=timestamp],[data-column=score],[data-column=id],[data-column=rank],[data-column=index]), .dsh-redis .redis-timeseries [data-column=value] { white-space:nowrap; }
.dsh-redis .redis-data-views [aria-pressed=true] { background:var(--redis-selected); }
.dsh-redis .redis-ts-chart { display:flex; flex-direction:column; gap:7px; min-width:0; }
.dsh-redis .redis-chart-viewport { overflow:auto; min-width:0; max-width:100%; overscroll-behavior:contain; }
.dsh-redis .redis-chart-viewport svg { display:block; width:100%; min-width:320px; height:auto; color:var(--dsw-alias-label-primary); }
.dsh-redis .redis-chart-grid { fill:none; stroke:var(--dsw-alias-border-l2); stroke-width:1; vector-effect:non-scaling-stroke; }
.dsh-redis .redis-chart-line { fill:none; stroke:currentColor; stroke-width:1.5; vector-effect:non-scaling-stroke; }
.dsh-redis .redis-chart-dot { fill:var(--dsw-alias-bg-base); stroke:currentColor; stroke-width:1; vector-effect:non-scaling-stroke; cursor:crosshair; }
.dsh-redis .redis-chart-dot[data-chart-selected=true] { fill:currentColor; }
.dsh-redis .redis-chart-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(160px,100%),1fr)); gap:6px; }
.dsh-redis .redis-chart-stats dl { margin:0; min-width:0; }
.dsh-redis .redis-chart-stats dt { color:var(--dsw-alias-label-secondary); font-size:10px; }
.dsh-redis .redis-chart-stats dd { margin:2px 0 0; font:11px/1.45 Consolas,monospace; overflow-wrap:anywhere; }
.dsh-redis .redis-chart-point { padding-top:6px; border-top:1px solid var(--dsw-alias-border-l2); }
.dsh-redis .redis-cell-preview { display:flex; flex-direction:column; gap:6px; min-width:0; padding-top:7px; border-top:1px solid var(--dsw-alias-border-l2); }
.dsh-redis .redis-cell-preview .redis-value { max-height:220px; min-height:80px; }
.dsh-redis .redis-help { min-width:0; flex-shrink:0; font-size:11px; }
.dsh-redis .redis-help > summary { display:flex; align-items:center; justify-content:center; width:24px; height:24px; border:1px solid transparent; border-radius:4px; list-style:none; cursor:pointer; color:var(--dsw-alias-label-secondary); }
.dsh-redis .redis-help > summary::-webkit-details-marker { display:none; }
.dsh-redis .redis-help > summary:hover { border-color:var(--dsw-alias-border-l2); }
.dsh-redis .redis-help-content { display:flex; flex-direction:column; gap:8px; padding:9px; border:1px solid var(--dsw-alias-border-l2); border-radius:4px; background:var(--redis-panel); }
.dsh-redis .redis-workspace-heading .redis-help-content { position:absolute; z-index:3; top:32px; right:5px; width:min(310px,calc(100% - 10px)); max-height:60dvh; overflow:auto; }
@container redis-sidebar (max-width:760px) {
  .dsh-redis .redis-connection { grid-template-columns:minmax(0,1fr); grid-template-rows:32px minmax(0,1fr) auto; grid-template-areas:"compact" "browser" "status"; }
  .dsh-redis .redis-profile-navigation { display:none; }
  .dsh-redis .redis-compact-connection { display:flex; }
  .dsh-redis .redis-keys { grid-template-columns:170px minmax(0,1fr); }
  .dsh-redis .redis-inspector[data-view=metadata] .redis-metadata { grid-template-columns:minmax(0,1fr); }
  .dsh-redis .redis-inspector[data-view=metadata] .redis-metadata dd { margin-bottom:7px; }
}
@container redis-sidebar (max-width:480px) {
  .dsh-redis .redis-keys { grid-template-columns:128px minmax(0,1fr); }
  .dsh-redis .redis-key-catalog { padding:5px; }
  .dsh-redis .redis-key-catalog .redis-db { flex-wrap:wrap; align-items:stretch; }
  .dsh-redis .redis-key-catalog .redis-db label { flex-basis:100%; }
  .dsh-redis .redis-key-list small { display:none; }
  .dsh-redis .redis-key-list [data-namespace-count] { display:block; }
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
`
  document.head.append(style)
  return () => style.remove()
}
