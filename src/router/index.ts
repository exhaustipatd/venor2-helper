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
  scrollBehavior: (to, from) => {
    // Turning a pet card over must keep the gallery at the same scroll position.
    if (
      to.name === 'pets' &&
      from.name === 'pets' &&
      Object.keys({ ...to.query, ...from.query })
        .filter((key) => key !== 'pet')
        .every((key) => JSON.stringify(to.query[key]) === JSON.stringify(from.query[key]))
    )
      return false
    return { top: 0 }
  },
})
