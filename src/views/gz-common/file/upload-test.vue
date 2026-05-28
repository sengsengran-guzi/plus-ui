<template>
  <div class="gz-file-upload-test">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <h2>{{ t('gzFile.title') }}</h2>
          <span class="ticket-tag">GZ-SYS-005</span>
        </div>
      </template>

      <el-alert :title="t('gzFile.description')" type="info" :closable="false" show-icon />

      <el-divider />

      <el-form ref="formRef" :model="form" label-width="120px" class="upload-form">
        <el-form-item :label="t('gzFile.usageType')" prop="usageType" required>
          <el-select v-model="form.usageType" :placeholder="t('gzFile.usageTypePlaceholder')" style="width: 320px">
            <el-option :label="t('gzFile.scene.newsCover')" :value="GZ_FILE_USAGE_TYPE.NEWS_COVER" />
            <el-option :label="t('gzFile.scene.newsInline')" :value="GZ_FILE_USAGE_TYPE.NEWS_INLINE" />
            <el-option :label="t('gzFile.scene.userAvatar')" :value="GZ_FILE_USAGE_TYPE.USER_AVATAR" />
            <el-option :label="t('gzFile.scene.gachaPrizeImage')" :value="GZ_FILE_USAGE_TYPE.GACHA_PRIZE_IMAGE" />
            <el-option :label="t('gzFile.scene.preorderProductImage')" :value="GZ_FILE_USAGE_TYPE.PREORDER_PRODUCT_IMAGE" />
            <el-option :label="t('gzFile.scene.storeImage')" :value="GZ_FILE_USAGE_TYPE.STORE_IMAGE" />
          </el-select>
        </el-form-item>

        <el-form-item :label="t('gzFile.uploadBtn')">
          <el-upload
            ref="uploadRef"
            :auto-upload="true"
            :show-file-list="false"
            :http-request="customHttpRequest"
            :before-upload="beforeUpload"
            accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif"
            drag
          >
            <el-icon class="el-icon--upload"><Upload /></el-icon>
            <div class="el-upload__text">{{ t('gzFile.uploadBtn') }}</div>
            <template #tip>
              <div class="el-upload__tip">{{ t('gzFile.uploadHint') }}</div>
            </template>
          </el-upload>
        </el-form-item>
      </el-form>

      <el-divider />

      <!-- 上传结果 -->
      <div v-if="result" class="result-block">
        <h3>{{ t('gzFile.resultTitle') }}</h3>
        <el-descriptions :column="2" border>
          <el-descriptions-item :label="t('gzFile.fileId')">{{ result.fileId }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzFile.fileName')">{{ result.fileName }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzFile.fileSize')">{{ formatBytes(result.fileSize) }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzFile.mimeType')">{{ result.mimeType }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzFile.objectKey')" :span="2">{{ result.objectKey }}</el-descriptions-item>
          <el-descriptions-item :label="t('gzFile.url')" :span="2">
            <a :href="result.url" target="_blank" class="url-link">{{ result.url }}</a>
          </el-descriptions-item>
        </el-descriptions>
        <div v-if="result.url && isImagePreviewable" class="preview-block">
          <h4>{{ t('gzFile.preview') }}</h4>
          <el-image :src="result.url" fit="contain" style="max-width: 480px; max-height: 320px" />
        </div>
      </div>

      <!-- 拿 fileId 反查临时 URL -->
      <el-divider />
      <div class="fetch-url-block">
        <h3>{{ t('gzFile.fetchUrlBtn') }}</h3>
        <el-input
          v-model="lookupFileId"
          :placeholder="t('gzFile.fetchUrlPlaceholder')"
          style="width: 320px; margin-right: 12px"
          @keyup.enter="fetchUrl"
        />
        <el-button type="primary" :loading="urlLoading" @click="fetchUrl">{{ t('gzFile.fetchUrlBtn') }}</el-button>
      </div>
    </el-card>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Upload } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import {
  uploadGzFile,
  getGzFileUrl,
  GZ_FILE_USAGE_TYPE,
  type GzFileObjectVO,
  type GzFileUsageType
} from '@/api/gz-common/file';

defineOptions({ name: 'GzFileUploadTest' });

const { t } = useI18n();

const form = ref<{ usageType: GzFileUsageType | '' }>({ usageType: '' });
const result = ref<GzFileObjectVO | null>(null);
const lookupFileId = ref<string>('');
const urlLoading = ref(false);

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif'
]);

const isImagePreviewable = computed(() => {
  const mime = result.value?.mimeType?.toLowerCase();
  return mime != null && ALLOWED_MIME.has(mime);
});

function beforeUpload(file: File): boolean {
  if (!form.value.usageType) {
    ElMessage.warning(t('gzFile.usageTypeRequired'));
    return false;
  }
  const mime = (file.type || '').toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    ElMessage.error(t('gzFile.mimeNotAllowed'));
    return false;
  }
  if (file.size > MAX_SIZE_BYTES) {
    ElMessage.error(t('gzFile.sizeExceed'));
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
  fd.append('usageType', form.value.usageType as string);
  try {
    const resp = await uploadGzFile(fd);
    result.value = resp.data;
    ElMessage.success(t('gzFile.uploadSuccess', { id: result.value.fileId }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ElMessage.error(`${t('gzFile.uploadFailed')}: ${msg}`);
  }
}

async function fetchUrl(): Promise<void> {
  const idStr = lookupFileId.value.trim();
  if (!idStr) {
    ElMessage.warning(t('gzFile.fetchUrlPlaceholder'));
    return;
  }
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) {
    ElMessage.warning(t('gzFile.fetchUrlPlaceholder'));
    return;
  }
  urlLoading.value = true;
  try {
    const resp = await getGzFileUrl(id);
    result.value = resp.data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ElMessage.error(`${t('gzFile.uploadFailed')}: ${msg}`);
  } finally {
    urlLoading.value = false;
  }
}

function formatBytes(bytes: number | undefined): string {
  if (bytes == null) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
</script>

<style lang="scss" scoped>
.gz-file-upload-test {
  padding: 16px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  h2 {
    margin: 0;
    font-size: 18px;
  }

  .ticket-tag {
    padding: 2px 8px;
    background: var(--el-color-primary-light-8);
    color: var(--el-color-primary);
    border-radius: 4px;
    font-size: 12px;
  }
}

.upload-form {
  margin-top: 16px;
}

.result-block,
.fetch-url-block {
  margin-top: 8px;

  h3 {
    margin-bottom: 12px;
    font-size: 16px;
  }
}

.preview-block {
  margin-top: 16px;

  h4 {
    margin-bottom: 8px;
    font-size: 14px;
    color: var(--el-text-color-regular);
  }
}

.url-link {
  color: var(--el-color-primary);
  word-break: break-all;
}
</style>
