<template>
  <div class="settings">
    <div class="page-card">
      <div class="header-row">
        <div>
          <div class="card-title">
            <el-icon :size="22" color="#D4AF37"><Setting /></el-icon>
            <span>配置中心</span>
          </div>
          <div class="card-desc">
            所有第三方服务密钥在此配置；修改后
            <el-tag type="warning" effect="dark" round size="small" style="margin: 0 6px;">无需重启服务</el-tag>
            即可生效。<br />
            建议按顺序：<strong>应用基础 → 短信 → 微信支付/支付宝 → OSS → 推送</strong>
          </div>
        </div>
        <el-button :loading="store.loading" @click="store.loadModules()">
          <el-icon style="margin-right: 4px;"><Refresh /></el-icon>刷新
        </el-button>
      </div>

      <!-- 6 个模块卡片入口（一眼看清状态） -->
      <div class="module-cards">
        <div
          v-for="m in store.modules"
          :key="m.name"
          class="mod-card"
          :class="{ active: activeModule === m.name }"
          :style="{ borderLeftColor: m.color }"
          @click="activeModule = m.name"
        >
          <div class="mod-icon" :style="{ background: m.color + '18', color: m.color }">
            <el-icon :size="20">
              <component :is="resolveIcon(m.icon)" />
            </el-icon>
          </div>
          <div class="mod-body">
            <div class="mod-title">{{ m.label }}</div>
            <el-tag
              size="small"
              round
              effect="dark"
              :type="moduleStatus(m).type"
              class="mod-status"
            >{{ moduleStatus(m).label }}</el-tag>
          </div>
          <div class="mod-count" :style="{ color: m.color }">{{ filledCount(m) }}/{{ m.fields.length }}</div>
        </div>
      </div>

      <el-tabs v-model="activeModule" v-loading="store.loading" class="config-tabs">
        <el-tab-pane
          v-for="m in store.modules"
          :key="m.name"
          :label="m.label"
          :name="m.name"
        >
          <!-- 模块介绍条 -->
          <div class="module-intro" :style="{ borderLeftColor: m.color, background: m.color + '0A' }">
            <div class="intro-left">
              <el-icon :size="20" :color="m.color"><InfoFilled /></el-icon>
              <span>{{ m.description }}</span>
            </div>
            <el-tag
              round
              effect="dark"
              :type="moduleStatus(m).type"
            >
              状态：{{ moduleStatus(m).label }}
            </el-tag>
          </div>

          <el-form
            :model="forms[m.name] || {}"
            label-width="260px"
            class="config-form"
            label-position="right"
          >
            <el-form-item
              v-for="f in m.fields"
              :key="f.key"
              :label="f.label"
              :required="f.required"
              class="config-row"
            >
              <template #label>
                <div class="field-label-box" :style="{ '--mod-color': m.color }">
                  <span class="label-bar"></span>
                  <span class="label-text">{{ f.label }}</span>
                  <span v-if="f.required" class="req-star">*</span>
                  <span v-else class="opt-tag">选填</span>
                </div>
              </template>

              <label class="key-name">
                <span class="key-dot" :style="{ background: m.color }"></span>
                <code>{{ f.key }}</code>
              </label>

              <div class="val-col">
                <!-- boolean 开关 -->
                <el-switch
                  v-if="f.type === 'boolean'"
                  v-model="forms[m.name][f.key]"
                  inline-prompt
                  active-text="开"
                  inactive-text="关"
                  :active-value="true"
                  :inactive-value="false"
                />

                <!-- select 下拉 -->
                <el-select
                  v-else-if="f.type === 'select'"
                  v-model="forms[m.name][f.key]"
                  style="width: 100%; max-width: 480px;"
                  placeholder="请选择"
                  clearable
                >
                  <el-option
                    v-for="opt in f.options || []"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                  />
                </el-select>

                <!-- secret 密钥 -->
                <el-input
                  v-else-if="f.type === 'secret'"
                  v-model="forms[m.name][f.key]"
                  type="password"
                  show-password
                  :placeholder="m.values?.[f.key] ? ('已填:' + m.values[f.key]) : (f.placeholder || '请输入')"
                  style="max-width: 560px;"
                  size="default"
                  class="secret-input"
                />

                <!-- number -->
                <el-input-number
                  v-else-if="f.type === 'number'"
                  v-model="forms[m.name][f.key]"
                  :min="0"
                  :step="1"
                  style="max-width: 280px;"
                />

                <!-- 普通 string -->
                <el-input
                  v-else
                  v-model="forms[m.name][f.key]"
                  :placeholder="f.placeholder || '请输入'"
                  style="max-width: 560px;"
                  clearable
                />

                <div class="field-desc" v-if="f.description">
                  <el-icon color="#7B61FF"><Promotion /></el-icon>
                  {{ f.description }}
                </div>

                <div class="field-cur" v-if="m.values?.[f.key] && f.type !== 'boolean'">
                  <el-tag type="success" effect="plain" size="small" round>
                    当前：{{ typeof m.values[f.key] === 'string' && m.values[f.key].length > 80
                      ? m.values[f.key].slice(0, 80) + '…'
                      : m.values[f.key] }}
                  </el-tag>
                </div>
              </div>
            </el-form-item>
          </el-form>

          <div class="actions">
            <el-button
              type="primary"
              :loading="store.saving"
              size="large"
              @click="onSave(m.name)"
            >
              <el-icon style="margin-right: 4px;"><Check /></el-icon>
              保存 {{ m.label }}
            </el-button>
            <el-button
              :loading="testing[m.name]"
              size="large"
              type="success"
              @click="onTest(m.name)"
            >
              <el-icon style="margin-right: 4px;"><Connection /></el-icon>
              测试连通性
            </el-button>
            <el-button type="danger" plain size="large" @click="onReset(m.name)">
              <el-icon style="margin-right: 4px;"><RefreshRight /></el-icon>
              重置默认
            </el-button>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Setting, Refresh, InfoFilled, Promotion, Check, Connection, RefreshRight,
  Goods, Wallet, Bell, Picture, Message
} from '@element-plus/icons-vue'
import { useConfigStore } from '../../store/config'

