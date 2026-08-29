<template>
  <view class="page-city">
    <!-- 顶部搜索条（全国城市实时搜索） -->
    <view class="search-header">
      <view class="back-btn" @tap="onBack"><text class="arrow">‹</text></view>
      <view class="search-bar">
        <text class="s-icon">🔎</text>
        <input
          v-model="searchKw"
          class="s-input"
          type="text"
          placeholder="搜索城市 / 拼音 / 简称（如 bj、羊城、魔都）"
          confirm-type="search"
          :focus="autoFocus"
          @input="onSearchInput"
          @confirm="onSearchConfirm"
        />
        <text v-if="searchKw" class="s-clear" @tap="clearSearch">✕</text>
      </view>
    </view>

    <!-- 搜索结果视图（仅当有搜索词时） -->
    <block v-if="searchKw && searched">
      <view class="section card">
        <view class="section-title">
          <text>搜索结果</text>
          <text class="meta-hint" v-if="metaSearch.hint">{{ metaSearch.hint }}</text>
        </view>
        <view v-if="searchResult.length === 0" class="empty-s">
          <text class="empty-emoji">🏙️</text>
          <text class="empty-text">未找到相关城市，换个词试试</text>
        </view>
        <view
          v-for="c in searchResult"
          :key="c.code || c.name"
          class="city-item"
          :class="{ selected: current === c.name }"
          @tap="onChoose(c.name)"
        >
          <view class="city-info">
            <text class="city-main">{{ c.name }}</text>
            <text class="city-sub" v-if="c.provinceName && c.provinceName !== c.name">
              {{ c.provinceName }}{{ c.alias && c.alias.length ? ' · ' + c.alias.slice(0, 2).join('/') : '' }}
            </text>
          </view>
          <text v-if="current === c.name" class="checked">✓</text>
        </view>
      </view>
      <view class="bottom-safe" />
    </block>

    <!-- 常规选择视图（未搜索时） -->
    <block v-else>
      <!-- 当前城市 + 定位 -->
      <view class="section card">
        <view class="section-title">
          <text>当前城市</text>
          <text class="meta-hint" v-if="locateSource">{{ sourceText(locateSource) }}</text>
        </view>
        <view class="current-row">
          <view class="current-city" @tap="onChoose(current)">
            <text class="city-badge">📍</text>
            <text class="city-name">{{ current }}</text>
            <view v-if="locating" class="locating-dot" />
          </view>
          <view class="locate-btn" :class="{ disabled: locating }" @tap="runLocatePipeline">
            <text>{{ locating ? '定位中…' : '重新定位' }}</text>
          </view>
        </view>
        <view v-if="locateError" class="locate-error">
          <text>{{ locateError }}</text>
          <text class="err-link" @tap="runLocatePipeline"> 重试</text>
        </view>
      </view>

      <!-- 热门城市（数据流量 Top 12） -->
      <view class="section card">
        <view class="section-title">热门城市</view>
        <view class="hot-grid">
          <view
            v-for="c in hotCities"
            :key="c"
            class="hot-item"
            :class="{ active: current === c }"
            @tap="onChoose(c)"
          >
            {{ c }}
          </view>
        </view>
      </view>

      <!-- 列表模式切换：字母 / 按省多级 -->
      <view class="section card mode-card">
        <view class="mode-switch">
          <view
            class="mode-chip"
            :class="{ active: listMode === 'by-province' }"
            @tap="switchListMode('by-province')"
          >
            <text>按省选择（多级）</text>
          </view>
          <view
            class="mode-chip"
            :class="{ active: listMode === 'by-letter' }"
            @tap="switchListMode('by-letter')"
          >
            <text>按字母查找</text>
          </view>
        </view>

        <block v-if="listMode === 'by-province' && provinceGroups.length">
          <view class="mode-actions">
            <view class="action-btn" @tap="expandAllProvinces"><text>全部展开</text></view>
            <view class="action-btn" @tap="collapseAllProvinces"><text>全部收起</text></view>
            <text class="mode-sub" v-if="!treeLoaded">数据加载中，临时展示内置 34 省入口…</text>
            <text class="mode-sub" v-else>共 {{ provinces.length || 34 }} 省 · 点省名即可展开城市</text>
          </view>

          <block v-for="group in provinceGroups" :key="'pg-' + group.letter">
            <view class="group-letter" :id="'pletter-' + group.letter">
              <text>{{ group.letter }}</text>
              <text class="group-count">{{ group.list.length }} 省</text>
            </view>
            <view
              v-for="p in group.list"
              :key="p.code"
              class="province-row"
              :class="{ expanded: expandedProvinces[p.code], active: activeProvinceCode === p.code }"
            >
              <view class="province-head" @tap="onChooseProvince(p)">
                <text class="province-name">{{ p.name }}</text>
                <text class="province-meta">
                  {{ p.cityCount }} 市
                </text>
                <text class="chev" :class="{ open: expandedProvinces[p.code] }">›</text>
              </view>
              <view v-if="expandedProvinces[p.code]" class="city-nest">
                <view
                  v-for="(c, idx) in p.cities"
                  :key="'cc-' + p.code + '-' + (c.code || idx)"
                  class="city-item nest"
                  :class="{ selected: current === c.name }"
                  @tap.stop="onChoose(c.name)"
                >
                  <view class="city-info">
                    <text class="city-main">{{ c.name }}</text>
                    <text class="city-sub" v-if="c.alias && c.alias.length">
                      {{ c.alias.slice(0, 2).join(' / ') }}
                    </text>
                  </view>
                  <text v-if="current === c.name" class="checked">✓</text>
                </view>
              </view>
            </view>
          </block>
        </block>

        <block v-if="listMode === 'by-letter'">
          <view class="letter-bar" v-if="letters.length">
            <view
              v-for="L in letters"
              :key="'ml-' + L"
              class="letter-chip"
              :class="{ active: activeLetter === L }"
              @tap="scrollToLetter(L)"
            >{{ L }}</view>
          </view>

          <!-- 城市列表（字母分组） -->
          <view class="city-list-card" v-if="cityGroups.length">
            <view class="meta-row">
              <text class="meta-total">共 {{ metaTotalCities }} 个地级及以上城市 · 34 省</text>
              <text class="meta-source" v-if="treeLoaded">数据：民政部 2024 版</text>
              <text class="meta-source meta-warn" v-else>加载中，临时使用内置常用城市…</text>
            </view>
            <block v-for="group in cityGroups" :key="'lg-' + group.letter">
              <view class="group-letter" :id="'letter-' + group.letter">
                <text>{{ group.letter }}</text>
                <text class="group-count">{{ group.list.length }}</text>
              </view>
              <view
                v-for="c in group.list"
                :key="'lc-' + (c.code || c.name)"
                class="city-item"
                :class="{ selected: current === c.name }"
                @tap="onChoose(c.name)"
              >
                <view class="city-info">
                  <text class="city-main">{{ c.name }}</text>
                  <text class="city-sub" v-if="c.provinceName && c.provinceName !== c.name">
                    {{ c.provinceName }}
                  </text>
                </view>
                <text v-if="current === c.name" class="checked">✓</text>
              </view>
            </block>
          </view>
        </block>
      </view>

      <view class="bottom-safe" />
    </block>
  </view>
