<template>
  <Layout>
    <template #left-content>
      <div class="title-panel drag">设置</div>
      <div class="menu-list">
        <div
          v-for="item in settingMenuList"
          :class="['menu-item', route.path === item.path ? 'menu-active' : '']"
          @click="jump(item)"
        >
          <div :class="['iconfont', item.icon]" :style="{ background: item.bgColor }"></div>
          <div class="menu-name">{{ item.name }}</div>
        </div>
      </div>
    </template>
    <template #right-content>
      <div class="title-panel drag"></div>
      <router-view v-slot="{ Component }">
        <component :is="Component" ref="componentRef" />
      </router-view>
    </template>
  </Layout>
</template>
<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const router = useRouter()
const route = useRoute()

const settingMenuList = ref([
  {
    name: '账号设置',
    icon: 'icon-user-setting',
    path: '/setting/userInfo',
    bgColor: '#0294f5'
  },
  {
    name: '文件管理',
    icon: 'icon-folder1',
    path: '/setting/fileManage',
    bgColor: '#ffd04f'
  },
  {
    name: '登录设备',
    icon: 'icon-user-setting',
    path: '/setting/devices',
    bgColor: '#0294f5'
  },
  {
    name: '关于WeTalk',
    icon: 'icon-about',
    path: '/setting/about',
    bgColor: '#08bf61'
  }
])

//页面跳转
const jump = (item) => {
  router.push(item.path)
}
</script>

<style lang="less" scoped>
.title-panel {
  height: 60px;
  background: #f7f7f7;
  text-align: center;
  font-size: 16px;
  line-height: 60px;
}

.menu-list {
  border-top: 1px solid #ddd;

  .menu-item {
    display: flex;
    align-items: center;
    padding: 10px;

    &:hover {
      cursor: pointer;
      background: #d6d6d7;
    }

    .iconfont {
      font-size: 20px;
      width: 35px;
      height: 35px;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .menu-name {
      color: #000000;
      margin-left: 10px;
      flex: 1;
    }
  }

  .menu-active {
    background: #c4c4c4;

    &:hover {
      background: #c4c4c4;
    }
  }
}
</style>
