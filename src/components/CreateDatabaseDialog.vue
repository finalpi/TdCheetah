<template>
  <el-dialog v-model="visible" title="新建数据库" width="600px" align-center>
    <el-form :model="form" label-width="120px">
      <el-form-item label="数据库名">
        <el-input v-model="form.name" placeholder="只能包含字母、数字、下划线" />
      </el-form-item>
      <el-form-item label="时间精度">
        <el-radio-group v-model="form.precision">
          <el-radio-button value="ms">毫秒 ms</el-radio-button>
          <el-radio-button value="us">微秒 us</el-radio-button>
          <el-radio-button value="ns">纳秒 ns</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="副本数">
        <el-input-number v-model="form.replica" :min="1" :max="3" />
      </el-form-item>
      <el-form-item label="VGroups">
        <el-input-number v-model="form.vgroups" :min="1" :max="4096" />
      </el-form-item>
      <el-form-item label="保留时长 KEEP">
        <el-input v-model="form.keep" placeholder="例如 3650 或 1440,1440,3650 (分钟)" />
      </el-form-item>
      <el-form-item label="数据时长 DURATION">
        <el-input v-model="form.duration" placeholder="例如 10d / 1440" />
      </el-form-item>
      <el-form-item label="缓存模式">
        <el-select v-model="form.cachemodel" class="w-full">
          <el-option label="none" value="none" />
          <el-option label="last_row" value="last_row" />
          <el-option label="last_value" value="last_value" />
          <el-option label="both" value="both" />
        </el-select>
      </el-form-item>
      <el-form-item label="SQL 预览">
        <el-input v-model="sql" type="textarea" :rows="4" readonly />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="loading" @click="submit">创建</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useConnStore } from '@/stores/connections'

const props = defineProps<{ modelValue: boolean; connId: string }>()
const emit = defineEmits(['update:modelValue'])

const connStore = useConnStore()
const loading = ref(false)
const visible = ref(false)
watch(() => props.modelValue, (v) => (visible.value = v))
watch(visible, (v) => emit('update:modelValue', v))

const form = ref({
  name: 'test',
  precision: 'ms',
  replica: 1,
  vgroups: 2,
  keep: '',
  duration: '',
  cachemodel: 'none'
})

watch(visible, (v) => {
  if (v) form.value = { name: '', precision: 'ms', replica: 1, vgroups: 2, keep: '', duration: '', cachemodel: 'none' }
})

const sql = computed(() => {
  const parts = [`CREATE DATABASE IF NOT EXISTS \`${form.value.name || 'db'}\``]
  parts.push(`PRECISION '${form.value.precision}'`)
  parts.push(`REPLICA ${form.value.replica}`)
  parts.push(`VGROUPS ${form.value.vgroups}`)
  if (form.value.keep) parts.push(`KEEP ${form.value.keep}`)
  if (form.value.duration) parts.push(`DURATION ${form.value.duration}`)
  if (form.value.cachemodel !== 'none') parts.push(`CACHEMODEL '${form.value.cachemodel}'`)
  return parts.join(' ') + ';'
})

async function submit() {
  if (!form.value.name) return ElMessage.warning('请输入数据库名')
  loading.value = true
  try {
    const conn = connStore.rawById(props.connId)!
    const res = await window.tdApi.query({ conn, sql: sql.value })
    if (!res.ok) throw new Error(res.error)
    ElMessage.success('创建成功')
    await connStore.connect(props.connId)
    connStore.refreshTree(`c:${props.connId}`)
    visible.value = false
  } catch (e: any) {
    ElMessage.error(e.message)
  } finally { loading.value = false }
}
</script>

<style scoped>.w-full { width: 100%; }</style>