</template>

<script setup>
import { ref as _ref, computed as _computed, onMounted as _onMounted } from 'vue'
// 说明：本页统一使用 _ref / _computed / _onMounted，不声明同名顶层绑定 ref/computed/onMounted。
// 原因：script-setup 会自动把顶层所有绑定放进 __returned__ 暴露给 $setup，
//   在个别编译器版本下若暴露名为 ref 的绑定（即 Vue 内部 ref 函数），与 Vue 的 setup proxy
//   的 toRef 包装存在边缘冲突，可能导致 "_ref(...) is not a function"。
//   使用别名且不引入同名顶层变量，从根本上避开这一类冲突。
import { onLoad } from '@dcloudio/uni-app'
import { regionApi, locationApi } from '../../api'
import {
  toList, toObj, toStr, toNum, pickCity,
  retry, guard, unwrap, getPath, debounce
} from '../../utils/fallback'

const STORAGE_KEY = 'baiye_city'
const STORAGE_AT_KEY = 'baiye_city_at'
const DEFAULT_CITY = '北京'

// ==== 内置最小城市兜底：必须在任何计算属性前先定义，避免 TDZ 导致整页空白 ====
const BUILTIN_FALLBACK_CITIES = (function buildFallback() {
  const arr = [
    ['北京', '北京市', 'B'], ['上海', '上海市', 'S'], ['广州', '广东省', 'G'], ['深圳', '广东省', 'S'],
    ['成都', '四川省', 'C'], ['杭州', '浙江省', 'H'], ['武汉', '湖北省', 'W'], ['西安', '陕西省', 'X'],
    ['重庆', '重庆市', 'C'], ['南京', '江苏省', 'N'], ['苏州', '江苏省', 'S'], ['长沙', '湖南省', 'C'],
    ['天津', '天津市', 'T'], ['郑州', '河南省', 'Z'], ['青岛', '山东省', 'Q'], ['大连', '辽宁省', 'D'],
    ['宁波', '浙江省', 'N'], ['厦门', '福建省', 'X'], ['福州', '福建省', 'F'], ['合肥', '安徽省', 'H'],
    ['济南', '山东省', 'J'], ['沈阳', '辽宁省', 'S'], ['昆明', '云南省', 'K'], ['贵阳', '贵州省', 'G'],
    ['南宁', '广西壮族自治区', 'N'], ['南昌', '江西省', 'N'], ['哈尔滨', '黑龙江省', 'H'],
    ['长春', '吉林省', 'C'], ['太原', '山西省', 'T'], ['石家庄', '河北省', 'S'],
    ['海口', '海南省', 'H'], ['兰州', '甘肃省', 'L'], ['乌鲁木齐', '新疆维吾尔自治区', 'W'],
    ['呼和浩特', '内蒙古自治区', 'H'], ['银川', '宁夏回族自治区', 'Y'], ['西宁', '青海省', 'X'],
    ['拉萨', '西藏自治区', 'L'], ['东莞', '广东省', 'D'], ['佛山', '广东省', 'F'],
    ['无锡', '江苏省', 'W'], ['温州', '浙江省', 'W'], ['珠海', '广东省', 'Z'],
    ['中山', '广东省', 'Z'], ['泉州', '福建省', 'Q'], ['香港', '香港特别行政区', 'X'],
    ['澳门', '澳门特别行政区', 'A'], ['台北', '台湾省', 'T']
  ]
  const seen = new Set()
  const out = []
  for (const [name, province, letter] of arr) {
    if (seen.has(name)) continue
    seen.add(name)
    out.push({ name, provinceName: province, firstLetter: letter, spell: letter + name })
  }
  return out
})()

