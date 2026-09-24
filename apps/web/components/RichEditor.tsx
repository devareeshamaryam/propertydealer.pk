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
    Strikethrough,
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
    Trash2,
    Columns,
    Rows,
    Table as TableIcon,
    Minus,
    RemoveFormatting,
    Keyboard,
    Pilcrow,
    HelpCircle,
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

export type RichEditorProps = {
    value: any
    onChange: (value: string) => void
    placeholder?: string
    minHeight?: string
    stickyTopOffset?: string
    className?: string
}

/**
 * Safely converts incoming value to clean HTML.
 * If incoming content was saved as plain text from an old textarea with line breaks (\n)
 * or bullet points, it converts it to rich HTML (<p>, <ul>, <ol>) instead of collapsed text.
 */
export function normalizeRichContent(rawContent: any): string {
    if (!rawContent) return '<p></p>'
    if (typeof rawContent !== 'string') return String(rawContent)

    const trimmed = rawContent.trim()
    if (!trimmed) return '<p></p>'

    // Check if it already contains HTML tags (starts with < or contains HTML tags)
    const hasHtml = /<\/?([a-z][a-z0-9]*)\b[^>]*>/i.test(trimmed)
    if (hasHtml) {
        return trimmed
    }

    // It's plain text: parse into paragraphs and lists
    const blocks = trimmed.split(/\r?\n\r?\n+/)
    const htmlBlocks = blocks.map((block) => {
        const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
        if (!lines.length) return ''

        // Check if all lines are dash/bullet lists
        if (lines.length > 0 && lines.every((l) => /^[-*•]\s+/.test(l))) {
            const items = lines.map((l) => `<li>${l.replace(/^[-*•]\s+/, '').trim()}</li>`).join('')
            return `<ul>${items}</ul>`
        }

        // Check if numbered list
        if (lines.length > 0 && lines.every((l) => /^\d+[\.)]\s+/.test(l))) {
            const items = lines.map((l) => `<li>${l.replace(/^\d+[\.)]\s+/, '').trim()}</li>`).join('')
            return `<ol>${items}</ol>`
        }

        // Standard paragraph with line breaks preserved
        return `<p>${lines.join('<br>')}</p>`
    })

    return htmlBlocks.filter(Boolean).join('') || '<p></p>'
}

