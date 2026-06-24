<!--
  GzImageUpload — 业务图片上传（gz_file_object 体系，区别于 RuoYi sys_oss 的 ImageUpload）。

  用途：扭蛋封面 / 奖品图 / 等所有以 gz_file_object.id 为 FK 的业务图片。
  v-model 绑定的是「文件 id（字符串）」（对齐 form.coverImageId / form.imageId），不是裸 url。

  流程：选图 → POST /system/gz/file/upload（multipart，usageType）→ 拿 {fileId,url} →
  emit fileId（字符串）+ 预览；编辑回显时按 id 反查 /system/gz/file/url 拿 1h 预签名 url。

  <GzImageUpload v-model="form.coverImageId" :usage-type="GZ_FILE_USAGE_TYPE.GACHA_PRIZE_IMAGE" />
-->
<template>
  <div class="gz-image-upload">
    <div v-if="modelValue && previewUrl" v-loading="loading" class="gz-image-upload__preview">
      <el-image :src="previewUrl" fit="cover" :preview-src-list="[previewUrl]" :z-index="3000" class="gz-image-upload__img" />
      <div class="gz-image-upload__mask" :title="t('gzImageUpload.remove')" @click="removeImage">
        <el-icon><Delete /></el-icon>
      </div>
    </div>
    <el-upload
      v-else
      :auto-upload="true"
      :show-file-list="false"
      :http-request="customHttpRequest"
      :before-upload="beforeUpload"
      accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif"
    >
      <div v-loading="loading" class="gz-image-upload__btn">
        <el-icon><Plus /></el-icon>
        <span class="gz-image-upload__tip">{{ t('gzImageUpload.upload') }}</span>
      </div>
    </el-upload>
  </div>
</template>

<script lang="ts" setup name="GzImageUpload">
import { ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, Delete } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import { uploadGzFile, getGzFileUrl, type GzFileUsageType } from '@/api/gz-common/file';

const props = withDefaults(
  defineProps<{
    /** 文件 id（字符串，对齐表单 coverImageId / imageId；空=未传图） */
    modelValue?: string | null;
    /** 业务场景（doc/11 §5.3 枚举，决定 OSS 目录 + 校验） */
    usageType: GzFileUsageType;
    /** 体积上限（MB，默认 10） */
    fileSize?: number;
  }>(),
  { modelValue: null, fileSize: 10 }
);

const emit = defineEmits<{ (e: 'update:modelValue', v: string | null): void }>();

const { t } = useI18n();

const previewUrl = ref<string>('');
const loading = ref<boolean>(false);

const ALLOWED_MIME: ReadonlySet<string> = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);

function beforeUpload(file: File): boolean {
  const mime = (file.type || '').toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    ElMessage.error(t('gzImageUpload.mimeNotAllowed'));
    return false;
  }
  if (file.size > props.fileSize * 1024 * 1024) {
    ElMessage.error(t('gzImageUpload.sizeExceed', { n: props.fileSize }));
    return false;
  }
  return true;
}

interface UploadHttpRequestOptions {
  file: File;
}

async function customHttpRequest(options: UploadHttpRequestOptions): Promise<void> {
  const fd = new FormData();
  fd.append('file', options.file);
  fd.append('usageType', props.usageType);
  loading.value = true;
  try {
    const resp = await uploadGzFile(fd);
    emit('update:modelValue', resp.data.fileId != null ? String(resp.data.fileId) : null);
  } catch (err) {
    console.error('[gz-image-upload] upload failed', err);
    ElMessage.error(t('gzImageUpload.uploadFailed'));
  } finally {
    loading.value = false;
  }
}

function removeImage(): void {
  previewUrl.value = '';
  emit('update:modelValue', null);
}

/** 按 fileId 反查 1h 预签名 url 回显（编辑 / 上传后）。 */
async function loadPreview(id: string | null | undefined): Promise<void> {
  if (!id) {
    previewUrl.value = '';
    return;
  }
  const num = Number(id);
  if (!Number.isFinite(num) || num <= 0) {
    previewUrl.value = '';
    return;
  }
  loading.value = true;
  try {
    const resp = await getGzFileUrl(num);
    previewUrl.value = resp.data.url ?? '';
  } catch (err) {
    console.error('[gz-image-upload] preview failed', err);
    previewUrl.value = '';
  } finally {
    loading.value = false;
  }
}

// id 变（编辑回显 / 上传成功 emit）→ 丢旧预览 + 重新拉
watch(
  () => props.modelValue,
  (v, old) => {
    if (v !== old) {
      previewUrl.value = '';
    }
    if (v) {
      void loadPreview(v);
    }
  },
  { immediate: true }
);
</script>

<style lang="scss" scoped>
.gz-image-upload {
  display: inline-block;
}
.gz-image-upload__preview {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--el-border-color);
}
.gz-image-upload__img {
  width: 100%;
  height: 100%;
  display: block;
}
.gz-image-upload__mask {
  position: absolute;
  right: 4px;
  top: 4px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  cursor: pointer;
  transition: background 0.2s;
}
.gz-image-upload__mask:hover {
  background: var(--el-color-danger);
}
.gz-image-upload__btn {
  width: 120px;
  height: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  transition:
    border-color 0.2s,
    color 0.2s;
}
.gz-image-upload__btn:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}
.gz-image-upload__tip {
  font-size: 12px;
}
</style>
