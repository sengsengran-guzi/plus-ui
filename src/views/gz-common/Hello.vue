<template>
  <div class="gz-hello">
    <h2>{{ $t('gzHello.common') }}</h2>
    <p>D01 GZ-SYS-001 占位页 — 后续 ticket（GZ-COMMON-* / GZ-PAY-* / GZ-SYS-004 客服配置等）会替换为真实业务页</p>
  </div>
</template>

<script lang="ts" setup>
defineOptions({ name: 'GzCommonHello' });
</script>

<style lang="scss" scoped>
.gz-hello {
  padding: 24px;
}
</style>
