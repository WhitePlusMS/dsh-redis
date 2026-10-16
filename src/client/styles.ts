/** Native DSH theme tokens keep both light and dark surfaces consistent. */
export function installRedisStyles(): () => void {
  const style = document.createElement('style')
  style.dataset.dshRedis = 'true'
  style.textContent = `
.dsh-redis { height:100%; min-height:0; min-width:0; display:flex; flex-direction:column; overflow:hidden; container:redis-sidebar / inline-size; color:var(--dsw-alias-label-primary); background:var(--dsw-alias-bg-base); font-size:13px; --redis-error:#b42318; }
body[data-ds-dark-theme] .dsh-redis { --redis-error:#ffb4ab; }
.dsh-redis * { box-sizing:border-box; }
.dsh-redis header { display:flex; align-items:center; gap:8px; padding:12px; flex-shrink:0; border-bottom:1px solid var(--dsw-alias-border-l2); }
.dsh-redis h2 { margin:0; font-size:14px; }
.dsh-redis .redis-badge { margin-left:auto; border:1px solid var(--dsw-alias-border-l2); border-radius:5px; padding:2px 6px; color:var(--dsw-alias-label-secondary); font-size:11px; }
.dsh-redis .redis-empty { display:grid; place-content:center; gap:12px; padding:24px; flex:1; text-align:center; }
.dsh-redis p { margin:0; line-height:1.6; overflow-wrap:anywhere; color:var(--dsw-alias-label-secondary); }
.dsh-redis button { padding:6px 12px; color:inherit; background:var(--dsw-alias-bg-base); border:1px solid var(--dsw-alias-border-l2); border-radius:6px; cursor:pointer; }
.dsh-redis :is(button,input,select,textarea,summary,[tabindex]):focus-visible { outline:2px solid var(--dsw-alias-label-primary); outline-offset:2px; }
.dsh-redis .redis-status { padding:10px 12px; flex-shrink:0; border-top:1px solid var(--dsw-alias-border-l2); font-size:12px; }
.dsh-redis .redis-error { color:var(--redis-error); }
.dsh-redis .redis-connection { padding:12px; display:flex; flex-direction:column; gap:10px; flex:1; min-height:0; min-width:0; overflow:auto; overscroll-behavior:contain; }
.dsh-redis .redis-connection[data-connected=true] { overflow:hidden; }
.dsh-redis .redis-connection > :not(.redis-keys) { flex-shrink:0; }
.dsh-redis .redis-connection-settings { max-height:40%; min-height:0; overflow:auto; overscroll-behavior:contain; }
.dsh-redis .redis-connection-settings summary { cursor:pointer; padding:4px 0; }
.dsh-redis fieldset { padding:0; margin:0; border:0; display:flex; flex-direction:column; gap:12px; min-width:0; }
.dsh-redis label { display:flex; flex-direction:column; gap:6px; min-width:0; }
.dsh-redis input, .dsh-redis textarea, .dsh-redis select { width:100%; min-width:0; padding:7px 9px; border:1px solid var(--dsw-alias-border-l2); border-radius:5px; color:inherit; background:var(--dsw-alias-bg-base); font:inherit; }
.dsh-redis .redis-profiles { display:flex; flex-direction:column; gap:10px; padding-bottom:14px; border-bottom:1px solid var(--dsw-alias-border-l2); }
.dsh-redis textarea { resize:vertical; }
.dsh-redis .redis-checkbox { flex-direction:row; align-items:center; }
.dsh-redis .redis-checkbox input { width:auto; }
.dsh-redis .redis-address { display:grid; grid-template-columns:minmax(0,1fr) 95px; gap:10px; }
.dsh-redis .redis-bounds { grid-template-columns:repeat(2,minmax(0,1fr)); }
.dsh-redis .redis-actions { display:flex; flex-wrap:wrap; gap:8px; }
.dsh-redis button:disabled { opacity:.5; cursor:wait; }
.dsh-redis .redis-connected { color:var(--dsw-alias-label-primary); }
.dsh-redis .redis-keys { display:grid; grid-template-columns:minmax(0,1fr); flex:1; min-height:0; min-width:0; overflow:hidden; border-top:1px solid var(--dsw-alias-border-l2); }
.dsh-redis .redis-key-catalog { display:flex; flex-direction:column; gap:10px; min-height:0; min-width:0; overflow:auto; padding-top:12px; overscroll-behavior:contain; }
.dsh-redis .redis-key-detail { display:none; flex-direction:column; gap:10px; min-height:0; min-width:0; overflow:auto; padding-top:8px; overscroll-behavior:contain; }
.dsh-redis .redis-keys[data-detail-open=true] .redis-key-catalog { display:none; }
.dsh-redis .redis-keys[data-detail-open=true] .redis-key-detail { display:flex; }
.dsh-redis .redis-key-navigation { position:sticky; top:0; z-index:1; padding-bottom:6px; background:var(--dsw-alias-bg-base); }
.dsh-redis .redis-keys form { display:flex; flex-direction:column; gap:10px; }
.dsh-redis .redis-keys .redis-db { flex-direction:row; align-items:end; }
.dsh-redis .redis-db label { flex:1; }
.dsh-redis .redis-key-list { display:flex; flex-direction:column; gap:4px; flex:1; min-height:80px; overflow:auto; overscroll-behavior:contain; }
.dsh-redis .redis-key-list button { display:flex; align-items:center; gap:8px; text-align:left; min-width:0; flex-shrink:0; }
.dsh-redis .redis-key-list span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; }
.dsh-redis .redis-key-list small { flex-shrink:0; }
.dsh-redis .redis-key-list [aria-pressed=true] { border-color:var(--dsw-alias-label-primary); }
.dsh-redis .redis-details { display:flex; flex-direction:column; gap:10px; min-width:0; padding-top:14px; border-top:1px solid var(--dsw-alias-border-l2); }
.dsh-redis .redis-details h2 span { display:block; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dsh-redis .redis-metadata { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px 12px; margin:0; }
.dsh-redis .redis-metadata dt { overflow-wrap:anywhere; }
.dsh-redis .redis-metadata dd { margin:0; overflow-wrap:anywhere; }
.dsh-redis .redis-value { white-space:pre; overflow:auto; overscroll-behavior:contain; max-width:100%; max-height:400px; margin:0; padding:10px; border:1px solid var(--dsw-alias-border-l2); border-radius:5px; font-size:12px; }
.dsh-redis .redis-collection-table { max-height:320px; overflow:auto; overscroll-behavior:contain; min-width:0; }
.dsh-redis .redis-collection-table table { border-collapse:collapse; width:100%; min-width:360px; table-layout:auto; }
.dsh-redis .redis-collection-table th, .dsh-redis .redis-collection-table td { text-align:left; padding:6px; border-bottom:1px solid var(--dsw-alias-border-l2); vertical-align:top; overflow-wrap:anywhere; }
.dsh-redis .redis-collection-table th { position:sticky; top:0; white-space:nowrap; overflow-wrap:normal; background:var(--dsw-alias-bg-base); }
.dsh-redis .redis-collection-table button { display:flex; flex-direction:column; gap:4px; width:100%; text-align:left; overflow-wrap:anywhere; }
.dsh-redis .redis-collection-table [data-column=member] { min-width:120px; }
.dsh-redis .redis-collection-table :is([data-column=longitude],[data-column=latitude],[data-column=timestamp],[data-column=score],[data-column=id],[data-column=rank],[data-column=index]), .dsh-redis .redis-timeseries [data-column=value] { white-space:nowrap; }
.dsh-redis .redis-cell-preview { display:flex; flex-direction:column; gap:10px; min-width:0; }
/* The actual pane width selects navigation, independent of the DSH viewport.
 * Keep both trees mounted so resize/back cannot restart readers or lose rows. */
@container redis-sidebar (min-width:640px) {
  .dsh-redis .redis-keys { grid-template-columns:minmax(210px,32%) minmax(0,1fr); }
  .dsh-redis .redis-keys[data-detail-open] > :is(.redis-key-catalog,.redis-key-detail) { display:flex; }
  .dsh-redis .redis-key-catalog { padding-right:12px; border-right:1px solid var(--dsw-alias-border-l2); }
  .dsh-redis .redis-key-detail { padding-left:12px; }
  .dsh-redis .redis-key-navigation { display:none; }
}
@container redis-sidebar (max-width:420px) {
  .dsh-redis .redis-bounds, .dsh-redis .redis-metadata { grid-template-columns:minmax(0,1fr); }
  .dsh-redis .redis-metadata dd { margin-bottom:6px; }
}
`
  document.head.append(style)
  return () => style.remove()
}
