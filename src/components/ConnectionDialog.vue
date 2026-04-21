<template>
  <el-dialog
    v-model="visible"
    :title="form.id ? '编辑连接' : '新建连接'"
    width="520px"
    align-center
    destroy-on-close
  >
    <el-form :model="form" label-width="90px" size="default">
      <el-form-item label="连接名">
        <el-input v-model="form.name" placeholder="生产环境 / 测试库" />
      </el-form-item>
      <el-form-item label="主机">
        <el-input v-model="form.host" placeholder="例如 127.0.0.1" />
      </el-form-item>
      <el-form-item label="端口">
        <el-input-number v-model="form.port" :min="1" :max="65535" class="w-full" />
      </el-form-item>
      <el-form-item label="用户名">
        <el-input v-model="form.user" />
      </el-form-item>
      <el-form-item label="密码">
        <el-input v-model="form.password" type="password" show-password />
      </el-form-item>
      <el-form-item label="默认库">
        <el-input v-model="form.database" placeholder="可选" />
      </el-form-item>
      <el-form-item label="使用 HTTPS">
        <el-switch v-model="form.useHttps" />
      </el-form-item>
      <el-form-item label="Token">
        <el-input v-model="form.token" placeholder="使用云服务或 Token 鉴权时填写" />
      </el-form-item>
      <el-form-item label="标签颜色">
        <el-color-picker v-model="form.color" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button :loading="testing" @click="test">测试连接</el-button>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useConnStore } from '@/stores/connections'
import type { ConnectionProfile } from '@/types'

const props = defineProps<{ modelValue: boolean; profile: Partial<ConnectionProfile> | null }>()
const emit = defineEmits(['update:modelValue'])

const connStore = useConnStore()
const testing = ref(false)
const saving = ref(false)

const visible = ref(false)
watch(() => props.modelValue, (v) => (visible.value = v))
watch(visible, (v) => emit('update:modelValue', v))

const form = ref<Partial<ConnectionProfile>>(defaults())
function defaults(): Partial<ConnectionProfile> {
  return {
    name: 'localhost',
    host: 'localhost',
    port: 6041,
    user: 'root',
    password: 'taosdata',
    database: '',
    token: '',
    useHttps: false,
    color: '#409eff'
  }
}

watch(
  () => props.profile,
  (p) => { form.value = p ? { ...p } : defaults() },
  { immediate: true }
)

const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v))

async function test() {
  if (!window.tdApi) return ElMessage.error('preload 未加载')
  testing.value = true
  try {
    const res = await window.tdApi.testConnection(plain(form.value) as any)
    if (res.ok) ElMessage.success(`连接成功，耗时 ${res.elapsedMs}ms`)
    else ElMessage.error(res.error || '连接失败')
  } catch (e: any) {
    ElMessage.error(e?.message || String(e))
  } finally { testing.value = false }
}

async function save() {
  if (!window.tdApi) return ElMessage.error('preload 未加载')
  saving.value = true
  try {
    await connStore.save(plain(form.value))
    ElMessage.success('已保存')
    visible.value = false
  } catch (e: any) {
    ElMessage.error(e?.message || String(e))
  } finally { saving.value = false }
}
</script>

<style scoped>
.w-full { width: 100%; }
</style>
