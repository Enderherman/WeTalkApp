<template>
  <div class="avatar-upload">
    <div class="avatar-show">
      <template v-if="modelValue">
        <el-image v-if="preview" :src="localFile" fit="scale-down"></el-image>
        <ShowLocalImage
          v-else
          :file-id="props.modelValue"
          part-type="avatar"
          :width="40"
        ></ShowLocalImage>
      </template>
      <template v-else>
        <el-upload
          name="file"
          :show-file-list="false"
          accept=".png,.jpg,.jpeg,.gif,.bmp,.webp"
          :disabled="state.loading"
          :multiple="false"
          :http-request="uploadImage"
        >
          <span class="iconfont icon-add"></span>
        </el-upload>
      </template>
    </div>
    <div class="select-btn">
      <el-upload
        name="file"
        :show-file-list="false"
        accept=".png,.jpg,.jpeg,.gif,.bmp,.webp"
        :disabled="state.loading"
        :multiple="false"
        :http-request="uploadImage"
      >
        <el-button type="primary" size="small" :loading="state.loading">选择</el-button>
      </el-upload>
    </div>
    <p v-if="state.error" role="alert">{{ state.error }}</p>
  </div>
</template>

<script setup>
import ShowLocalImage from '@/components/ShowLocalImage.vue'
import { computed, onUnmounted, reactive, ref } from 'vue'
import { createAvatarSelection } from '@/utils/uploadValidation.mjs'

const preview = computed(() => {
  return props.modelValue instanceof File
})

const props = defineProps({
  modelValue: {
    type: [Object, String],
    default: null
  }
})

/**
 * 头像上传
 */
const localFile = ref(null)
const emit = defineEmits(['coverFile', 'update:modelValue'])
const state = reactive({ loading: false, error: '' })
const selection = createAvatarSelection({
  state,
  createCover: (path) => window.ipcRenderer.invoke('createCover', path),
  onResult: ({ avatarFile, coverFile }) => {
    if (localFile.value) URL.revokeObjectURL(localFile.value)
    localFile.value = URL.createObjectURL(avatarFile)
    emit('update:modelValue', avatarFile)
    emit('coverFile', { avatarFile, coverFile })
  }
})
const uploadImage = (request) => selection.select(request.file)

onUnmounted(() => {
  selection.dispose()
  if (localFile.value) URL.revokeObjectURL(localFile.value)
})
</script>

<style scoped lang="less">
.avatar-upload {
  display: flex;
  justify-content: center;
  align-items: end;
  line-height: normal;

  .avatar-show {
    background: #ededed;
    width: 60px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    position: relative;

    .icon-add {
      font-size: 30px;
      color: #b9b9b9;
      width: 60px;
      height: 60px;
      text-align: center;
      line-height: 60px;
    }

    img {
      width: 100%;
      height: 100%;
    }

    .op {
      position: absolute;
      color: #0e8aef;
      top: 80px;
    }
  }

  .select-btn {
    vertical-align: bottom;
    margin-left: 5px;
  }
}
</style>
