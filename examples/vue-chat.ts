import { defineComponent } from 'vue';
import { AiDisclosure, AiLabel } from '@afkzona/telltale/vue';

export const Chat = defineComponent({
  components: { AiDisclosure, AiLabel },
  emits: ['shown'],
  template: `
    <section aria-label="Support chat">
      <AiDisclosure dismissible @shown="(d) => $emit('shown', d.text)" />
      <AiLabel kind="public-interest-text" details />
    </section>`,
});
