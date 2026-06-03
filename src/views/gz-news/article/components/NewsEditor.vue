<!--
  GZ-NEWS-003 资讯富文本编辑器（quill 包装）

  复用 plus-ui 已集成的 @vueup/vue-quill（不引 wangEditor 新依赖 — CLAUDE.md §6 #8 / ticket D1）。
  与 ruoyi 自带 src/components/Editor 的差异：
    1. 图片上传走 SYS-005 /system/gz/file/upload?usageType=news_inline（不走 ruoyi /resource/oss/upload）
       —— ticket AC3 强约束 #2：图片必走 SYS-005，返回 file_id；插入 <img data-file-id>（决策 D5）
    2. 不引新依赖、不改 ruoyi 自带组件（铁律「不动 ruoyi 自带」）
    3. 工具栏对齐 ticket AC3：标题 / 加粗 / 斜体 / 列表 / 引用 / 链接 / 图片 / 视频 / 分割线 / 清除格式
-->
<template>
  <div>
    <!-- 隐藏 el-upload：仅作为图片上传通道，由 quill image handler 触发 -->
    <el-upload
      :action="uploadUrl"
      :data="uploadData"
      :before-upload="handleBeforeUpload"
      :on-success="handleUploadSuccess"
      :on-error="handleUploadError"
      class="news-editor-img-uploader"
      name="file"
      :show-file-list="false"
      :headers="uploadHeaders"
    >
      <i ref="uploadRef"></i>
    </el-upload>

    <div class="news-editor">
      <quill-editor
        ref="quillEditorRef"
        v-model:content="content"
        content-type="html"
        :options="options"
        :style="styles"
        @text-change="onTextChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts" name="NewsEditor">
import '@vueup/vue-quill/dist/vue-quill.snow.css';
import { QuillEditor } from '@vueup/vue-quill';
import { globalHeaders } from '@/utils/request';
import { ElMessage } from 'element-plus';

const props = defineProps({
  /** v-model 绑定的 HTML 内容 */
  modelValue: { type: String, default: '' },
  /** 编辑器高度（px） */
  height: { type: Number, default: 480 },
  /** 单张图片大小上限（MB） */
  fileSize: { type: Number, default: 5 },
  /**
   * 内嵌图片上传的 usageType（落 gz_file_object.usage_type）。
   * 默认 news_inline（资讯）；预购商品详情复用本编辑器时传 preorder_product_image（GZ-ORD-101）。
   */
  usageType: { type: String, default: 'news_inline' }
});
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();

const baseApi = import.meta.env.VITE_APP_BASE_API;
// 图片走 SYS-005；usageType 由调用方决定（资讯=news_inline / 预购商品=preorder_product_image）
const uploadUrl = baseApi + '/system/gz/file/upload';
const uploadData = computed(() => ({ usageType: props.usageType }));
const uploadHeaders = globalHeaders();

const quillEditorRef = ref();
const uploadRef = ref<HTMLElement>();
const content = ref<string>('');
let loadingInstance: any = null;

const styles = computed(() => ({ height: `${props.height}px` }));

const options = {
  theme: 'snow',
  bounds: document.body,
  debug: 'warn',
  placeholder: '请输入正文内容…（图片自动上传至对象存储，不支持外链图 / base64 大图）',
  modules: {
    toolbar: {
      container: [
        [{ header: [1, 2, 3, false] }], // 标题
        ['bold', 'italic'], // 加粗 斜体
        [{ list: 'ordered' }, { list: 'bullet' }], // 有序 / 无序列表
        ['blockquote'], // 引用
        ['link', 'image', 'video'], // 链接 / 图片 / 视频
        [{ align: [] }], // 对齐
        ['clean'] // 清除格式（含分割线由 quill 的 divider blot 不内置，用清除格式替代）
      ],
      handlers: {
        image() {
          // 走 SYS-005 上传通道（el-upload click）
          uploadRef.value?.click();
        }
      }
    }
  }
};

function onTextChange() {
  emit('update:modelValue', content.value);
}

// 外部回填 → 同步 quill（避免编辑回显内容丢失）
watch(
  () => props.modelValue,
  (v) => {
    if (v !== content.value) {
      content.value = v || '<p></p>';
    }
  },
  { immediate: true }
);

// 上传前：校验图片格式 + 大小（强约束 #2：拒绝非图片 / 超限）
function handleBeforeUpload(file: File) {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.type)) {
    ElMessage.error('仅支持 jpg / png / webp / gif 图片');
    return false;
  }
  if (file.size / 1024 / 1024 >= props.fileSize) {
    ElMessage.error(`图片大小不能超过 ${props.fileSize}MB`);
    return false;
  }
  loadingInstance = ElMessage({ message: '图片上传中…', type: 'info', duration: 0 });
  return true;
}

// 上传成功：插入 <img src data-file-id>（决策 D5：内嵌图 file_id 关联，孤儿清理反查）
function handleUploadSuccess(res: any) {
  loadingInstance?.close?.();
  if (res?.code === 200 && res?.data?.url) {
    const quill = toRaw(quillEditorRef.value).getQuill();
    const range = quill.getSelection(true);
    const index = range ? range.index : quill.getLength();
    quill.insertEmbed(index, 'image', res.data.url);
    // 给刚插入的 img 补 data-file-id（quill 不直接支持自定义属性，落库后由后端清洗保留）
    const fileId = res.data.fileId;
    nextTick(() => {
      const imgs = quill.root.querySelectorAll(`img[src="${res.data.url}"]`);
      imgs.forEach((img: HTMLImageElement) => {
        if (fileId) img.setAttribute('data-file-id', String(fileId));
      });
      // 触发内容同步
      content.value = quill.root.innerHTML;
      emit('update:modelValue', content.value);
    });
    quill.setSelection(index + 1);
  } else {
    ElMessage.error(res?.msg || '图片上传失败');
  }
}

function handleUploadError() {
  loadingInstance?.close?.();
  ElMessage.error('图片上传失败，请稍后重试');
}
</script>

<style scoped>
.news-editor-img-uploader {
  display: none;
}
.news-editor :deep(.ql-container) {
  font-size: 14px;
}
</style>
