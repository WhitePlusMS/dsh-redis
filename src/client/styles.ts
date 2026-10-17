/** Compact Database/RESP workbench; only the plugin owns these surfaces. */
export function installRedisStyles(): () => void {
  const style = document.createElement('style')
  style.dataset.dshRedis = 'true'
  style.textContent = `

.dsh-redis { height:100%; min-height:0; min-width:0; display:flex; flex-direction:column; overflow:hidden; container:redis-sidebar / inline-size; color:var(--dsw-alias-label-primary); background:var(--dsw-alias-bg-base); font-family:inherit; font-size:12px; line-height:1.45; --redis-error:#b42318; --redis-accent:#397e72; --redis-folder:#5a7c9f; --redis-key:#797096; --redis-panel:color-mix(in srgb,var(--dsw-alias-bg-base) 97%,var(--dsw-alias-label-primary)); --redis-selected:color-mix(in srgb,var(--dsw-alias-bg-base) 86%,var(--redis-accent)); }
body[data-ds-dark-theme] .dsh-redis { --redis-error:#ffb4ab; --redis-accent:#79c6b6; --redis-folder:#9ab5cf; --redis-key:#b4a9ca; }
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
.dsh-redis :is(.redis-connection-dialog,.redis-snapshot-dialog) { position:fixed; inset:0; margin:auto; width:min(470px,calc(100% - 24px)); max-height:90dvh; padding:0; color:inherit; background:var(--dsw-alias-bg-base); border:1px solid var(--dsw-alias-border-l2); border-radius:8px; box-shadow:0 12px 40px #0003; overflow:hidden; }
.dsh-redis :is(.redis-connection-dialog,.redis-snapshot-dialog)[open] { display:flex; flex-direction:column; }
.dsh-redis :is(.redis-connection-dialog,.redis-snapshot-dialog)::backdrop { background:#10182766; }
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
.dsh-redis .redis-profile-privacy { padding-top:4px; font-size:10px; }
.dsh-redis .redis-connection-editor { min-width:0; display:flex; flex-direction:column; gap:12px; }
.dsh-redis .redis-connection-extras { grid-column:1 / -1; border-top:1px solid var(--dsw-alias-border-l2); padding-top:10px; min-width:0; }
.dsh-redis .redis-connection-dialog .redis-profile-tools { padding-bottom:0; border:0; }
.dsh-redis .redis-connection-dialog :is(input,select) { min-height:33px; padding:6px 8px; }
.dsh-redis .redis-form-section { display:flex; flex-direction:column; gap:10px; }
.dsh-redis .redis-form-section h3 { font-size:11px; font-weight:500; margin:0; color:var(--dsw-alias-label-secondary); }
.dsh-redis .redis-connect-form > fieldset { gap:18px; }
.dsh-redis .redis-tls-section { padding-top:12px; border-top:1px solid var(--dsw-alias-border-l2); }
.dsh-redis .redis-tls-section .redis-checkbox input { min-height:0; accent-color:var(--redis-accent); }
.dsh-redis .redis-connect-actions { justify-content:flex-end; padding-top:4px; }
.dsh-redis .redis-connect-actions button { min-height:33px; padding:6px 12px; }
.dsh-redis .redis-primary-button { background:var(--redis-accent); border-color:var(--redis-accent); color:var(--dsw-alias-bg-base); font-weight:600; }
.dsh-redis .redis-primary-button:hover { background:color-mix(in srgb,var(--redis-accent) 88%,var(--dsw-alias-label-primary)); }
.dsh-redis .redis-connection-notice { display:flex; flex-direction:column; align-items:flex-start; gap:7px; padding:10px 12px; border-left:2px solid var(--redis-accent); background:var(--redis-selected); border-radius:0 5px 5px 0; }
.dsh-redis .redis-connection-notice strong { font-size:11px; font-weight:500; }
@media (max-width:600px) { .dsh-redis .redis-connection-layout { grid-template-columns:minmax(0,1fr); padding:14px; gap:14px; } .dsh-redis .redis-connection-layout .redis-profiles { border-right:0; border-bottom:1px solid var(--dsw-alias-border-l2); padding:0 0 14px; } }
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
.dsh-redis .redis-detail-page .redis-byte-preview { flex:1 0 190px; }
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
.dsh-redis .redis-page-sentinel { height:2px; width:1px; }
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
.dsh-redis .redis-detail-page { display:flex; flex:1; flex-direction:column; gap:10px; min-width:0; min-height:0; overflow:auto; overscroll-behavior:contain; }
.dsh-redis .redis-detail-page-heading { display:flex; flex-direction:column; gap:10px; padding-bottom:9px; border-bottom:1px solid var(--dsw-alias-border-l2); flex-shrink:0; }
.dsh-redis .redis-detail-page-heading h2 { font-size:13px; overflow-wrap:anywhere; }
.dsh-redis .redis-back-button { align-self:flex-start; color:var(--redis-accent); border-color:transparent; background:transparent; padding:3px 0; }
.dsh-redis .redis-byte-identity { flex-shrink:0; font-size:10px; color:var(--dsw-alias-label-secondary); }
.dsh-redis .redis-byte-identity > summary { cursor:pointer; padding:3px 0; }
.dsh-redis .redis-byte-identity textarea { margin-top:6px; font:11px/1.5 Consolas,monospace; }
.dsh-redis .redis-cell-preview .redis-value { min-height:120px; max-height:none; background:var(--redis-panel); border-radius:5px; }
/* Keep tables mounted, but expose only one inspector page at a time. */
.dsh-redis .redis-inspector[data-view=data] .redis-details:is([data-cell-open=true],[data-message-open=true]) { height:100%; min-height:0; overflow:hidden; }
.dsh-redis .redis-inspector[data-view=data] .redis-details[data-message-open=true] > :not(.redis-stream-fields):not(.redis-cell-preview):not([role=alert]) { display:none; }
.dsh-redis .redis-inspector[data-view=data] .redis-details[data-cell-open=true] > :not(.redis-cell-preview):not([role=alert]) { display:none; }
.dsh-redis .redis-help { min-width:0; flex-shrink:0; font-size:11px; }
.dsh-redis .redis-help > summary { display:flex; align-items:center; justify-content:center; width:24px; height:24px; border:1px solid transparent; border-radius:4px; list-style:none; cursor:pointer; color:var(--dsw-alias-label-secondary); }
.dsh-redis .redis-help > summary::-webkit-details-marker { display:none; }
.dsh-redis .redis-help > summary:hover { border-color:var(--dsw-alias-border-l2); }
.dsh-redis .redis-help-content { display:flex; flex-direction:column; gap:8px; padding:9px; border:1px solid var(--dsw-alias-border-l2); border-radius:4px; background:var(--redis-panel); }
.dsh-redis .redis-workspace-heading .redis-help-content { position:absolute; z-index:3; top:32px; right:5px; width:min(310px,calc(100% - 10px)); max-height:60dvh; overflow:auto; }
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
.dsh-redis .redis-db-summary { margin-left:auto; color:var(--dsw-alias-label-secondary); font-size:10px; }
.dsh-redis .redis-catalog-filters { padding:5px 7px; border-bottom:1px solid var(--dsw-alias-border-l2); }
.dsh-redis .redis-catalog-filters form { flex-direction:row; align-items:end; margin-bottom:5px; }
.dsh-redis .redis-catalog-filters label { flex:1; }
.dsh-redis .redis-namespace-tools { padding:0 5px 3px; border-bottom:1px solid var(--dsw-alias-border-l2); }
.dsh-redis .redis-key-list button { border-radius:0; }
.dsh-redis .redis-key-list button > .redis-icon { color:var(--redis-key); }
.dsh-redis .redis-key-list button[data-namespace-id] > .redis-icon { color:var(--redis-folder); }
.dsh-redis .redis-key-list button[data-db] > .redis-icon { color:var(--redis-accent); }
.dsh-redis .redis-key-list button[data-db] > .redis-icon:first-child { color:inherit; width:10px; }
.dsh-redis .redis-key-list [aria-selected=true] { background:var(--redis-selected); box-shadow:inset 2px 0 var(--redis-accent); }
.dsh-redis .redis-key-list [data-namespace-count] { display:inline; font-size:inherit; color:inherit; }
.dsh-redis .redis-load-status { display:flex; flex-direction:column; gap:3px; padding:6px 7px; border-top:1px solid var(--dsw-alias-border-l2); font-size:10px; color:var(--dsw-alias-label-secondary); flex-shrink:0; }
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