const autoFocus = _ref(true)
const current = _ref(DEFAULT_CITY)
const locating = _ref(false)
const locateSource = _ref('')
const locateError = _ref('')
const activeLetter = _ref('A')
const treeLoaded = _ref(false)
const searchKw = _ref('')
const searched = _ref(false)

// 本地缓存：全国行政区划（省 + 城市）
const provinces = _ref([])
const allCities = _ref([])
const searchResult = _ref([])
const metaSearch = _ref({ hint: '' })
// 多级菜单：展开的省 code 集合（用纯对象 Map<provCode,true>，避免 Vue 3 模板内 Set 兼容与 ref 套 Set 的边缘行为）
const expandedProvinces = _ref({})
// 多级菜单当前激活的省 code（用于多级菜单联动的 UX 强调）
const activeProvinceCode = _ref('')
// 列表模式：'by-letter' 按字母 / 'by-province' 按省→市多级
const listMode = _ref('by-province')
function switchListMode(m) {
  listMode.value = m
}

// 流量 Top 12（热门城市）
const HOT_DEFAULTS = [
  '北京', '上海', '广州', '深圳', '成都', '杭州',
  '武汉', '西安', '重庆', '南京', '苏州', '长沙'
]
const hotCities = _ref([...HOT_DEFAULTS])

// ==== 从存储恢复城市 ====
function _initFromStorage() {
  try {
    const saved = uni.getStorageSync(STORAGE_KEY)
    if (saved) current.value = pickCity(saved, DEFAULT_CITY)
  } catch (_) { /* ignore */ }
}
_initFromStorage()

function persistCity(name) {
  try {
    uni.setStorageSync(STORAGE_KEY, name)
    uni.setStorageSync(STORAGE_AT_KEY, Date.now())
  } catch (_) { /* ignore */ }
}

const metaTotalCities = _computed(() => allCities.value.length || HOT_DEFAULTS.length)

