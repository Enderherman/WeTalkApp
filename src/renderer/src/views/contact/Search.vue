<template>
  <ContentPanel>
    <div class="search-form">
      <el-input
        v-model="contactId"
        clearable
        placeholder="邮箱、用户昵称、群昵称或 U/G 编号"
        size="large"
        @keydown.enter="search"
        @input="clearSearch"
      ></el-input>
      <div class="search-btn iconfont icon-search" @click="search"></div>
    </div>
    <div v-if="searchResults.length > 1" class="search-match-list" role="list" aria-label="匹配的联系人">
      <button
        v-for="item in searchResults"
        :key="item.contactId"
        class="search-match-option"
        :class="{ active: selectedContactId === item.contactId }"
        type="button"
        @click="selectedContactId = item.contactId"
      >
        <UserBaseInfo :user-info="item" :show-area="item.contactType === 'USER'"></UserBaseInfo>
        <span class="search-match-type">{{ item.contactType === 'USER' ? '用户' : '群聊' }}</span>
        <span class="search-match-id">{{ item.contactId }}</span>
      </button>
    </div>
    <div v-if="searchResult" class="search-result-panel">
      <div class="search-result">
        <span class="contact-type">{{ contactTypeName }}</span>
        <UserBaseInfo
          :user-info="searchResult"
          :show-area="searchResult.contactType === 'USER'"
        ></UserBaseInfo>
      </div>
      <div v-if="searchResult.contactId !== userInfoStore.getInfo().userId" class="op-btn">
        <el-button
          type="primary"
          v-if="
            searchResult.status == null ||
            searchResult.status === 0 ||
            searchResult.status === 2 ||
            searchResult.status === 3 ||
            searchResult.status === 4
          "
          @click="applyContact"
        >
          {{ searchResult.contactType === 'USER' ? '添加联系人' : '申请加入群组' }}
        </el-button>
        <el-button v-if="searchResult.status === 1" type="primary" @click="sendMessage"
          >发送消息</el-button
        >
        <span v-if="searchResult.status === 5 || searchResult.status === 6">对方拉黑了你 </span>
      </div>
    </div>
    <div v-else-if="searched && searchResults.length === 0" class="no-data">没有找到匹配的联系人</div>
  </ContentPanel>
  <SearchAdd ref="searchAddRef" @reload="resetFrom"></SearchAdd>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import Api from '@/utils/Api'
import Request from '@/utils/Request'

import Message from '@/plugin/Message'
import { useUserInfoStore } from '@/stores/UserInfoStore'
import UserBaseInfo from '@/components/UserBaseInfo.vue'
import SearchAdd from '@/views/contact/SearchAdd.vue'

const userInfoStore = useUserInfoStore()
const router = useRouter()

const contactId = ref()
const searchResults = ref([])
const selectedContactId = ref('')
const searched = ref(false)
const searchResult = computed(() => searchResults.value.find((item) => item.contactId === selectedContactId.value) || null)
const contactTypeName = computed(() => {
  if (!searchResult.value) return ''
  if (userInfoStore.getInfo().userId === searchResult.value.contactId) {
    return '自己'
  } else if (searchResult.value.contactType === 'USER') {
    return '用户'
  } else return '群组'
})

const clearSearch = () => {
  searchResults.value = []
  selectedContactId.value = ''
  searched.value = false
}

//搜索
const search = async () => {
  const keyword = String(contactId.value || '').trim()
  clearSearch()
  if (!keyword) {
    Message.warning('请输入邮箱、用户或群昵称、用户或群编号')
    return
  }
  let result = await Request({
    url: Api.searchByKeyword,
    params: {
      keyword
    }
  })
  if (!result) {
    searched.value = true
    return
  }
  searchResults.value = Array.isArray(result.data) ? result.data : []
  searched.value = true
  if (searchResults.value.length === 1) selectedContactId.value = searchResults.value[0].contactId
}

const searchAddRef = ref()
const applyContact = () => {
  searchAddRef.value.show(searchResult.value)
}

const sendMessage = () => {
  const contact = searchResult.value
  if (!contact || contact.status !== 1 || contact.contactId === userInfoStore.getInfo().userId) return
  return router.push({
    path: '/chat',
    query: { chatId: contact.contactId, timestamp: Date.now() }
  })
}

/**
 * 重置表单
 */
const resetFrom = () => {
  searchAddRef.value = {}
  contactId.value = undefined
  clearSearch()
}
</script>

<style scoped lang="less">
.search-form {
  padding-top: 50px;
  display: flex;
  align-items: center;

  :deep(.el-input__wrapper) {
    border-radius: 4px 0 0 4px;
    border-right: none;
  }

  .search-btn {
    background: #07c160;
    color: #fff;
    line-height: 40px;
    width: 80px;
    text-align: center;
    border-radius: 0 5px 5px 0;
    cursor: pointer;

    &:hover {
      background: #0dd36c;
    }
  }
}

.no-data {
  padding: 30px 0;
}

.search-match-list {
  display: grid;
  max-height: 360px;
  gap: 8px;
  overflow: auto;
  margin-top: 12px;
}

.search-match-option {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border: 1px solid #e6e8e5;
  border-radius: 10px;
  background: #fff;
  text-align: left;
  cursor: pointer;

  &:hover,
  &.active {
    border-color: #b7d9c7;
    background: #f2f8f4;
  }

  :deep(.user-panel) {
    flex: 1;
    min-width: 0;
  }
}

.search-match-type,
.search-match-id {
  flex: 0 0 auto;
  color: #66736b;
  font-size: 12px;
}

.search-result-panel {
  .search-result {
    padding: 30px 20px 20px 20px;
    background: #fff;
    border-radius: 5px;
    margin-top: 10px;
    position: relative;

    .contact-type {
      position: absolute;
      left: 0;
      top: 0;
      background: #2cb6fe;
      padding: 2px 5px;
      color: #fff;
      border-radius: 5px 0 0 0;
      font-size: 12px;
    }
  }

  .op-btn {
    border-radius: 5px;
    margin-top: 10px;
    padding: 10px;
    background: #fff;
    text-align: center;
  }
}
</style>
