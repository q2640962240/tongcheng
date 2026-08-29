<template>
  <div class="login-page">
    <div class="login-box">
      <div class="brand">
        <div class="logo">伴</div>
        <h1>白夜管理后台</h1>
      </div>
      <el-form :model="form" class="form" @submit.prevent="onLogin">
        <el-form-item>
          <el-input
            v-model="form.username"
            placeholder="管理员账号"
            size="large"
            prefix-icon="User"
          />
        </el-form-item>
        <el-form-item>
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            size="large"
            prefix-icon="Lock"
            show-password
            @keyup.enter="onLogin"
          />
        </el-form-item>
        <el-button
          type="primary"
          size="large"
          class="btn-login"
          :loading="loading"
          @click="onLogin"
        >登 录</el-button>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { login } from '../../api'

const router = useRouter()
const loading = ref(false)
const form = ref({ username: 'admin', password: 'admin123' })

const onLogin = async () => {
  if (!form.value.username || !form.value.password) {
    ElMessage.warning('请输入账号和密码')
    return
  }
  loading.value = true
  try {
    const res = await login(form.value)
    localStorage.setItem('admin_token', res.data.token)
    localStorage.setItem('admin_info', JSON.stringify(res.data.admin))
    ElMessage.success('登录成功')
    router.push('/dashboard')
  } catch (e) {
    // 错误已由 http 拦截器统一提示
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.login-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ffd60a 0%, #ffcc00 50%, #171717 100%);
}
.login-box {
  width: 400px;
  background: #fff;
  border-radius: 16px;
  padding: 48px 40px;
  box-shadow: 0 24px 60px -20px rgba(0,0,0,0.3);
}
.brand {
  text-align: center;
  margin-bottom: 32px;
}
.logo {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: #ffd60a;
  color: #171717;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 16px;
}
h1 { font-size: 24px; margin: 0; }
.form { margin-top: 24px; }
.btn-login {
  width: 100%;
  background: #ffd60a;
  border-color: #ffd60a;
  color: #171717;
  font-weight: 700;
  font-size: 16px;
  &:hover { background: #ffcc00; border-color: #ffcc00; }
}
</style>
