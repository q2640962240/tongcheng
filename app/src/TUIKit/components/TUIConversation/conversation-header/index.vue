<template>
  <div
    :ref="convHeaderRef"
    class="tui-conversation-header"
  >
    <Navigation title="消息">
    </Navigation>
    <slot />
  </div>
</template>
<script lang="ts" setup>
import { ref } from '../../../adapter-vue';
import Navigation from '../../common/Navigation/index.vue';

const convHeaderRef = ref<HTMLElement | undefined>();

const closeChildren = () => {};

defineExpose({
  closeChildren,
});

</script>
<style lang="scss" scoped>
.menu-container {
  position: relative;
}
</style>

<style lang="scss" scoped src="../style/index.scss"></style>
