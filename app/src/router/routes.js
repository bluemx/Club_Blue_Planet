const routes = [
  // Out-of-app screens (no nav chrome)
  { path: '/login', component: () => import('@/pages/LoginPage.vue') },
  { path: '/registro', component: () => import('@/pages/RegisterPage.vue') },
  { path: '/recuperar', component: () => import('@/pages/ForgotPasswordPage.vue') },
  { path: '/cuenta-infantil', component: () => import('@/pages/KidCodePage.vue') },

  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('@/pages/IndexPage.vue') },
      { path: 'misiones', component: () => import('@/pages/MisionesPage.vue') },
      { path: 'nueva', component: () => import('@/pages/NuevaPage.vue') },
      { path: 'recompensas', component: () => import('@/pages/RecompensasPage.vue') },
      { path: 'estadisticas', component: () => import('@/pages/EstadisticasPage.vue') },
      { path: 'hijos', component: () => import('@/pages/HijosPage.vue') },
      { path: 'tutores', component: () => import('@/pages/TutoresPage.vue') },
      { path: 'pendientes', component: () => import('@/pages/PendientesPage.vue') },
      { path: 'perfil', component: () => import('@/pages/PerfilPage.vue') },
      { path: 'perfil/codigo-infantil', component: () => import('@/pages/CodigoInfantilPage.vue') },

      // Kid area — same shell, shorter nav (see MainLayout)
      { path: 'kid', component: () => import('@/pages/kid/KidHomePage.vue') },
      { path: 'kid/misiones', component: () => import('@/pages/kid/KidMisionesPage.vue') },
      { path: 'kid/nueva', component: () => import('@/pages/kid/KidNuevaPage.vue') },
      { path: 'kid/recompensas', component: () => import('@/pages/kid/KidRecompensasPage.vue') },
      { path: 'kid/perfil', component: () => import('@/pages/kid/KidInsigniasPage.vue') },
      { path: 'kid/avatar', component: () => import('@/pages/kid/KidAvatarPage.vue') },
    ],
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('@/pages/ErrorNotFound.vue'),
  }
]

export default routes