// ==== 字母分组（动态构建，空字母不显示）====
const cityGroups = _computed(() => {
  try {
    const list = toList(allCities.value.length ? allCities.value : BUILTIN_FALLBACK_CITIES)
    const map = new Map()
    for (const c of list) {
      const first = toStr(c.firstLetter, '')
      const fallback = (c.spell && typeof c.spell === 'string') ? c.spell[0] : ''
      const raw = (first || fallback || '#').toUpperCase()
      const L = /^[A-Z]$/.test(raw) ? raw : '#'
      if (!map.has(L)) map.set(L, [])
      map.get(L).push(c)
    }
    // 按 A-Z 排序，# 放最后
    const groups = []
    const order = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
    for (const L of order) {
      if (map.has(L)) groups.push({ letter: L, list: map.get(L).slice().sort(sortCity) })
    }
    if (map.has('#')) groups.push({ letter: '#', list: map.get('#').slice().sort(sortCity) })
    return groups
  } catch (e) {
    console.warn('[city.vue] cityGroups error:', e && e.message)
    return []
  }
})

const letters = _computed(() => cityGroups.value.map((g) => g.letter))

function sortCity(a, b) {
  const sa = toStr(a.spell || a.name, '')
  const sb = toStr(b.spell || b.name, '')
  if (sa < sb) return -1
  if (sa > sb) return 1
  return 0
}

// ==== 全国行政区划树形数据（带省首字母排序；用于「省→城市」多级菜单）====
const provinceGroups = _computed(() => {
  const fallbackList = toList(BUILTIN_FALLBACK_CITIES)
  // 如果接口拿到了省树：省首字母分组，保持原序
  if (provinces.value && provinces.value.length) {
    const map = new Map()
    for (const p of provinces.value) {
      const pName = toStr(p.name, '')
      const raw = (toStr(p.firstLetter, '') || toStr(p.spell, '')[0] || toStr(pName, '')[0] || '#').toUpperCase()
      const L = /^[A-Z]$/.test(raw) ? raw : '#'
      if (!map.has(L)) map.set(L, [])
      const code = toStr(p.code, '')
      const cityList = toList(p.cities).map((c) => ({
        code: toStr(c.code, ''),
        name: toStr(c.name, ''),
        provinceCode: code,
        provinceName: pName,
        firstLetter: (toStr(c.firstLetter, '') || toStr(c.spell, '')[0] || '#').toUpperCase(),
        spell: toStr(c.spell, ''),
        alias: toList(c.alias)
      })).sort(sortCity)
      map.get(L).push({
        code,
        name: pName,
        firstLetter: L,
        spell: toStr(p.spell, ''),
        cityCount: cityList.length,
        cities: cityList
      })
    }
    const groups = []
    const order = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
    for (const L of order) if (map.has(L)) groups.push({ letter: L, list: map.get(L) })
    if (map.has('#')) groups.push({ letter: '#', list: map.get('#') })
    return groups
  }
  // 接口未就绪：兜底 BUILTIN_FALLBACK_CITIES 按省聚合，也支持多级
  const byProvince = new Map()
  for (const c of fallbackList) {
    const pName = toStr(c.provinceName, '其他')
    if (!byProvince.has(pName)) {
      byProvince.set(pName, {
        code: '__fb__' + pName,
        name: pName,
        firstLetter: toStr(c.firstLetter, '#').toUpperCase(),
        spell: toStr(c.firstLetter, '') + pName,
        cityCount: 0,
        cities: []
      })
    }
    byProvince.get(pName).cities.push(c)
  }
  const out = [...byProvince.values()].map((p) => {
    p.cities = p.cities.sort(sortCity)
    p.cityCount = p.cities.length
    return p
  }).sort((a, b) => sortCity({ spell: a.firstLetter + a.name }, { spell: b.firstLetter + b.name }))
  const map = new Map()
  for (const p of out) {
    const L = /^[A-Z]$/.test(p.firstLetter) ? p.firstLetter : '#'
    if (!map.has(L)) map.set(L, [])
    map.get(L).push(p)
  }
  const groups = []
  const order = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  for (const L of order) if (map.has(L)) groups.push({ letter: L, list: map.get(L) })
  if (map.has('#')) groups.push({ letter: '#', list: map.get('#') })
  return groups
})
const provinceLetters = _computed(() => provinceGroups.value.map((g) => g.letter))

function toggleProvince(code) {
  const c = toStr(code, '')
  if (!c) return
  const next = { ...expandedProvinces.value }
  if (next[c]) delete next[c]
  else next[c] = true
  expandedProvinces.value = next
  activeProvinceCode.value = c
}
function expandAllProvinces() {
  const next = {}
  for (const g of provinceGroups.value) {
    for (const p of g.list) next[toStr(p.code, '')] = true
  }
  expandedProvinces.value = next
}
function collapseAllProvinces() {
  expandedProvinces.value = {}
}

