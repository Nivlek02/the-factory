import BulletList from '@tiptap/extension-bullet-list';

export type BulletListStyle = 'disc' | 'circle' | 'square' | 'dash' | 'arrow';

export const CustomBulletList = BulletList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      listStyleType: {
        default: 'disc',
        parseHTML: (element) => element.getAttribute('data-list-style') || 'disc',
        renderHTML: (attributes) => ({
          'data-list-style': attributes.listStyleType,
          class: `list-${attributes.listStyleType}`,
        }),
      },
    };
  },

  addCommands() {
    return {
      ...this.parent?.(),
      toggleBulletListWithStyle:
        (style: BulletListStyle) =>
        ({ commands, editor }: any) => {
          const isActive = editor.isActive('bulletList');
          const currentStyle = editor.getAttributes('bulletList').listStyleType;

          // If already in a bullet list with same style, toggle off
          if (isActive && currentStyle === style) {
            return commands.toggleBulletList();
          }

          // If already in a bullet list but different style, update attribute
          if (isActive) {
            return commands.updateAttributes('bulletList', { listStyleType: style });
          }

          // Not in a list, create one with the style
          return commands.toggleBulletList() && commands.updateAttributes('bulletList', { listStyleType: style });
        },
    };
  },
});
