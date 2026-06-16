import { useRef, useCallback } from 'react';
import { NodeViewWrapper, NodeViewProps, ReactNodeViewRenderer } from '@tiptap/react';
import Image from '@tiptap/extension-image';

const SIZE_PRESETS = ['25%', '50%', '75%', '100%'];

const ResizableImageComponent = ({ node, updateAttributes, selected }: NodeViewProps) => {
  const { src, alt, title, width } = node.attrs;
  const imgRef = useRef<HTMLImageElement>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startX.current = e.clientX;
      startWidth.current = imgRef.current?.offsetWidth ?? parseInt(width) ?? 400;

      const onMove = (mv: MouseEvent) => {
        const newWidth = Math.max(50, startWidth.current + (mv.clientX - startX.current));
        updateAttributes({ width: `${Math.round(newWidth)}px` });
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [updateAttributes, width],
  );

  return (
    <NodeViewWrapper className="block my-2">
      <div className="relative inline-block max-w-full">
        {selected && (
          <div className="absolute -top-8 left-0 z-20 flex items-center gap-0.5 rounded border bg-background px-1 py-0.5 shadow-sm">
            {SIZE_PRESETS.map((pct) => (
              <button
                key={pct}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  updateAttributes({ width: pct });
                }}
                className="rounded px-1.5 py-0.5 text-xs hover:bg-accent"
              >
                {pct}
              </button>
            ))}
            <div className="mx-1 h-4 w-px bg-border" />
            <span className="pr-1 text-xs text-muted-foreground">
              {width ?? 'auto'}
            </span>
          </div>
        )}
        <img
          ref={imgRef}
          src={src}
          alt={alt ?? ''}
          title={title ?? ''}
          draggable={false}
          style={{ width: width ?? 'auto', height: 'auto', maxWidth: '100%', display: 'block' }}
          className={`rounded-md ${selected ? 'ring-2 ring-primary' : ''}`}
        />
        {selected && (
          <div
            className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize rounded-tl bg-primary"
            onMouseDown={handleMouseDown}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
};

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: null },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent);
  },
});