// ==== 选择城市/省份入口（支持直接点省名下所有城市 / 点具体城市）====
function onChooseProvince(p) {
  if (!p) return
  const cities = toList(p && p.cities)
  if (cities.length === 0) {
    // 例如“北京/上海/天津/重庆”这种省级直辖市，自己既是省也是市
    const n = pickCity(p.name, '')
    if (n) onChoose(n)
    return
  }
  if (cities.length === 1) {
    // 仅一个市：直接选，少点一步
    onChoose(cities[0].name)
    return
  }
  // 否则展开/收起
  toggleProvince(p.code)
}

// ==== 拉取行政区划 ====
async function loadRegionTree() {
  try {
    const r = await guard(retry(() => regionApi.tree(), 2, 300), null)
    const tree = unwrap(r, null)
    const provList = toList(getPath(tree, 'provinces', []))
    provinces.value = provList
    // 展开所有城市
    const cities = []
    for (const p of provList) {
      const pName = toStr(p.name, '')
      for (const c of toList(p.cities)) {
        cities.push({
          code: toStr(c.code, ''),
          name: toStr(c.name, ''),
          provinceName: pName,
          provinceCode: toStr(p.code, ''),
          firstLetter: toStr(c.firstLetter, '').toUpperCase() || toStr(c.spell, '')[0] || '#',
          spell: toStr(c.spell, ''),
          alias: toList(c.alias)
        })
      }
    }
    allCities.value = cities
    treeLoaded.value = true
    if (listMode.value === 'by-letter' && letters.value.length) activeLetter.value = letters.value[0]
    if (provinceLetters.value.length) {
      // 默认展开第一个字母分组的第一个省（方便用户立刻看到"有内容"）
      try {
        const firstGroup = provinceGroups.value[0]
        if (firstGroup && firstGroup.list && firstGroup.list.length) {
          const first = firstGroup.list[0]
          const code = toStr(first.code, '')
          if (code) {
            const ns = { ...expandedProvinces.value }
            ns[code] = true
            expandedProvinces.value = ns
            activeProvinceCode.value = code
          }
        }
      } catch (_) {}
    }
  } catch (e) {
    // 失败：使用 BUILTIN_FALLBACK_CITIES，不白屏
    treeLoaded.value = false
    allCities.value = []
    if (listMode.value === 'by-letter' && letters.value.length) activeLetter.value = letters.value[0]
    try {
      const firstGroup = provinceGroups.value[0]
      if (firstGroup && firstGroup.list && firstGroup.list.length) {
        const first = firstGroup.list[0]
        const code = toStr(first.code, '')
        if (code) {
          const ns = { ...expandedProvinces.value }
          ns[code] = true
          expandedProvinces.value = ns
        }
      }
    } catch (_) {}
  }
}

// ==== 搜索接口调用（防抖 250ms）====
const doSearch = debounce(async () => {
  const kw = toStr(searchKw.value, '').trim()
  if (!kw) {
    searched.value = false
    searchResult.value = []
    metaSearch.value = { hint: '' }
    return
  }
  searched.value = true
  try {
    const r = await guard(regionApi.search(kw, 80), null)
    const list = toList(unwrap(r, [])).map((c) => ({
      code: toStr(c.code, ''),
      name: toStr(c.name, ''),
      provinceName: toStr(c.provinceName, c.province || ''),
      firstLetter: toStr(c.firstLetter, ''),
      spell: toStr(c.spell, ''),
      alias: toList(c.alias)
    })).filter((c) => c.name)
    searchResult.value = list
    const total = toNum(getPath(r, 'meta.total', list.length), list.length)
    metaSearch.value = { hint: `命中 ${total} 条 · 耗时 ${toNum(getPath(r, 'meta.tookMs', 0), 0)}ms` }
  } catch (_) {
    searchResult.value = []
    metaSearch.value = { hint: '' }
  }
}, 250)

function onSearchInput() {
  doSearch()
}
function onSearchConfirm() {
  doSearch()
  if (searchResult.value.length === 1) {
    onChoose(searchResult.value[0].name)
  }
}
function clearSearch() {
  searchKw.value = ''
  searched.value = false
  searchResult.value = []
  metaSearch.value = { hint: '' }
}