const ICON_MAP = {
  Setting, Goods, Wallet, Bell, Picture, Message
}
const resolveIcon = (n) => ICON_MAP[n] || Setting

const store = useConfigStore()
const activeModule = ref('app')
const forms = reactive({})
const testing = reactive({})

watch(() => store.modules, (list) => {
  for (const m of list) {
    if (!forms[m.name]) forms[m.name] = {}
    for (const f of m.fields) {
      const cur = m.values?.[f.key]
      if (f.type === 'secret' && typeof cur === 'string' && cur.includes('****')) {
        forms[m.name][f.key] = ''
      } else if (f.type === 'boolean') {
        forms[m.name][f.key] = cur === true || cur === 'true'
      } else if (cur !== undefined && cur !== null) {
        forms[m.name][f.key] = f.type === 'number' ? Number(cur) : cur
      } else {
        forms[m.name][f.key] = f.type === 'boolean' ? false : (f.type === 'number' ? 0 : '')
      }
    }
  }
}, { immediate: true })

function filledCount (m) {
  const enabledKey = m.fields.find(f => f.key === 'enabled')
  if (enabledKey) {
    const on = (m.values?.enabled === true) || (String(m.values?.enabled) === 'true')
    if (!on) {
      // 关闭的模块：只要求 enabled 关闭 + provider/本地默认值合理即可，状态条按“零配置项缺失”展示
      return 0
    }
  }
  let c = 0
  for (const f of m.fields) {
    if (f.key === 'enabled') continue
    const v = m.values?.[f.key]
    if (v !== undefined && v !== null && String(v).trim() !== '') c++
  }
  return c
}

