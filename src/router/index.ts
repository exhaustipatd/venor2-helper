import { createRouter, createWebHashHistory } from 'vue-router'
import DashboardView from '@/views/DashboardView.vue'

export const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardView },
    { path: '/boltok', name: 'shops', component: () => import('@/views/ShopsView.vue') },
    { path: '/osszehasonlitas', name: 'compare', component: () => import('@/views/CompareView.vue') },
    { path: '/kisallatok', name: 'pets', component: () => import('@/views/PetsView.vue') },
    { path: '/arlista', name: 'prices', component: () => import('@/views/PricesView.vue') },
    { path: '/beallitasok', name: 'settings', component: () => import('@/views/SettingsView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