// ==== 4 级定位流水线 ====
async function runLocatePipeline() {
  if (locating.value) return
  locating.value = true
  locateError.value = ''
  locateSource.value = ''
  let city = '', source = ''
  // L2：uni.getLocation + 后端逆地理（未配置 key 时接口会返回 source=not-configured，空城市）
  if (typeof uni.getLocation === 'function') {
    try {
      const loc = await new Promise((resolve, reject) => {
        uni.getLocation({
          type: 'gcj02',
          success: resolve,
          fail: reject,
          timeout: 8000
        })
      })
      try {
        const r = await guard(locationApi.reverse({ lat: loc.latitude, lng: loc.longitude }), null)
        const got = pickCity(getPath(r, 'data.city', ''), '')
        const src = toStr(getPath(r, 'data.source', ''), '')
        if (got) {
          city = got
          source = 'reverse:' + src
        } else if (src === 'not-configured') {
          locateError.value = '定位服务密钥未配置，将按 IP 粗定位或展示默认城市。可在管理后台「配置中心 → App」填写高德/腾讯 key'
        }
      } catch (_) { /* 逆地理失败，继续 */ }
    } catch (err) {
      const msg = toStr(err && (err.errMsg || err.message), '')
      if (/auth|denied|禁止|权限/i.test(msg)) {
        locateError.value = '定位权限未开启，可在系统设置中允许白夜使用定位，或手动选择城市'
      }
    }
  }

  // L3：IP 粗定位
  if (!city) {
    try {
      const r = await guard(locationApi.guessByIp(), null)
      const got = pickCity(getPath(r, 'data.city', ''), '')
      if (got) {
        city = got
        source = 'ip-guess'
      }
    } catch (_) { /* IP 失败，继续 */ }
  }

  // L4：默认值
  if (!city) {
    city = current.value || DEFAULT_CITY
    source = 'fallback'
  }
  current.value = city
  locateSource.value = source
  persistCity(city)
  locating.value = false
}

function sourceText(s) {
  const map = {
    'reverse:amap': '高德逆地理',
    'reverse:tencent': '腾讯逆地理',
    'reverse:not-configured': '未配置定位服务',
    'reverse:bad-input': '定位输入异常',
    'ip-guess': 'IP 粗定位',
    'fallback': '默认城市',
    'cache': '本地缓存'
  }
  if (map[s]) return map[s]
  if (s && s.startsWith('reverse:')) return '逆地理(' + s.slice(8).slice(0, 20) + ')'
  return ''
}

// ==== 滚动到字母 ====
function scrollToLetter(L) {
  activeLetter.value = L
  uni.createSelectorQuery()
    .select(`#letter-${L}`)
    .boundingClientRect()
    .selectViewport()
    .scrollOffset()
    .exec((res) => {
      try {
        const rect = res && res[0]
        const scroll = res && res[1]
        if (rect && scroll) {
          uni.pageScrollTo({ scrollTop: scroll.scrollTop + rect.top - 80, duration: 300 })
        }
      } catch (_) { /* ignore */ }
    })
}

// ==== 选择城市 ====
function onChoose(c) {
  const name = pickCity(c, '')
  if (!name) return
  current.value = name
  persistCity(name)
  locateSource.value = 'manual'
  uni.showToast({ title: `已切换至${name}`, icon: 'none' })
  setTimeout(() => {
    uni.navigateBack({
      delta: 1,
      fail: () => uni.switchTab({ url: '/pages/home/home' })
    })
  }, 380)
}

function onBack() {
  uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/home/home' }) })
}

// ==== 生命期 ====
onLoad(() => {
  // nothing: 已在模块级从 storage 恢复
})
_onMounted(async () => {
  // DEBUG: 暴露到全局用于浏览器调试（生产可移除）
  try {
    window.__BAIYE_CITY_STATE__ = {
      BUILTIN_FALLBACK_CITIES,
      get hotCities() { return hotCities.value },
      get allCities() { return allCities.value },
      get provinces() { return provinces.value },
      get cityGroups() { return cityGroups.value },
      get provinceGroups() { return provinceGroups.value },
      get letters() { return letters.value },
      get searched() { return searched.value },
      get listMode() { return listMode.value },
      get expandedProvinces() { return expandedProvinces.value },
    }
  } catch (_) { /* ignore (SSR/wx) */ }
  // 并行启动：拉全国行政区划 + 尝试自动定位（互不阻塞，都有兜底）
  const p1 = loadRegionTree()
  const p2 = (async () => {
    try {
      const at = Number(uni.getStorageSync(STORAGE_AT_KEY) || 0)
      if (Date.now() - at < 24 * 3600 * 1000) {
        locateSource.value = 'cache'
        return
      }
      await runLocatePipeline()
    } catch (_) { /* ignore */ }
  })()
  await Promise.all([p1, p2])
})
</script>

