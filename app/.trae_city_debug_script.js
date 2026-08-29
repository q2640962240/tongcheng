(async () => {
  const vue = await import('/node_modules/@dcloudio/uni-h5-vue/dist/vue.runtime.esm.js');
  const fb = await import('/src/utils/fallback.js?t=' + Date.now());
  const api = await import('/src/api/index.js?t=' + Date.now());
  let tree = null, err = null;
  try { tree = await api.regionApi.tree(); } catch(e){ err = String(e.message || e) + '|' + (e.stack||'').slice(0,300); }
  const r = vue.ref(true);
  const info = {
    hasRef: typeof vue.ref,
    refVal: typeof r,
    refIsFunc: typeof (r && r.value),
    hasFb: Object.keys(fb).slice(0,15).join(','),
    hasApi: Object.keys(api).slice(0,12).join(','),
    treeErr: err,
    treeDataShape: tree ? {code:tree.code, hasData:!!tree.data, provCount: tree.data && tree.data.provinces && tree.data.provinces.length} : null
  };
  return JSON.stringify(info, null, 2);
})()
