import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getConfigModules, updateConfigModule, testConfigModule, resetConfigModule } from '../api'

export const useConfigStore = defineStore('config', () => {
  const modules = ref([])
  const loading = ref(false)
  const saving = ref(false)

  const loadModules = async () => {
    loading.value = true
    try {
      const res = await getConfigModules()
      modules.value = res.data || []
    } catch (e) {} finally {
      loading.value = false
    }
  }

  const saveModule = async (name, values) => {
    saving.value = true
    try {
      await updateConfigModule(name, values)
      // 保存后刷新当前模块的展示值（敏感字段打码）
      const res = await getConfigModules()
      modules.value = res.data || []
      return true
    } catch (e) {
      return false
    } finally {
      saving.value = false
    }
  }

  const testModule = async (name, values) => {
    try {
      const res = await testConfigModule(name, values || null)
      return res.data ? { success: true, ...res.data, message: res.message } : { success: false, message: res.message || '测试失败' }
    } catch (e) {
      return { success: false, message: (e && e.message) ? e.message : '测试失败' }
    }
  }

  const resetModule = async (name) => {
    try {
      await resetConfigModule(name)
      await loadModules()
      return true
    } catch (e) {
      return false
    }
  }

  return { modules, loading, saving, loadModules, saveModule, testModule, resetModule }
})