<style lang="scss" scoped>
// 依赖 uni.scss 全局注入 theme-baiye 设计变量；不再重复 @use
.page-city { min-height: 100vh; background: $by-bg; padding-bottom: 24rpx; box-sizing: border-box; }

/* 顶部搜索条 */
.search-header {
  position: sticky; top: 0; z-index: 20;
  padding: 60rpx 24rpx 20rpx;
  background: linear-gradient(180deg, $by-bg-soft 0%, color.adjust($by-bg-soft, $alpha: 0.88) 80%, transparent 100%);
  display: flex; align-items: center; gap: 16rpx;
}
.back-btn {
  width: 60rpx; height: 60rpx; display: flex; align-items: center; justify-content: center;
  color: $by-text-1; font-weight: 700;
  .arrow { font-size: 48rpx; line-height: 48rpx; }
}
.search-bar {
  flex: 1; display: flex; align-items: center; gap: 12rpx;
  height: 72rpx; padding: 0 24rpx;
  background: $by-card-bg; border: 1rpx solid $by-border;
  border-radius: 9999rpx;
}
.s-icon { font-size: 28rpx; }
.s-input { flex: 1; height: 68rpx; font-size: 28rpx; color: $by-text-1; background: transparent; }
.s-clear { padding: 6rpx 12rpx; border-radius: 9999rpx; background: $by-soft-card; color: $by-text-3; font-size: 22rpx; }

.section {
  margin: 20rpx 24rpx; padding: 28rpx;
  border-radius: 20rpx; background: $by-card-bg; border: 1rpx solid $by-border;
  &.city-list-card { padding: 20rpx 28rpx 32rpx; }
}
.section-title {
  display: flex; align-items: baseline; justify-content: space-between;
  font-size: 28rpx; font-weight: 700; color: $by-text-1;
  margin-bottom: 20rpx; letter-spacing: 0.5px;
  &::before { content: ''; display: inline-block; width: 6rpx; height: 24rpx; margin-right: 12rpx; vertical-align: -4rpx; border-radius: 4rpx; background: $by-gradient-gold; }
  .meta-hint { color: $by-text-3; font-size: 22rpx; font-weight: 500; }
}
.meta-row {
  display: flex; justify-content: space-between; margin-bottom: 8rpx;
  color: $by-text-3; font-size: 22rpx;
  .meta-warn { color: #ffa940; }
}
.current-row { display: flex; align-items: center; justify-content: space-between; }
.current-city {
  display: inline-flex; align-items: center; gap: 10rpx;
  padding: 18rpx 26rpx; border-radius: 16rpx;
  background: color.adjust($by-gold, $alpha: 0.1);
  color: $by-gold; font-weight: 700; font-size: 30rpx;
  border: 1rpx solid color.adjust($by-gold, $alpha: 0.3);
}
.city-name { letter-spacing: 1px; }
.locating-dot {
  width: 14rpx; height: 14rpx; border-radius: 50%;
  background: $by-gold; animation: pulse 1s infinite;
}
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
.locate-btn {
  padding: 14rpx 24rpx; border-radius: 12rpx;
  background: $by-soft-card; color: $by-text-2; font-size: 26rpx;
  border: 1rpx solid $by-border;
  &.disabled { opacity: 0.6; }
}
.locate-error {
  margin-top: 18rpx; padding: 14rpx 18rpx;
  border-radius: 12rpx; background: rgba(255,77,79,0.08); color: #ff7a45;
  font-size: 24rpx; line-height: 1.6;
  .err-link { color: $by-gold; text-decoration: underline; }
}

.hot-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18rpx; }
.hot-item {
  padding: 18rpx 0; text-align: center;
  border-radius: 14rpx;
  background: $by-soft-card; color: $by-text-1;
  font-size: 28rpx;
  border: 1rpx solid $by-border;
  transition: all .15s;
  &:active, &.active { transform: scale(0.97); background: color.adjust($by-gold, $alpha: 0.12); color: $by-gold; border-color: color.adjust($by-gold, $alpha: 0.3); }
}

