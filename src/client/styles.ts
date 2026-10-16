/** Native DSH theme tokens keep both light and dark surfaces consistent. */
export function installRedisStyles(): () => void {
  const style = document.createElement('style')
  style.dataset.dshRedis = 'true'
  style.textContent = `
.dsh-redis { height:100%; min-height:0; display:flex; flex-direction:column; overflow:auto; color:var(--dsw-alias-label-primary); background:var(--dsw-alias-bg-base); font-size:13px; }
.dsh-redis * { box-sizing:border-box; }
.dsh-redis header { display:flex; align-items:center; gap:8px; padding:12px; border-bottom:1px solid var(--dsw-alias-border-l2); }
.dsh-redis h2 { margin:0; font-size:14px; }
.dsh-redis .redis-badge { margin-left:auto; border:1px solid var(--dsw-alias-border-l2); border-radius:5px; padding:2px 6px; color:var(--dsw-alias-label-secondary); font-size:11px; }
.dsh-redis .redis-empty { display:grid; place-content:center; gap:12px; padding:24px; flex:1; text-align:center; }
.dsh-redis p { margin:0; line-height:1.6; overflow-wrap:anywhere; color:var(--dsw-alias-label-secondary); }
.dsh-redis button { padding:6px 12px; color:inherit; background:var(--dsw-alias-bg-base); border:1px solid var(--dsw-alias-border-l2); border-radius:6px; cursor:pointer; }
.dsh-redis button:focus-visible { outline:2px solid #e05252; outline-offset:2px; }
.dsh-redis .redis-status { padding:10px 12px; border-top:1px solid var(--dsw-alias-border-l2); font-size:12px; }
.dsh-redis .redis-error { color:#e45b5b; }
.dsh-redis .redis-connection { padding:16px; display:flex; flex-direction:column; gap:14px; flex:1; }
.dsh-redis fieldset { padding:0; margin:0; border:0; display:flex; flex-direction:column; gap:12px; min-width:0; }
.dsh-redis label { display:flex; flex-direction:column; gap:6px; min-width:0; }
.dsh-redis input, .dsh-redis textarea, .dsh-redis select { width:100%; min-width:0; padding:7px 9px; border:1px solid var(--dsw-alias-border-l2); border-radius:5px; color:inherit; background:var(--dsw-alias-bg-base); font:inherit; }
.dsh-redis .redis-profiles { display:flex; flex-direction:column; gap:10px; padding-bottom:14px; border-bottom:1px solid var(--dsw-alias-border-l2); }
.dsh-redis textarea { resize:vertical; }
.dsh-redis .redis-checkbox { flex-direction:row; align-items:center; }
.dsh-redis .redis-checkbox input { width:auto; }
.dsh-redis .redis-address { display:grid; grid-template-columns:minmax(0,1fr) 95px; gap:10px; }
.dsh-redis .redis-actions { display:flex; flex-wrap:wrap; gap:8px; }
.dsh-redis button:disabled { opacity:.5; cursor:wait; }
.dsh-redis .redis-connected { color:var(--dsw-alias-label-primary); }
.dsh-redis .redis-keys { display:flex; flex-direction:column; gap:10px; min-width:0; padding-top:14px; border-top:1px solid var(--dsw-alias-border-l2); }
.dsh-redis .redis-keys form { display:flex; flex-direction:column; gap:10px; }
.dsh-redis .redis-keys .redis-db { flex-direction:row; align-items:end; }
.dsh-redis .redis-db label { flex:1; }
.dsh-redis .redis-key-list { display:flex; flex-direction:column; gap:4px; max-height:280px; overflow:auto; }
.dsh-redis .redis-key-list button { display:flex; align-items:center; gap:8px; text-align:left; min-width:0; flex-shrink:0; }
.dsh-redis .redis-key-list span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; }
.dsh-redis .redis-key-list small { flex-shrink:0; }
.dsh-redis .redis-key-list [aria-pressed=true] { border-color:var(--dsw-alias-label-primary); }
.dsh-redis .redis-details { display:flex; flex-direction:column; gap:10px; min-width:0; padding-top:14px; border-top:1px solid var(--dsw-alias-border-l2); }
.dsh-redis .redis-details h2 span { overflow-wrap:anywhere; }
.dsh-redis .redis-metadata { display:grid; grid-template-columns:auto minmax(0,1fr); gap:6px 12px; margin:0; }
.dsh-redis .redis-metadata dd { margin:0; overflow-wrap:anywhere; }
.dsh-redis .redis-value { white-space:pre; overflow:auto; max-height:400px; margin:0; padding:10px; border:1px solid var(--dsw-alias-border-l2); border-radius:5px; font-size:12px; }
.dsh-redis .redis-collection-table { max-height:320px; overflow:auto; min-width:0; }
.dsh-redis .redis-collection-table table { border-collapse:collapse; width:100%; table-layout:fixed; }
.dsh-redis .redis-collection-table th, .dsh-redis .redis-collection-table td { text-align:left; padding:6px; border-bottom:1px solid var(--dsw-alias-border-l2); vertical-align:top; overflow-wrap:anywhere; }
.dsh-redis .redis-collection-table th { position:sticky; top:0; background:var(--dsw-alias-bg-base); }
.dsh-redis .redis-collection-table button { display:flex; flex-direction:column; gap:4px; width:100%; text-align:left; overflow-wrap:anywhere; }
.dsh-redis .redis-cell-preview { display:flex; flex-direction:column; gap:10px; min-width:0; }
`
  document.head.append(style)
  return () => style.remove()
}
