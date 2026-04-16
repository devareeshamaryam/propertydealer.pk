'use client'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { useEffect, useState, useRef } from 'react'
import {
    Bold,
    Italic,
    List,
    ListOrdered,
    Quote,
    Code,
    Heading1,
    Heading2,
    Heading3,
    Link as LinkIcon,
    Image as ImageIcon,
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignJustify,
    Undo,
    Redo,
    X,
    Trash2,
    Columns,
    Rows,
    Table as TableIcon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ImagePickerDialog, type GalleryImageItem } from '@/components/ImagePickerDialog'

type RichEditorProps = {
    value: any
    onChange: (value: any) => void;
}

export default function RichEditor({ value, onChange }: RichEditorProps) {
    const [mounted, setMounted] = useState(false)
    const [linkDialogOpen, setLinkDialogOpen] = useState(false)
    const [imageDialogOpen, setImageDialogOpen] = useState(false)
    const [linkUrl, setLinkUrl] = useState('')
    const [imageAlt, setImageAlt] = useState('')

    // Use a ref to track if the update came from the editor itself
    const isUpdatingRef = useRef(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3],
                },
                bulletList: {
                    HTMLAttributes: {
                        class: 'list-disc pl-6 space-y-1',
                    },
                },
                orderedList: {
                    HTMLAttributes: {
                        class: 'list-decimal pl-6 space-y-1',
                    },
                },
                blockquote: {
                    HTMLAttributes: {
                        class: 'border-l-4 border-gray-300 pl-4 italic my-4',
                    },
                },
                code: {
                    HTMLAttributes: {
                        class: 'bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-mono text-sm',
                    },
                },
                codeBlock: {
                    HTMLAttributes: {
                        class: 'bg-gray-100 dark:bg-gray-800 p-4 rounded-lg my-4 font-mono text-sm overflow-x-auto',
                    },
                },
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-blue-600 dark:text-blue-400 underline cursor-pointer',
                },
            }),
            Image.configure({
                inline: false,
                allowBase64: true,
                HTMLAttributes: {
                    class: 'max-w-full h-auto rounded-lg my-4',
                },
            }),
            Underline,
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            Placeholder.configure({
                placeholder: 'Start writing your content...',
            }),
            Table.configure({
                resizable: true,
                HTMLAttributes: {
                    class: 'min-w-full divide-y divide-gray-200 dark:divide-gray-700 my-4 border',
                },
            }),
            TableRow,
            TableHeader.configure({
                HTMLAttributes: {
                    class: 'bg-gray-50 dark:bg-gray-800 px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600',
                },
            }),
            TableCell.configure({
                HTMLAttributes: {
                    class: 'px-6 py-4 text-sm text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600',
                },
            }),
        ],
        content: value || '<p></p>',
        immediatelyRender: false,
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose-base lg:prose-lg xl:prose-xl max-w-none focus:outline-none min-h-[500px] p-6',
            }
        },
    })

    // Update editor content when value prop changes externally
    useEffect(() => {
        if (!editor || value === undefined) return;

        const currentHTML = editor.getHTML();
        if (value !== currentHTML && !isUpdatingRef.current) {
            editor.commands.setContent(value || '<p></p>');
        }
    }, [value, editor]);

    // Update the ref when the editor content changes
    useEffect(() => {
        if (!editor) return;

        const handleUpdate = () => {
            isUpdatingRef.current = true;
            onChange(editor.getHTML());
            // Reset the flag after the current tick
            setTimeout(() => {
                isUpdatingRef.current = false;
            }, 0);
        };

        editor.on('update', handleUpdate);
        return () => {
            editor.off('update', handleUpdate);
        };
    }, [editor, onChange]);

    const handleSetLink = () => {
        if (!editor) return
        if (editor.isActive('link')) {
            const previousUrl = editor.getAttributes('link').href
            setLinkUrl(previousUrl || '')
        }
        setLinkDialogOpen(true)
    }

    const confirmLink = () => {
        if (!editor) return
        if (linkUrl === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
        } else {
            editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run()
        }
        setLinkDialogOpen(false)
        setLinkUrl('')
    }

    const handleSetImage = () => {
        setImageAlt('')
        setImageDialogOpen(true)
    }

    const handleImageSelect = (image: GalleryImageItem | { url: string; key: string }) => {
        if (!editor) return

        // Get the image URL from either GalleryImageItem or URL object
        const imageUrl = image.url

        // Get full URL if it's a relative path
        const getFullImageUrl = (url: string): string => {
            if (url.startsWith('http://') || url.startsWith('https://')) {
                return url
            }
            if (url.startsWith('/uploads/')) {
                return url // Next.js will proxy this
            }
            return url
        }

        const fullUrl = getFullImageUrl(imageUrl)

        // Extract a meaningful alt text from the image key/filename
        const getAltText = (): string => {
            if (imageAlt) return imageAlt
            // Try to extract filename from key or URL
            const key = 'key' in image ? image.key : (image as any).url
            const filename = key.split('/').pop() || key.split('\\').pop() || ''
            // Remove extension and clean up
            const nameWithoutExt = filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
            return nameWithoutExt || 'Image'
        }

        editor.chain().focus().setImage({
            src: fullUrl,
            alt: getAltText()
        }).run()

        setImageDialogOpen(false)
        setImageAlt('')
    }

    if (!mounted || !editor) {
        return (
            <div className="min-h-[400px] w-full border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-gray-950/50 flex flex-col items-center justify-center p-12 transition-all duration-300">
                <div className="relative">
                    <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-primary animate-pulse" />
                    </div>
                </div>
                <div className="mt-6 text-center">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 italic">Initializing Editor</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-[250px]">
                        Setting up your creative workspace...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="border-2 border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900 shadow-sm">
                {/* Professional Toolbar */}
                <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2">
                    <div className="flex flex-wrap items-center gap-1">
                        {/* Text Formatting Group */}
                        <div className="flex items-center gap-1 pr-2 border-r border-gray-300 dark:border-gray-600">
                            <Button
                                type="button"
                                variant={editor.isActive('bold') ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => editor.chain().focus().toggleBold().run()}
                                className="h-9 w-9 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                                title="Bold (Ctrl+B)"
                            >
                                <Bold className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                variant={editor.isActive('italic') ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => editor.chain().focus().toggleItalic().run()}
                                className="h-9 w-9 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                                title="Italic (Ctrl+I)"
                            >
                                <Italic className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                variant={editor.isActive('underline') ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => editor.chain().focus().toggleUnderline().run()}
                                className="h-9 w-9 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                                title="Underline (Ctrl+U)"
                            >
                                <u className="text-xs font-semibold">U</u>
                            </Button>
                        </div>

                        {/* Headings Group */}
                        <div className="flex items-center gap-1 px-2 border-r border-gray-300 dark:border-gray-600">
                            <Button
                                type="button"
                                variant={editor.isActive('heading', { level: 1 }) ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                                className="h-9 w-9 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                                title="Heading 1"
                            >
                                <Heading1 className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                variant={editor.isActive('heading', { level: 2 }) ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                                className="h-9 w-9 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                                title="Heading 2"
                            >
                                <Heading2 className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                variant={editor.isActive('heading', { level: 3 }) ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                                className="h-9 w-9 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                                title="Heading 3"
                            >
                                <Heading3 className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Lists Group */}
                        <div className="flex items-center gap-1 px-2 border-r border-gray-300 dark:border-gray-600">
                            <Button
                                type="button"
                                variant={editor.isActive('bulletList') ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => editor.chain().focus().toggleBulletList().run()}
                                className="h-9 w-9 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                                title="Bullet List"
                            >
                                <List className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                variant={editor.isActive('orderedList') ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                                className="h-9 w-9 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                                title="Numbered List"
                            >
                                <ListOrdered className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Alignment Group */}
                        <div className="flex items-center gap-1 px-2 border-r border-gray-300 dark:border-gray-600">
                            <Button
                                type="button"
                                variant={editor.isActive({ textAlign: 'left' }) ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                                className="h-9 w-9 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                                title="Align Left"
                            >
                                <AlignLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                variant={editor.isActive({ textAlign: 'center' }) ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                                className="h-9 w-9 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                                title="Align Center"
                            >
                                <AlignCenter className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                variant={editor.isActive({ textAlign: 'right' }) ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                                className="h-9 w-9 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                                title="Align Right"
                            >
                                <AlignRight className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                variant={editor.isActive({ textAlign: 'justify' }) ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                                className="h-9 w-9 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                                title="Justify"
                            >
                                <AlignJustify className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Media & Formatting Group */}
                        <div className="flex items-center gap-1 px-2 border-r border-gray-300 dark:border-gray-600">
                            <Button
                                type="button"
                                variant={editor.isActive('blockquote') ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                                className="h-9 w-9 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                                title="Quote"
                            >
                                <Quote className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                variant={editor.isActive('code') ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => editor.chain().focus().toggleCode().run()}
                                className="h-9 w-9 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                                title="Inline Code"
                            >
                                <Code className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleSetLink}
                                className="h-9 w-9 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                                title="Insert Link"
                            >
                                <LinkIcon className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleSetImage}
                                className="h-9 w-9 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                                title="Insert Image"
                            >
                                <ImageIcon className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Table Group */}
                        <div className="flex items-center gap-1 px-2 border-r border-gray-300 dark:border-gray-600">
                            <Button
                                type="button"
                                variant={editor.isActive('table') ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                                className="h-9 w-9 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                                title="Insert Table"
                            >
                                <TableIcon className="h-4 w-4" />
                            </Button>
                            {editor.isActive('table') && (
                                <>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => editor.chain().focus().addRowAfter().run()}
                                        className="h-9 w-9 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                                        title="Add Row Below"
                                    >
                                        <Rows className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => editor.chain().focus().addColumnAfter().run()}
                                        className="h-9 w-9 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                                        title="Add Column Right"
                                    >
                                        <Columns className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => editor.chain().focus().deleteTable().run()}
                                        className="h-9 w-9 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                        title="Delete Table"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </>
                            )}
                        </div>

                        {/* History Group */}
                        <div className="flex items-center gap-1 pl-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().undo().run()}
                                disabled={!editor.can().undo()}
                                className="h-9 w-9 p-0 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
                                title="Undo (Ctrl+Z)"
                            >
                                <Undo className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().redo().run()}
                                disabled={!editor.can().redo()}
                                className="h-9 w-9 p-0 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
                                title="Redo (Ctrl+Y)"
                            >
                                <Redo className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Editor Content Area */}
                <div className="bg-white dark:bg-gray-900">
                    <EditorContent editor={editor} />
                </div>
            </div>

            {/* Link Dialog */}
            <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Insert Link</DialogTitle>
                        <DialogDescription>
                            Enter the URL you want to link to
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="link-url">URL</Label>
                            <Input
                                id="link-url"
                                placeholder="https://example.com"
                                value={linkUrl}
                                onChange={(e) => setLinkUrl(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        confirmLink()
                                    }
                                }}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setLinkDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={confirmLink}>
                            Insert Link
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Image Picker Dialog with Gallery Support */}
            <ImagePickerDialog
                open={imageDialogOpen}
                onOpenChange={setImageDialogOpen}
                onSelect={handleImageSelect}
                title="Insert Image"
                description="Choose an image from your gallery or enter a URL. You can upload new images from the Images Gallery page in the dashboard."
                allowUrlInput={true}
            />
        </>
    )
}