.letter-bar { display: flex; flex-wrap: wrap; gap: 12rpx; }
.letter-chip {
  min-width: 52rpx; padding: 8rpx 14rpx; text-align: center;
  border-radius: 12rpx; background: $by-soft-card; color: $by-text-3;
  font-size: 24rpx; font-weight: 600;
  border: 1rpx solid $by-border;
  &.active { background: $by-gradient-gold; color: #0B0F1A; border-color: transparent; }
}

.group-letter {
  display: flex; align-items: center; gap: 10rpx;
  font-size: 26rpx; font-weight: 800;
  margin: 16rpx 4rpx 10rpx;
  color: $by-gold; letter-spacing: 1px;
  .group-count {
    font-size: 20rpx; font-weight: 500; color: $by-text-3;
    padding: 2rpx 10rpx; border-radius: 8rpx; background: $by-soft-card;
  }
}
.city-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 22rpx 12rpx;
  border-bottom: 1rpx solid $by-border;
  color: $by-text-1; font-size: 28rpx;
  transition: background .15s;
  &:last-child { border-bottom: none; }
  &:active, &.selected { background: $by-soft-card; }
  .city-info { flex: 1; display: flex; flex-direction: column; gap: 4rpx; }
  .city-main { font-weight: 500; }
  .city-sub { font-size: 22rpx; color: $by-text-3; }
  .checked { color: $by-gold; font-weight: 700; }
}
.empty-s { padding: 40rpx 10rpx; display: flex; flex-direction: column; align-items: center; gap: 14rpx; }
.empty-emoji { font-size: 56rpx; }
.empty-text { color: $by-text-3; font-size: 26rpx; }
.bottom-safe { height: calc(40rpx + env(safe-area-inset-bottom)); }

/* ==== 多级菜单（按省）样式 ==== */
.mode-card .mode-switch {
  display: flex; gap: 16rpx; margin-bottom: 20rpx;
  padding: 8rpx; border-radius: 16rpx; background: $by-soft-card;
  border: 1rpx solid $by-border;
}
.mode-chip {
  flex: 1; padding: 16rpx 10rpx; text-align: center;
  border-radius: 12rpx; color: $by-text-2; font-size: 26rpx; font-weight: 600;
  transition: all .15s;
  &.active {
    background: $by-card-bg; color: $by-gold;
    box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.12);
  }
}
.mode-card .mode-actions {
  display: flex; flex-wrap: wrap; align-items: center; gap: 12rpx;
  margin-bottom: 8rpx;
  .action-btn {
    padding: 8rpx 18rpx; border-radius: 9999rpx;
    background: color.adjust($by-gold, $alpha: 0.1);
    color: $by-gold; font-size: 22rpx; font-weight: 600;
    border: 1rpx solid color.adjust($by-gold, $alpha: 0.25);
    &:active { transform: scale(0.97); }
  }
  .mode-sub {
    margin-left: auto; color: $by-text-3; font-size: 22rpx;
  }
}
.province-row {
  border: 1rpx solid $by-border; border-radius: 16rpx;
  margin: 14rpx 0;
  overflow: hidden;
  background: $by-card-bg;
  transition: border-color .15s, box-shadow .15s;
  &.active, &.expanded {
    border-color: color.adjust($by-gold, $alpha: 0.4);
    box-shadow: 0 4rpx 18rpx rgba(255,202,100,0.08);
  }
}
.province-head {
  display: flex; align-items: center; gap: 14rpx;
  padding: 22rpx 24rpx;
  .province-name { flex: 1; font-size: 30rpx; font-weight: 700; color: $by-text-1; }
  .province-meta { font-size: 22rpx; color: $by-text-3; padding: 2rpx 12rpx; border-radius: 9999rpx; background: $by-soft-card; }
  .chev {
    width: 40rpx; height: 40rpx; line-height: 40rpx; text-align: center;
    color: $by-text-3; font-size: 36rpx; font-weight: 700;
    transition: transform .2s;
    transform: rotate(0deg);
    &.open { transform: rotate(90deg); color: $by-gold; }
  }
}
.city-nest {
  padding: 0 18rpx 10rpx 34rpx;
  border-top: 1rpx dashed $by-border;
  background: color.adjust($by-bg-soft, $alpha: 0.3);
  .city-item.nest { padding: 18rpx 10rpx; }
}
@media screen and (max-width: 420px) {
  .hot-grid { grid-template-columns: repeat(3, 1fr); }
}
</style>
