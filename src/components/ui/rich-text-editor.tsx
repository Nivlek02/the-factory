import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { TextStyle } from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { ResizableImage } from './resizable-image';
import FontSize from 'tiptap-fontsize-extension';
import { CustomBulletList, type BulletListStyle } from './custom-bullet-list';
import { getShortUrlLabel } from '@/lib/urlUtils';
import { uploadFile } from '@/services/storageService';
import { toast } from 'sonner';
import { useRef } from 'react';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon,
  List, 
  ListOrdered, 
  CheckSquare,
  Type,
  Undo,
  Redo,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ChevronDown,
  ImageIcon
} from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
}

const fontFamilies = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Courier New', label: 'Courier New' },
  { value: 'Verdana', label: 'Verdana' },
];

const fontSizes = [
  { value: '12px', label: '12' },
  { value: '14px', label: '14' },
  { value: '16px', label: '16' },
  { value: '18px', label: '18' },
  { value: '20px', label: '20' },
  { value: '24px', label: '24' },
  { value: '28px', label: '28' },
  { value: '32px', label: '32' },
];

const bulletStyles: { value: BulletListStyle; label: string; symbol: string }[] = [
  { value: 'disc', label: '● Círculo sólido', symbol: '●' },
  { value: 'circle', label: '○ Círculo vacío', symbol: '○' },
  { value: 'square', label: '■ Cuadrado', symbol: '■' },
  { value: 'dash', label: '– Guion', symbol: '–' },
  { value: 'arrow', label: '→ Flecha', symbol: '→' },
];