function moduleStatus (m) {
  const hasEnabled = m.fields.some(f => f.key === 'enabled')
  const on = !hasEnabled || (m.values?.enabled === true || String(m.values?.enabled) === 'true')
  if (!on) return { label: '未启用', type: 'info' }
  const total = m.fields.length - (hasEnabled ? 1 : 0)
  const done = filledCount(m)
  if (done === 0) return { label: '未配置', type: 'danger' }
  if (done < total) return { label: `配置中 ${done}/${total}`, type: 'warning' }
  return { label: '已就绪', type: 'success' }
}

const onSave = async (name) => {
  const values = { ...(forms[name] || {}) }
  // 对 boolean / number 做字符串化（存储层全部以 string 保存）
  for (const k in values) {
    if (typeof values[k] === 'boolean') {
      values[k] = values[k] ? 'true' : 'false'
    } else if (typeof values[k] === 'number' && !Number.isNaN(values[k])) {
      values[k] = String(values[k])
    }
  }
  const ok = await store.saveModule(name, values)
  if (ok) ElMessage.success('配置已保存，1 分钟内生效（如需立即生效可点击刷新按钮）')
}

const onTest = async (name) => {
  testing[name] = true
  const draft = forms[name] ? { ...forms[name] } : null
  // 如果草稿为空字段，合并后台已保存的值（避免空表单误杀已正确保存的项目）
  const module = store.modules.find(x => x.name === name)
  const merged = (module && module.values) ? { ...module.values, ...(draft || {}) } : (draft || {})
  const result = await store.testModule(name, merged)
  testing[name] = false
  if (result?.success) ElMessage.success(result.message || '测试通过')
  else ElMessage.error(result?.message || '测试失败')
}

const onReset = async (name) => {
  const meta = store.modules.find(x => x.name === name)?.label || name
  try {
    await ElMessageBox.confirm(
      `确认重置「${meta}」到默认模板？所有已填写的密钥/域名都会被恢复为空。`,
      '重置确认',
      { type: 'warning', confirmButtonText: '确认重置', cancelButtonText: '取消' }
    )
    const ok = await store.resetModule(name)
    if (ok) ElMessage.success('已重置为默认模板')
  } catch (_) {}
}

onMounted(() => store.loadModules())
</script>

<style lang="scss" scoped>
.settings { padding: 16px 24px 32px; }

