<template>
  <ContentPanel>
    <div class="show-info" v-if="showType === 0">
      <div class="user-info">
        <UserBaseInfo :user-info="userInfo"></UserBaseInfo>
        <div class="more-op">
          <el-dropdown placement="bottom-end" trigger="click">
            <span class="el-dropdown-link">
              <span class="iconfont icon-more"></span>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="changePart(1)">修改个人信息</el-dropdown-item>
                <el-dropdown-item @click="changePart(2)">修改密码</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
      <div class="part-item">
        <div class="part-title">添加权限</div>
        <div class="part-content">
          {{ userInfo.joinType === 0 ? '无需同意直接添加' : '添加联系人时需要验证' }}
        </div>
      </div>
      <div class="part-item">
        <div class="part-title">个性签名</div>
        <div class="part-content">{{ userInfo.personalSignature || '-' }}</div>
      </div>
      <div class="logout">
        <el-button @click="logout">退出登录</el-button>
      </div>
    </div>
    <div v-if="showType === 1">
      <UserInfoEdit :data="userInfo" @edit-back="editBack"></UserInfoEdit>
    </div>
    <div v-if="showType === 2">
      <UserInfoUpdatePwd @edit-back="editBack"></UserInfoUpdatePwd>
    </div>
  </ContentPanel>
</template>

<script setup>
import Api from '@/utils/Api'
import Request from '@/utils/Request'
import { onMounted, ref } from 'vue'
import UserInfoEdit from '@/views/setting/UserInfoEdit.vue'
import UserInfoUpdatePwd from '@/views/setting/UserInfoUpdatePwd.vue'
import Confirm from '@/utils/Confirm'

//获取用户信息
const userInfo = ref({})
const getUserInfo = async () => {
  let result = await Request({
    url: Api.getUserInfo
  })
  if (!result) {
    return
  }
  userInfo.value = result.data
}

//修改信息
const showType = ref(0)
const changePart = (part) => {
  showType.value = part
}

//退出登录
const logout = () => {
  Confirm({
    message: '确定要退出登录吗',
    showCancelBtn: true,
    okfun: async () => {
      await Request({
        url: Api.logout
      })
      window.ipcRenderer.send('reLogin')
    }
  })
}

//回调刷新值
const editBack = () => {
  showType.value = 0
  getUserInfo()
}

onMounted(() => getUserInfo())
</script>

<style scoped lang="less">
.show-info {
  .user-info {
    position: relative;

    .more-op {
      position: absolute;
      right: 0;
      top: 20px;

      .icon-more {
        color: #9e9e9e;

        &:hover {
          background: #dddddd;
        }
      }
    }
  }

  .part-item {
    display: flex;
    border-top: 1px solid #eaeaea;
    border-bottom: 1px solid #eaeaea;
    padding: 20px 0;

    .part-title {
      width: 60px;
      color: #9e9e9e;
    }

    .part-content {
      flex: 1;
      margin-left: 15px;
      color: #161616;
    }
  }

  .logout {
    text-align: center;
    margin-top: 20px;
  }
}
</style>