export default function RichEditor({
    value,
    onChange,
    placeholder = 'Start writing your content...',
    minHeight = 'min-h-[350px]',
    stickyTopOffset,
    className,
}: RichEditorProps) {
    const [mounted, setMounted] = useState(false)
    const [linkDialogOpen, setLinkDialogOpen] = useState(false)
    const [imageDialogOpen, setImageDialogOpen] = useState(false)
    const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false)
    const [linkUrl, setLinkUrl] = useState('')
    const [imageAlt, setImageAlt] = useState('')

    // Track what we last emitted to avoid cursor resets & race conditions
    const lastEmittedRef = useRef<string | null>(null)

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
                        class: 'list-disc pl-6 space-y-1 my-3',
                    },
                },
                orderedList: {
                    HTMLAttributes: {
                        class: 'list-decimal pl-6 space-y-1 my-3',
                    },
                },
                blockquote: {
                    HTMLAttributes: {
                        class: 'border-l-4 border-primary/70 bg-muted/30 px-4 py-2 italic my-4 rounded-r',
                    },
                },
                code: {
                    HTMLAttributes: {
                        class: 'bg-muted px-1.5 py-0.5 rounded font-mono text-sm text-primary',
                    },
                },
                codeBlock: {
                    HTMLAttributes: {
                        class: 'bg-gray-900 text-gray-100 p-4 rounded-lg my-4 font-mono text-sm overflow-x-auto',
                    },
                },
                horizontalRule: {
                    HTMLAttributes: {
                        class: 'my-6 border-t-2 border-border',
                    },
                },
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-blue-600 dark:text-blue-400 underline underline-offset-2 cursor-pointer font-medium hover:text-blue-800 dark:hover:text-blue-300',
                },
            }),
            Image.configure({
                inline: false,
                allowBase64: true,
                HTMLAttributes: {
                    class: 'max-w-full h-auto rounded-lg my-4 shadow-sm border border-border',
                },
            }),
            Underline,
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            Placeholder.configure({
                placeholder,
            }),
            Table.configure({
                resizable: true,
                HTMLAttributes: {
                    class: 'min-w-full divide-y divide-gray-200 dark:divide-gray-700 my-4 border rounded-md',
                },
            }),
            TableRow,
            TableHeader.configure({
                HTMLAttributes: {
                    class: 'bg-gray-100 dark:bg-gray-800 px-4 py-2.5 text-left text-sm font-semibold text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700',
                },
            }),
            TableCell.configure({
                HTMLAttributes: {
                    class: 'px-4 py-2 text-sm text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700',
                },
            }),
        ],
        content: normalizeRichContent(value),
        immediatelyRender: false,
        editorProps: {
            attributes: {
                class: `prose prose-sm sm:prose-base max-w-none focus:outline-none p-5 sm:p-6 text-foreground ${minHeight}`,
            },
            handleKeyDown: (view, event) => {
                const isMod = event.ctrlKey || event.metaKey
                const isAlt = event.altKey
                const isShift = event.shiftKey

                // ── Headings Shortcuts: Ctrl+Alt+1, Ctrl+Alt+2, Ctrl+Alt+3, Ctrl+Alt+0 ──
                if (isMod && isAlt && !isShift) {
                    if (event.key === '1') {
                        event.preventDefault()
                        editor?.chain().focus().toggleHeading({ level: 1 }).run()
                        return true
                    }
                    if (event.key === '2') {
                        event.preventDefault()
                        editor?.chain().focus().toggleHeading({ level: 2 }).run()
                        return true
                    }
                    if (event.key === '3') {
                        event.preventDefault()
                        editor?.chain().focus().toggleHeading({ level: 3 }).run()
                        return true
                    }
                    if (event.key === '0') {
                        event.preventDefault()
                        editor?.chain().focus().setParagraph().run()
                        return true
                    }
                }

                // ── Text Alignments: Ctrl+Shift+L, Ctrl+Shift+E, Ctrl+Shift+R, Ctrl+Shift+J ──
                if (isMod && isShift && !isAlt) {
                    const k = event.key.toLowerCase()
                    if (k === 'l') {
                        event.preventDefault()
                        editor?.chain().focus().setTextAlign('left').run()
                        return true
                    }
                    if (k === 'e') {
                        event.preventDefault()
                        editor?.chain().focus().setTextAlign('center').run()
                        return true
                    }
                    if (k === 'r') {
                        event.preventDefault()
                        editor?.chain().focus().setTextAlign('right').run()
                        return true
                    }
                    if (k === 'j') {
                        event.preventDefault()
                        editor?.chain().focus().setTextAlign('justify').run()
                        return true
                    }
                    if (k === 'q' || k === 'b') {
                        event.preventDefault()
                        editor?.chain().focus().toggleBlockquote().run()
                        return true
                    }
                    if (k === 'x') {
                        event.preventDefault()
                        editor?.chain().focus().toggleStrike().run()
                        return true
                    }
                    if (k === '8') {
                        event.preventDefault()
                        editor?.chain().focus().toggleBulletList().run()
                        return true
                    }
                    if (k === '7') {
                        event.preventDefault()
                        editor?.chain().focus().toggleOrderedList().run()
                        return true
                    }
                }

                // ── Insert Link: Ctrl+K ──
                if (isMod && !isAlt && !isShift && event.key.toLowerCase() === 'k') {
                    event.preventDefault()
                    handleSetLink()
                    return true
                }

                // ── Clear Formatting: Ctrl+\ ──
                if (isMod && event.key === '\\') {
                    event.preventDefault()
                    editor?.chain().focus().unsetAllMarks().clearNodes().run()
                    return true
                }

                return false
            },
        },
        onUpdate: ({ editor }) => {
            const html = editor.getHTML()
            lastEmittedRef.current = html
            onChange(html)
        },
    })

    // Sync external changes into editor (e.g. form.reset() or data loaded from API)
    useEffect(() => {
        if (!editor || value === undefined) return
        if (value === lastEmittedRef.current) return

        const normalized = normalizeRichContent(value)
        if (normalized === editor.getHTML()) return

        editor.commands.setContent(normalized, { emitUpdate: false })
    }, [value, editor])

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
        const imageUrl = image.url

        const getFullImageUrl = (url: string): string => {
            if (url.startsWith('http://') || url.startsWith('https://')) return url
            return url
        }

        const fullUrl = getFullImageUrl(imageUrl)
        const getAltText = (): string => {
            if (imageAlt) return imageAlt
            const key = 'key' in image ? image.key : (image as any).url
            const filename = key.split('/').pop() || key.split('\\').pop() || ''
            return filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || 'Image'
        }

        editor.chain().focus().setImage({
            src: fullUrl,
            alt: getAltText(),
        }).run()

        setImageDialogOpen(false)
        setImageAlt('')
    }

    if (!mounted || !editor) {
        return (
            <div className={`w-full border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-gray-950/50 flex flex-col items-center justify-center p-10 transition-all duration-300 ${minHeight}`}>
                <div className="relative">
                    <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <ImageIcon className="h-5 w-5 text-primary animate-pulse" />
                    </div>
                </div>
                <div className="mt-4 text-center">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Initializing Rich Editor</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Loading formatting tools and shortcuts...
                    </p>
                </div>
            </div>
        )
    }

    const editorText = editor.getText()
    const wordCount = editorText.trim() ? editorText.trim().split(/\s+/).length : 0
    const charCount = editorText.length

    return (
        <>
            <style>{`
                .tiptap-editor-wrap .tiptap h1 {
                    font-size: 1.875rem;
                    line-height: 2.25rem;
                    font-weight: 800;
                    letter-spacing: -0.025em;
                    margin-top: 1.5rem;
                    margin-bottom: 0.75rem;
                    color: inherit;
                }
                .tiptap-editor-wrap .tiptap h2 {
                    font-size: 1.5rem;
                    line-height: 2rem;
                    font-weight: 700;
                    letter-spacing: -0.02em;
                    margin-top: 1.25rem;
                    margin-bottom: 0.5rem;
                    color: inherit;
                }
                .tiptap-editor-wrap .tiptap h3 {
                    font-size: 1.25rem;
                    line-height: 1.75rem;
                    font-weight: 600;
                    margin-top: 1rem;
                    margin-bottom: 0.5rem;
                    color: inherit;
                }
                .tiptap-editor-wrap .tiptap p {
                    margin-top: 0.5rem;
                    margin-bottom: 0.5rem;
                    line-height: 1.7;
                    color: inherit;
                }
                .tiptap-editor-wrap .tiptap p.is-editor-empty:first-child::before {
                    content: attr(data-placeholder);
                    float: left;
                    color: #9ca3af;
                    pointer-events: none;
                    height: 0;
                }
            `}</style>

            <div className={`tiptap-editor-wrap rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xs transition-colors focus-within:border-primary/60 relative ${className || ''}`}>
                {/* ── Sticky Toolbar ────────────────────────────────────────────── */}
                <div
                    className={`sticky ${stickyTopOffset || 'top-0 sm:top-14'} z-20 rounded-t-lg border-b border-gray-200 dark:border-gray-700 bg-gray-50/95 dark:bg-gray-800/95 backdrop-blur-md px-2.5 sm:px-3 py-2 shadow-xs transition-all`}
                >
                    <div className="flex flex-wrap items-center gap-1">
                        {/* ── Headings Group ── */}
                        <div className="flex items-center gap-0.5 pr-1.5 border-r border-gray-300 dark:border-gray-600">
                            <Button
                                type="button"
                                variant={editor.isActive('paragraph') && !editor.isActive('heading') ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => editor.chain().focus().setParagraph().run()}
                                className="h-8 w-8 p-0"
                                title="Normal Text (Ctrl+Alt+0)"
                            >
                                <Pilcrow className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                type="button"
                                variant={editor.isActive('heading', { level: 1 }) ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                                className="h-8 w-8 p-0"
                                title="Heading 1 (Ctrl+Alt+1 or # + Space)"
                            >
                                <Heading1 className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                variant={editor.isActive('heading', { level: 2 }) ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                                className="h-8 w-8 p-0"
                                title="Heading 2 (Ctrl+Alt+2 or ## + Space)"
                            >
                                <Heading2 className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                variant={editor.isActive('heading', { level: 3 }) ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                                className="h-8 w-8 p-0"
                                title="Heading 3 (Ctrl+Alt+3 or ### + Space)"
                            >
                                <Heading3 className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* ── Inline Formatting Group ── */}
                        <div className="flex items-center gap-0.5 px-1.5 border-r border-gray-300 dark:border-gray-600">
                            <Button
                                type="button"
                                variant={editor.isActive('bold') ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => editor.chain().focus().toggleBold().run()}
                                className="h-8 w-8 p-0"
                                title="Bold (Ctrl+B)"
                            >
                                <Bold className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                type="button"
                                variant={editor.isActive('italic') ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => editor.chain().focus().toggleItalic().run()}
                                className="h-8 w-8 p-0"
                                title="Italic (Ctrl+I)"
                            >
                                <Italic className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                type="button"
                                variant={editor.isActive('underline') ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => editor.chain().focus().toggleUnderline().run()}
                                className="h-8 w-8 p-0"
                                title="Underline (Ctrl+U)"
                            >
                                <u className="text-xs font-bold leading-none">U</u>
                            </Button>
                            <Button
                                type="button"
                                variant={editor.isActive('strike') ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => editor.chain().focus().toggleStrike().run()}
                                className="h-8 w-8 p-0"
                                title="Strikethrough (Ctrl+Shift+X)"
                            >
                                <Strikethrough className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                type="button"
                                variant={editor.isActive('code') ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => editor.chain().focus().toggleCode().run()}
                                className="h-8 w-8 p-0"
                                title="Inline Code (Ctrl+E)"
                            >
                                <Code className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                title="Clear Formatting (Ctrl+\)"
                            >
                                <RemoveFormatting className="h-3.5 w-3.5" />
                            </Button>
                        </div>

                        {/* ── Alignment Group ── */}
                        <div className="flex items-center gap-0.5 px-1.5 border-r border-gray-300 dark:border-gray-600">
                            <Button
                                type="button"
                                variant={editor.isActive({ textAlign: 'left' }) ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                                className="h-8 w-8 p-0"
                                title="Align Left (Ctrl+Shift+L)"
                            >
                                <AlignLeft className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                type="button"
                                variant={editor.isActive({ textAlign: 'center' }) ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                                className="h-8 w-8 p-0"
                                title="Align Center (Ctrl+Shift+E)"
                            >
                                <AlignCenter className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                type="button"
                                variant={editor.isActive({ textAlign: 'right' }) ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                                className="h-8 w-8 p-0"
                                title="Align Right (Ctrl+Shift+R)"
                            >
                                <AlignRight className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                type="button"
                                variant={editor.isActive({ textAlign: 'justify' }) ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                                className="h-8 w-8 p-0"
                                title="Justify (Ctrl+Shift+J)"
                            >
                                <AlignJustify className="h-3.5 w-3.5" />
                            </Button>
                        </div>

                        {/* ── Lists & Blocks Group ── */}
                        <div className="flex items-center gap-0.5 px-1.5 border-r border-gray-300 dark:border-gray-600">
                            <Button
                                type="button"
                                variant={editor.isActive('bulletList') ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => editor.chain().focus().toggleBulletList().run()}
                                className="h-8 w-8 p-0"
                                title="Bullet List (Ctrl+Shift+8 or - + Space)"
                            >
                                <List className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                type="button"
                                variant={editor.isActive('orderedList') ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                                className="h-8 w-8 p-0"
                                title="Numbered List (Ctrl+Shift+7 or 1. + Space)"
                            >
                                <ListOrdered className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                type="button"
                                variant={editor.isActive('blockquote') ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                                className="h-8 w-8 p-0"
                                title="Quote (Ctrl+Shift+Q or > + Space)"
                            >
                                <Quote className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                                className="h-8 w-8 p-0"
                                title="Horizontal Rule (--- + Enter)"
                            >
                                <Minus className="h-3.5 w-3.5" />
                            </Button>
                        </div>

                        {/* ── Media & Inserts Group ── */}
                        <div className="flex items-center gap-0.5 px-1.5 border-r border-gray-300 dark:border-gray-600">
                            <Button
                                type="button"
                                variant={editor.isActive('link') ? 'default' : 'ghost'}
                                size="sm"
                                onClick={handleSetLink}
                                className="h-8 w-8 p-0"
                                title="Insert Link (Ctrl+K)"
                            >
                                <LinkIcon className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleSetImage}
                                className="h-8 w-8 p-0"
                                title="Insert Image from Gallery"
                            >
                                <ImageIcon className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                type="button"
                                variant={editor.isActive('table') ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                                className="h-8 w-8 p-0"
                                title="Insert Table"
                            >
                                <TableIcon className="h-3.5 w-3.5" />
                            </Button>

                            {editor.isActive('table') && (
                                <>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => editor.chain().focus().addRowAfter().run()}
                                        className="h-8 w-8 p-0"
                                        title="Add Row Below"
                                    >
                                        <Rows className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => editor.chain().focus().addColumnAfter().run()}
                                        className="h-8 w-8 p-0"
                                        title="Add Column Right"
                                    >
                                        <Columns className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => editor.chain().focus().deleteTable().run()}
                                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                        title="Delete Table"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </>
                            )}
                        </div>

                        {/* ── History & Shortcuts Help ── */}
                        <div className="flex items-center gap-0.5 pl-1.5 ml-auto">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().undo().run()}
                                disabled={!editor.can().undo()}
                                className="h-8 w-8 p-0 disabled:opacity-40"
                                title="Undo (Ctrl+Z)"
                            >
                                <Undo className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().redo().run()}
                                disabled={!editor.can().redo()}
                                className="h-8 w-8 p-0 disabled:opacity-40"
                                title="Redo (Ctrl+Y)"
                            >
                                <Redo className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setShortcutsDialogOpen(true)}
                                className="h-8 px-2 text-xs flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground border-border/80"
                                title="View Keyboard Shortcuts"
                            >
                                <Keyboard className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Shortcuts</span>
                            </Button>
                        </div>
                    </div>
                </div>

                {/* ── Editor Content Area ───────────────────────────────────────── */}
                <div className="bg-white dark:bg-gray-900 rounded-b-lg">
                    <EditorContent editor={editor} />
                </div>

                {/* ── Bottom Status Bar ─────────────────────────────────────────── */}
                <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 bg-gray-50/90 dark:bg-gray-800/90 px-4 py-1.5 text-xs text-muted-foreground select-none rounded-b-lg">
                    <div className="flex items-center gap-2">
                        <span>{wordCount} words</span>
                        <span>•</span>
                        <span>{charCount} characters</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShortcutsDialogOpen(true)}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                        <HelpCircle className="h-3 w-3" />
                        <span>Shortcuts Guide</span>
                    </button>
                </div>
            </div>

            {/* ── Link Dialog ─────────────────────────────────────────────────── */}
            <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Insert Link</DialogTitle>
                        <DialogDescription>
                            Enter the web URL you want to link to.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-3">
                        <div className="grid gap-2">
                            <Label htmlFor="link-url">URL</Label>
                            <Input
                                id="link-url"
                                placeholder="https://propertydealer.pk/..."
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

            {/* ── Image Picker Dialog with Gallery Support ───────────────────── */}
            <ImagePickerDialog
                open={imageDialogOpen}
                onOpenChange={setImageDialogOpen}
                onSelect={handleImageSelect}
                title="Insert Image"
                description="Choose an image from your gallery or enter a URL. Upload new images anytime from Dashboard > Images Gallery."
                allowUrlInput={true}
            />

            {/* ── Keyboard Shortcuts Guide Dialog ────────────────────────────── */}
            <Dialog open={shortcutsDialogOpen} onOpenChange={setShortcutsDialogOpen}>
                <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                <Keyboard className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl">Editor Keyboard Shortcuts</DialogTitle>
                                <DialogDescription>
                                    Supercharge your writing with fast keyboard shortcuts and Markdown triggers.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="space-y-5 py-2 text-sm">
                        {/* Headings */}
                        <div className="space-y-2">
                            <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider text-primary">Headings & Styles</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                <div className="flex items-center justify-between p-2 rounded-md bg-muted/50 border border-border/50">
                                    <span>Heading 1</span>
                                    <span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border font-medium">Ctrl + Alt + 1 <span className="text-muted-foreground">or #</span></span>
                                </div>
                                <div className="flex items-center justify-between p-2 rounded-md bg-muted/50 border border-border/50">
                                    <span>Heading 2</span>
                                    <span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border font-medium">Ctrl + Alt + 2 <span className="text-muted-foreground">or ##</span></span>
                                </div>
                                <div className="flex items-center justify-between p-2 rounded-md bg-muted/50 border border-border/50">
                                    <span>Heading 3</span>
                                    <span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border font-medium">Ctrl + Alt + 3 <span className="text-muted-foreground">or ###</span></span>
                                </div>
                                <div className="flex items-center justify-between p-2 rounded-md bg-muted/50 border border-border/50">
                                    <span>Normal Text</span>
                                    <span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border font-medium">Ctrl + Alt + 0</span>
                                </div>
                            </div>
                        </div>

                        {/* Formatting */}
                        <div className="space-y-2">
                            <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider text-primary">Text Formatting</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                <div className="flex items-center justify-between p-2 rounded-md bg-muted/50 border border-border/50">
                                    <span className="font-bold">Bold</span>
                                    <span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border font-medium">Ctrl + B</span>
                                </div>
                                <div className="flex items-center justify-between p-2 rounded-md bg-muted/50 border border-border/50">
                                    <span className="italic">Italic</span>
                                    <span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border font-medium">Ctrl + I</span>
                                </div>
                                <div className="flex items-center justify-between p-2 rounded-md bg-muted/50 border border-border/50">
                                    <span className="underline">Underline</span>
                                    <span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border font-medium">Ctrl + U</span>
                                </div>
                                <div className="flex items-center justify-between p-2 rounded-md bg-muted/50 border border-border/50">
                                    <span className="line-through">Strikethrough</span>
                                    <span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border font-medium">Ctrl + Shift + X</span>
                                </div>
                                <div className="flex items-center justify-between p-2 rounded-md bg-muted/50 border border-border/50">
                                    <span>Inline Code</span>
                                    <span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border font-medium">Ctrl + E</span>
                                </div>
                                <div className="flex items-center justify-between p-2 rounded-md bg-muted/50 border border-border/50">
                                    <span>Clear Formatting</span>
                                    <span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border font-medium">Ctrl + \</span>
                                </div>
                            </div>
                        </div>

                        {/* Lists & Alignment */}
                        <div className="space-y-2">
                            <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider text-primary">Lists & Blocks</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                <div className="flex items-center justify-between p-2 rounded-md bg-muted/50 border border-border/50">
                                    <span>Bullet List</span>
                                    <span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border font-medium">Ctrl + Shift + 8 <span className="text-muted-foreground">or -</span></span>
                                </div>
                                <div className="flex items-center justify-between p-2 rounded-md bg-muted/50 border border-border/50">
                                    <span>Numbered List</span>
                                    <span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border font-medium">Ctrl + Shift + 7 <span className="text-muted-foreground">or 1.</span></span>
                                </div>
                                <div className="flex items-center justify-between p-2 rounded-md bg-muted/50 border border-border/50">
                                    <span>Blockquote</span>
                                    <span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border font-medium">Ctrl + Shift + Q <span className="text-muted-foreground">or &gt;</span></span>
                                </div>
                                <div className="flex items-center justify-between p-2 rounded-md bg-muted/50 border border-border/50">
                                    <span>Divider Line</span>
                                    <span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border font-medium">--- + Enter</span>
                                </div>
                                <div className="flex items-center justify-between p-2 rounded-md bg-muted/50 border border-border/50">
                                    <span>Insert Link</span>
                                    <span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border font-medium">Ctrl + K</span>
                                </div>
                                <div className="flex items-center justify-between p-2 rounded-md bg-muted/50 border border-border/50">
                                    <span>Undo / Redo</span>
                                    <span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border font-medium">Ctrl + Z / Ctrl + Y</span>
                                </div>
                            </div>
                        </div>

                        {/* Alignment */}
                        <div className="space-y-2">
                            <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider text-primary">Text Alignment</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                <div className="p-2 rounded-md bg-muted/50 border border-border/50 text-center">
                                    <div className="text-muted-foreground">Left</div>
                                    <div className="font-mono font-medium mt-1">Ctrl+Shift+L</div>
                                </div>
                                <div className="p-2 rounded-md bg-muted/50 border border-border/50 text-center">
                                    <div className="text-muted-foreground">Center</div>
                                    <div className="font-mono font-medium mt-1">Ctrl+Shift+E</div>
                                </div>
                                <div className="p-2 rounded-md bg-muted/50 border border-border/50 text-center">
                                    <div className="text-muted-foreground">Right</div>
                                    <div className="font-mono font-medium mt-1">Ctrl+Shift+R</div>
                                </div>
                                <div className="p-2 rounded-md bg-muted/50 border border-border/50 text-center">
                                    <div className="text-muted-foreground">Justify</div>
                                    <div className="font-mono font-medium mt-1">Ctrl+Shift+J</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" onClick={() => setShortcutsDialogOpen(false)}>
                            Got it
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}