const RichTextEditor = ({ content, onChange, placeholder = 'Escribe aquí...', className }: RichTextEditorProps) => {
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (file: File, editorInstance: any) => {
    if (!file.type.startsWith('image/')) return;
    try {
      const result = await uploadFile(file);
      editorInstance.chain().focus().setImage({ src: result.url, alt: file.name }).run();
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Error al subir la imagen');
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: false,
        orderedList: {
          keepMarks: true,
          keepAttributes: true,
          HTMLAttributes: {
            class: 'list-decimal pl-5',
          },
        },
        listItem: {
          HTMLAttributes: {
            class: 'my-0.5',
          },
        },
      }),
      CustomBulletList.configure({
        keepMarks: true,
        keepAttributes: true,
        HTMLAttributes: {
          class: 'pl-5',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      TextStyle,
      FontFamily,
      FontSize.configure({
        defaultSize: '16px',
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: 'task-list',
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'task-item',
        },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          class: 'text-primary underline hover:text-primary/80 cursor-pointer',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      ResizableImage,
    ],
    editorProps: {
      handlePaste: (view, event) => {
        // Handle image paste
        const items = event.clipboardData?.items;
        if (items) {
          for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
              event.preventDefault();
              const file = item.getAsFile();
              if (file && editor) {
                handleImageUpload(file, editor);
              }
              return true;
            }
          }
        }

        const html = event.clipboardData?.getData('text/html');
        const plainText = event.clipboardData?.getData('text/plain') || event.clipboardData?.getData('text') || '';

        // Case 1: HTML with <a> tags (Word, OneDrive rich paste)
        if (html && /<a\s[^>]*href=/i.test(html)) {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = html;

          const links = tempDiv.querySelectorAll('a[href]');
          links.forEach(link => {
            const href = (link.getAttribute('href') || '').replace(/[\r\n\t\u00A0\u200B\u200C\u200D\uFEFF\s]/g, '');
            link.setAttribute('href', href);
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
            if (!link.textContent?.trim() || link.textContent.trim() === href || link.textContent.trim().length > 60) {
              link.textContent = getShortUrlLabel(href);
            }
          });

          editor?.commands.insertContent(tempDiv.innerHTML, {
            parseOptions: { preserveWhitespace: false },
          });
          return true;
        }

        // Case 2: No <a> tags but text may contain URLs (plain text paste or HTML without links)
        const textToCheck = plainText || (html ? html.replace(/<[^>]*>/g, ' ') : '');
        const urlRegex = /https?:\/\/[^\s<>"']+/gi;
        const urls = textToCheck.match(urlRegex);

        if (urls && urls.length > 0) {
          let result = textToCheck;
          const normalizedUrls = urls.map(u => u.replace(/[\r\n\t\u00A0\u200B\u200C\u200D\uFEFF]/g, '').replace(/\s+/g, ''));
          
          for (let i = 0; i < urls.length; i++) {
            const original = urls[i];
            const clean = normalizedUrls[i];
            const label = getShortUrlLabel(clean);
            result = result.replace(original, `<a href="${clean}" target="_blank" rel="noopener noreferrer">${label}</a>`);
          }

          result = result.replace(/\n/g, '<br>');

          editor?.commands.insertContent(result, {
            parseOptions: { preserveWhitespace: false },
          });
          return true;
        }

        return false;
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (files && files.length > 0) {
          for (const file of Array.from(files)) {
            if (file.type.startsWith('image/') && editor) {
              event.preventDefault();
              handleImageUpload(file, editor);
              return true;
            }
          }
        }
        return false;
      },
    },
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });


  const getCurrentFontSize = () => {
    if (!editor) return '16px';
    const attrs = editor.getAttributes('textStyle');
    return attrs.fontSize || '16px';
  };

  const getCurrentFontSizeIndex = () => {
    const current = getCurrentFontSize();
    const index = fontSizes.findIndex(s => s.value === current);
    return index >= 0 ? index : 2;
  };

  const changeFontSize = (increase: boolean) => {
    if (!editor) return;
    const currentIndex = getCurrentFontSizeIndex();
    let newIndex = currentIndex;
    
    if (increase && currentIndex < fontSizes.length - 1) {
      newIndex = currentIndex + 1;
    } else if (!increase && currentIndex > 0) {
      newIndex = currentIndex - 1;
    }
    
    if (newIndex !== currentIndex) {
      editor.chain().focus().setFontSize(fontSizes[newIndex].value).run();
    }
  };

  const setFontSize = (size: string) => {
    if (!editor) return;
    editor.chain().focus().setFontSize(size).run();
  };

  const toggleBulletListWithStyle = (style: BulletListStyle) => {
    if (!editor) return;
    (editor.commands as any).toggleBulletListWithStyle(style);
  };

  if (!editor) {
    return null;
  }

  return (
    <div className={cn("border border-input rounded-md overflow-hidden", className)}>
      {/* Hidden image input */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) {
            await handleImageUpload(file, editor);
          }
          if (imageInputRef.current) imageInputRef.current.value = '';
        }}
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-border bg-muted/50">
        {/* Font Family */}
        <Select
          value={editor.getAttributes('textStyle').fontFamily || 'Inter'}
          onValueChange={(value) => editor.chain().focus().setFontFamily(value).run()}
        >
          <SelectTrigger className="h-8 w-[100px] text-xs">
            <Type className="h-3 w-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {fontFamilies.map((font) => (
              <SelectItem key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                {font.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Font Size Selector */}
        <Select
          value={getCurrentFontSize()}
          onValueChange={setFontSize}
        >
          <SelectTrigger className="h-8 w-[70px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {fontSizes.map((size) => (
              <SelectItem key={size.value} value={size.value}>
                {size.label}px
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Font Size Increment/Decrement */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => changeFontSize(true)}
          className="h-8 w-8 p-0"
          title="Aumentar tamaño (A+)"
        >
          <span className="text-xs font-bold">A+</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => changeFontSize(false)}
          className="h-8 w-8 p-0"
          title="Disminuir tamaño (A-)"
        >
          <span className="text-xs font-bold">A-</span>
        </Button>
        
        <div className="w-px h-6 bg-border mx-1" />

        {/* Text Formatting */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn("h-8 w-8 p-0", editor.isActive('bold') && "bg-accent")}
          title="Negrita"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn("h-8 w-8 p-0", editor.isActive('italic') && "bg-accent")}
          title="Cursiva"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={cn("h-8 w-8 p-0", editor.isActive('underline') && "bg-accent")}
          title="Subrayado"
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>
        
        <div className="w-px h-6 bg-border mx-1" />

        {/* Text Alignment */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: 'left' }) && "bg-accent")}
          title="Alinear izquierda"
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: 'center' }) && "bg-accent")}
          title="Centrar"
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: 'right' }) && "bg-accent")}
          title="Alinear derecha"
        >
          <AlignRight className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: 'justify' }) && "bg-accent")}
          title="Justificar"
        >
          <AlignJustify className="h-4 w-4" />
        </Button>
        
        <div className="w-px h-6 bg-border mx-1" />

        {/* Bullet List with Style Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn("h-8 px-2 gap-1", editor.isActive('bulletList') && "bg-accent")}
              title="Lista con viñetas"
            >
              <List className="h-4 w-4" />
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {bulletStyles.map((style) => (
              <DropdownMenuItem
                key={style.value}
                onClick={() => toggleBulletListWithStyle(style.value)}
                className="flex items-center gap-2"
              >
                <span className="w-4 text-center">{style.symbol}</span>
                <span>{style.label.split(' ').slice(1).join(' ')}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Ordered List */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn("h-8 w-8 p-0", editor.isActive('orderedList') && "bg-accent")}
          title="Lista numerada"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>

        {/* Task List / Checklist */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={cn("h-8 w-8 p-0", editor.isActive('taskList') && "bg-accent")}
          title="Checklist"
        >
          <CheckSquare className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Image Upload */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => imageInputRef.current?.click()}
          className="h-8 w-8 p-0"
          title="Insertar imagen"
        >
          <ImageIcon className="h-4 w-4" />
        </Button>

        <div className="flex-1" />
        
        {/* Undo/Redo */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="h-8 w-8 p-0"
          title="Deshacer"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="h-8 w-8 p-0"
          title="Rehacer"
        >
          <Redo className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Editor */}
      <EditorContent 
        editor={editor} 
        className="prose prose-sm max-w-none p-3 min-h-[120px] focus-within:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[100px] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:h-auto [&_.ProseMirror_img]:rounded-md"
      />
    </div>
  );
};

export default RichTextEditor;