.page-card {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 12px;
  padding: 24px 28px 28px;
  box-shadow: 0 4px 24px rgba(15, 23, 42, 0.04);
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
}
.card-title {
  display: flex; align-items: center; gap: 10px;
  font-size: 20px; font-weight: 700; color: #0B0F1A;
  letter-spacing: 0.5px;
}
.card-desc {
  font-size: 13px; color: #475569; margin-top: 8px; line-height: 1.8;
  background: #FFF7ED;
  padding: 8px 12px;
  border-radius: 8px;
  border-left: 3px solid #D4AF37;
  max-width: 720px;
}
.card-desc strong { color: #D4AF37; }

/* ---- 6 模块入口状态卡片 ---- */
.module-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}
.mod-card {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid #E5E7EB;
  border-left: 5px solid #64748B;
  background: #F8FAFC;
  cursor: pointer;
  transition: all .15s ease;
}
.mod-card:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(11, 15, 26, .08); }
.mod-card.active {
  background: #FFFFFF;
  border-color: #D4AF37;
  border-width: 1px;
  border-left-width: 5px;
  box-shadow: 0 4px 16px rgba(212, 175, 55, .18);
}
.mod-icon {
  width: 42px; height: 42px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.mod-body { flex: 1; min-width: 0; }
.mod-title { font-size: 15px; font-weight: 700; color: #0F172A; margin-bottom: 4px; }
.mod-status { font-size: 11px; font-weight: 600; }
.mod-count {
  font-weight: 800;
  font-size: 16px;
  font-family: 'SF Mono', 'Consolas', monospace;
}

/* ---- tabs & 模块介绍条 ---- */
.config-tabs :deep(.el-tabs__item) {
  font-size: 15px;
  font-weight: 600;
  color: #475569;
  padding-left: 18px;
  padding-right: 18px;
}
.config-tabs :deep(.el-tabs__item.is-active) {
  color: #D4AF37;
}
.config-tabs :deep(.el-tabs__active-bar) {
  background: #D4AF37;
  height: 3px;
  border-radius: 2px;
}

.module-intro {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px;
  border-left: 4px solid #D4AF37;
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 13px;
  color: #334155;
  background: #FFFBEB;
  line-height: 1.6;
}
.intro-left { display: flex; align-items: center; gap: 8px; max-width: 80%; }

/* ---- 表单（白夜配色 · 高对比）---- */
.config-form { max-width: 1080px; }
.config-row {
  display: flex;
  align-items: flex-start;
  padding: 18px 0;
  border-bottom: 1px dashed #E2E8F0;
  margin-bottom: 0 !important;
}
.config-row:last-of-type { border-bottom: none; }
.config-row :deep(.el-form-item__label) {
  padding-right: 16px;
  line-height: 1.2;
  font-weight: 800 !important;
  font-size: 15px !important;
  color: #0B0F1A !important;
  text-align: right !important;
}
.config-row :deep(.el-form-item__content) {
  line-height: 1.5;
}

/* 配置名标签盒子：左侧色条 + 加粗文字 + 必填红星/选填标签 */
.field-label-box {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px 6px 0;
  border-radius: 6px;
  min-width: 100%;
  justify-content: flex-end;
}
.label-bar {
  display: inline-block;
  width: 4px;
  height: 18px;
  border-radius: 2px;
  background: var(--mod-color, #D4AF37);
  flex-shrink: 0;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--mod-color, #D4AF37) 18%, transparent);
}
.label-text {
  font-size: 15px;
  font-weight: 800;
  color: #0B0F1A;
  letter-spacing: 0.3px;
  line-height: 1.4;
}
.req-star {
  color: #EF4444;
  font-weight: 900;
  font-size: 18px;
  margin-left: 2px;
  line-height: 1;
  text-shadow: 0 0 6px rgba(239,68,68,.35);
}
.opt-tag {
  display: inline-block;
  padding: 1px 7px;
  font-size: 11px;
  font-weight: 600;
  color: #64748B;
  background: #F1F5F9;
  border: 1px solid #E2E8F0;
  border-radius: 999px;
  line-height: 1.4;
  margin-left: 4px;
}

.key-name {
  display: inline-flex; align-items: center; gap: 6px;
  margin-top: 2px;
  margin-bottom: 6px;
}
.key-dot {
  width: 8px; height: 8px; border-radius: 50%;
  display: inline-block;
}
.key-name code {
  background: #0F172A;
  color: #FDE68A;
  padding: 3px 9px;
  border-radius: 5px;
  font-size: 12px;
  font-family: 'SF Mono', Consolas, Menlo, monospace;
  letter-spacing: 0.2px;
  box-shadow: 0 2px 6px rgba(15,23,42,.2);
}

.val-col { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.secret-input :deep(.el-input__wrapper) {
  background: #FFFBEB;
  box-shadow: 0 0 0 1px #FDE68A inset;
}
.field-desc {
  font-size: 12px;
  color: #475569;
  display: flex;
  align-items: center;
  gap: 6px;
  background: #F5F3FF;
  padding: 6px 10px;
  border-radius: 6px;
  width: fit-content;
  max-width: 620px;
  line-height: 1.6;
}
.field-cur {
  font-size: 12px;
  width: fit-content;
}

.actions {
  margin-top: 22px;
  padding-top: 16px;
  border-top: 2px solid #E2E8F0;
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}
</style>
