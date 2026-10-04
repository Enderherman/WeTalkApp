import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: '默认路径',
      redirect: '/login'
    },
    {
      path: '/showMedia',
      name: '媒体信息',
      component: () => import('@/views/show/ShowMedia.vue')
    },
    {
      path: '/admin',
      name: '管理后台',
      redirect: '/admin/userList',
      component: () => import('@/views/admin/Admin.vue'),
      children: [
        {
          path: '/admin/userList',
          name: '用户管理',
          component: () => import('@/views/admin/UserList.vue')
        },
        {
          path: '/admin/beautyAccount',
          name: '靓号管理',
          component: () => import('@/views/admin/BeautyAccount.vue')
        },
        {
          path: '/admin/groupList',
          name: '群组管理',
          component: () => import('@/views/admin/GroupList.vue')
        },
        {
          path: '/admin/SysSetting',
          name: '系统设置',
          component: () => import('@/views/admin/SysSetting.vue')
        },
        {
          path: '/admin/update',
          name: '版本管理',
          component: () => import('@/views/admin/Update.vue')
        }
      ]
    },
    {
      path: '/login',
      name: '登录',
      component: () => import('@/views/Login.vue')
    },
    {
      path: '/main',
      redirect: '/chat',
      name: '主界面',
      component: () => import('@/views/Main.vue'),
      children: [
        {
          path: '/chat',
          name: '聊天',
          component: () => import('@/views/chat/Chat.vue')
        },
        {
          path: '/contact',
          name: '联系人',
          redirect: '/contact/blank',
          component: () => import('@/views/contact/Contact.vue'),
          children: [
            {
              path: '/contact/blank',
              name: '联系人空白页',
              component: () => import('@/views/contact/BlankPage.vue')
            },
            {
              path: '/contact/createGroup',
              name: '新建群聊',
              component: () => import('@/views/contact/GroupEdit.vue')
            },
            {
              path: '/contact/search',
              name: '搜索好友',
              component: () => import('@/views/contact/Search.vue')
            },
            {
              path: '/contact/contactNotice',
              name: '新的朋友',
              component: () => import('@/views/contact/ContactApply.vue')
            },
            {
              path: '/contact/userDetail',
              name: '联系人详情',
              component: () => import('@/views/contact/UserDetail.vue')
            },
            {
              path: '/contact/groupDetail',
              name: '群组详情',
              component: () => import('@/views/contact/GroupDetail.vue')
            }
          ]
        },
        {
          path: '/setting',
          name: '设置',
          component: () => import('@/views/setting/Setting.vue'),
          children: [
            {
              path: '/setting/userInfo',
              name: '用户详情',
              component: () => import('@/views/setting/UserInfo.vue')
            },
            {
              path: '/setting/about',
              name: '关于',
              component: () => import('@/views/setting/About.vue')
            },
            {
              path: '/setting/devices',
              name: '登录设备',
              component: () => import('@/views/setting/DeviceSessions.vue')
            },
            {
              path: '/setting/fileManage',
              name: '文件管理',
              component: () => import('@/views/setting/FileManage.vue')
            }
          ]
        }
      ]
    }
  ]
})
export default router
