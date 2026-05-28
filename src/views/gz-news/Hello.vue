<template>
  <div class="gz-hello">
    <h2>{{ $t('gzHello.news') }}</h2>
    <p>D01 GZ-SYS-001 占位页 — 后续 GZ-NEWS-* 系列 ticket（资讯分类 / 文章 CMS / 定时发布）会落地</p>
  </div>
</template>

<script lang="ts" setup>
defineOptions({ name: 'GzNewsHello' });
</script>

<style lang="scss" scoped>
.gz-hello {
  padding: 24px;
}
</style>
