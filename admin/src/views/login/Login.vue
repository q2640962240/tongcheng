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
// 不预填任何凭据：预填会让生产管理员口令出现在页面上并被打进构建产物
const form = ref({ username: '', password: '' })

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
  background:
    radial-gradient(900px 500px at 20% 10%, rgba(212,175,55,.20), transparent 55%),
    radial-gradient(800px 500px at 90% 90%, rgba(123,97,255,.22), transparent 60%),
    #0B0F1A;
}
.login-box {
  width: 400px;
  background: linear-gradient(180deg, rgba(26,34,56,.96) 0%, rgba(20,26,45,.96) 100%);
  border: 1px solid var(--by-border-2, rgba(255,255,255,.16));
  border-radius: 16px;
  padding: 48px 40px;
  box-shadow: 0 24px 60px -20px rgba(0,0,0,.6);
}
.brand {
  text-align: center;
  margin-bottom: 32px;
}
.logo {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: linear-gradient(135deg, #F7E7B2 0%, #D4AF37 55%, #B8941F 100%);
  color: #0B0F1A;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 16px;
  box-shadow: 0 8px 24px rgba(212,175,55,.30);
}
h1 {
  font-size: 24px;
  margin: 0;
  color: #F5F7FF;
  letter-spacing: 0.02em;
}
.form { margin-top: 24px; }
.btn-login {
  width: 100%;
  background: linear-gradient(135deg, #F7E7B2 0%, #D4AF37 55%, #B8941F 100%);
  border: none;
  color: #0B0F1A;
  font-weight: 700;
  font-size: 16px;
  box-shadow: 0 6px 20px rgba(212,175,55,.25);
  &:hover { filter: brightness(1.05); }
}
</style>
