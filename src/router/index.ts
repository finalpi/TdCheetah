import { createRouter, createWebHashHistory } from 'vue-router'
import Layout from '@/views/Layout.vue'

export default createRouter({
  history: createWebHashHistory(),
  routes: [{ path: '/', component: Layout }]
})
