import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './style.css'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: () => import('./views/HomeView.vue') },
    { path: '/project/:id', component: () => import('./views/EditorView.vue'), props: true },
  ],
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
