window.__DEBUG_REGION__ = {};
(async function () {
  try {
    const vue = await import('/node_modules/@dcloudio/uni-h5-vue/dist/vue.runtime.esm.js');
    window.__DEBUG_REGION__.vue_ref_type = typeof vue.ref;
    if (typeof vue.ref === 'function') {
      const r = vue.ref(true);
      window.__DEBUG_REGION__.ref_ok = true;
      window.__DEBUG_REGION__.ref_value = r && typeof r.value;
    } else {
      window.__DEBUG_REGION__.ref_err = 'ref import not a function';
    }
  } catch (e) {
    window.__DEBUG_REGION__.vue_err = String(e && e.message || e);
  }
  try {
    const fb = await import('/src/utils/fallback.js');
    window.__DEBUG_REGION__.fb_keys = Object.keys(fb).slice(0, 20).join(',');
  } catch (e) {
    window.__DEBUG_REGION__.fb_err = String(e && e.message || e);
  }
  try {
    const api = await import('/src/api/index.js');
    window.__DEBUG_REGION__.api_keys = Object.keys(api).slice(0, 20).join(',');
    const tree = await api.regionApi.tree();
    window.__DEBUG_REGION__.tree = {
      code: tree && tree.code,
      provCount: tree && tree.data && tree.data.provinces && tree.data.provinces.length,
      cityCount: tree && tree.data && tree.data.provinces && tree.data.provinces.reduce &&
        tree.data.provinces.reduce(function (s, p) { return s + (p.cities && p.cities.length || 0); }, 0)
    };
  } catch (e) {
    window.__DEBUG_REGION__.api_err = String(e && e.message || e) + ' STACK ' + String(e && e.stack || '').slice(0, 300);
  }
})();
