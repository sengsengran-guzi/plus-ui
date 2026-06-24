<!--
  GzImageThumb — 业务图片只读缩略图（gz_file_object 体系）。

  用途：列表 / 下拉选项里按 gz_file_object.id 展示小图。区别于 GzImageUpload（编辑态上传组件）。
  传入文件 id（字符串，对齐后端 ToStringSerializer 出参），按 id 反查 1h 预签名 url 渲染。
  空 id / 解析失败 → 渲染占位（el-image error slot）。

  <GzImageThumb :file-id="row.imageId" :size="48" />
-->
<template>
  <el-image v-if="url" :src="url" fit="cover" :preview-src-list="[url]" :z-index="3000" :style="boxStyle" class="gz-image-thumb" />
  <div v-else class="gz-image-thumb gz-image-thumb--empty" :style="boxStyle">
    <el-icon><Picture /></el-icon>
  </div>
</template>

<script lang="ts" setup name="GzImageThumb">
import { ref, computed, watch } from 'vue';
import { Picture } from '@element-plus/icons-vue';
import { getGzFileUrl } from '@/api/gz-common/file';

const props = withDefaults(
  defineProps<{
    /** 文件 id（字符串，对齐后端 ToStringSerializer 出参；空=占位） */
    fileId?: string | number | null;
    /** 缩略图边长（px，默认 48） */
    size?: number;
  }>(),
  { fileId: null, size: 48 }
);

const url = ref<string>('');

const boxStyle = computed(() => ({ width: `${props.size}px`, height: `${props.size}px` }));

async function loadUrl(id: string | number | null | undefined): Promise<void> {
  url.value = '';
  if (id === null || id === undefined || id === '') return;
  const num = Number(id);
  if (!Number.isFinite(num) || num <= 0) return;
  try {
    const resp = await getGzFileUrl(num);
    url.value = resp.data.url ?? '';
  } catch (err) {
    console.error('[gz-image-thumb] preview failed', err);
    url.value = '';
  }
}

watch(
  () => props.fileId,
  (v) => {
    void loadUrl(v);
  },
  { immediate: true }
);
</script>

<style lang="scss" scoped>
.gz-image-thumb {
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  display: inline-block;
  vertical-align: middle;
}
.gz-image-thumb--empty {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-placeholder);
  background: var(--el-fill-color-lighter);
}
</style>
