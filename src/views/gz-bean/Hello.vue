<template>
  <div class="gz-hello">
    <h2>{{ $t('gzHello.bean') }}</h2>
    <p>D01 GZ-SYS-001 占位页 — 后续 GZ-BEAN-* 系列 ticket（门店配置 / 时段模板 / 座位排版 / 预约列表与核销）会落地真实业务页</p>
  </div>
</template>

<script lang="ts" setup>
defineOptions({ name: 'GzBeanHello' });
</script>

<style lang="scss" scoped>
.gz-hello {
  padding: 24px;
}
</style>
