<template>
  <div class="gz-hello">
    <h2>{{ $t('gzHello.ord') }}</h2>
    <p>D01 GZ-SYS-001 占位页 — V1.1 GZ-ORD-* 系列 ticket（商品 CRUD / 三类订单聚合 / 物流推进）会落地</p>
  </div>
</template>

<script lang="ts" setup>
defineOptions({ name: 'GzOrdHello' });
</script>

<style lang="scss" scoped>
.gz-hello {
  padding: 24px;
}
</style>
