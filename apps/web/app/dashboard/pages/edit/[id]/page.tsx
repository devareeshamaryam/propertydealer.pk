'use client'

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Image as ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage,
    FormLabel
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { pageApi } from "@/lib/api/page/page.api";
import { ImagePickerDialog, type GalleryImageItem } from "@/components/ImagePickerDialog";
import dynamic from "next/dynamic";
const RichEditor = dynamic(() => import("@/components/RichEditor"), {
    ssr: false,
    loading: () => <div className="h-[200px] w-full bg-gray-100 animate-pulse rounded-lg flex items-center justify-center text-gray-400">Loading Editor...</div>
});

// Custom validation for image URLs - accepts full URLs or relative paths starting with /uploads/
const imageUrlSchema = z.string().refine(
    (val) => {
        if (!val || val === "") return true; // Empty is allowed
        // Accept full URLs (http/https) or relative paths starting with /uploads/
        return z.string().url().safeParse(val).success || val.startsWith("/uploads/");
    },
    { message: "Must be a valid URL or a path starting with /uploads/" }
).optional().or(z.literal(""));

// Helper function to generate slug from title
const generateSlug = (title: string): string => {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || '';
}

const formSchema = z.object({
    title: z.string().min(2, { message: "Title must be at least 2 characters long" }),
    slug: z.string().optional(),
    content: z.string().min(10, { message: "Content must be at least 10 characters long" }),
    excerpt: z.string().optional(),
    featuredImage: imageUrlSchema,
    status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
    metaTitle: z.string().optional(),
    metaDescription: z.string().max(160, { message: "Meta description must be at most 160 characters" }).optional(),
    canonicalUrl: z.string().url().optional().or(z.literal("")),
    keywords: z.string().optional(),
});

export default function EditPagePage() {
    const router = useRouter();
    const params = useParams();
    const pageId = params?.id as string;
    const [loading, setLoading] = useState(true);
    const [imagePickerOpen, setImagePickerOpen] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: "",
            slug: "",
            content: "",
            excerpt: "",
            featuredImage: "",
            status: "DRAFT",
            metaTitle: "",
            metaDescription: "",
            canonicalUrl: "",
            keywords: "",
        },
    });

    useEffect(() => {
        const fetchPage = async () => {
            if (!pageId) return;
            try {
                setLoading(true);
                const page = await pageApi.getPageById(pageId);
                form.reset({
                    title: page.title || "",
                    slug: page.slug || "",
                    content: page.content || "",
                    excerpt: page.excerpt || "",
                    featuredImage: page.featuredImage || "",
                    status: (page.status as 'DRAFT' | 'PUBLISHED') || "DRAFT",
                    metaTitle: page.metaTitle || "",
                    metaDescription: page.metaDescription || "",
                    canonicalUrl: page.canonicalUrl || "",
                    keywords: page.keywords?.join(', ') || "",
                });
            } catch (error: any) {
                console.error("Error fetching page:", error);
                toast.error("Error", {
                    description: error?.response?.data?.message || "Failed to load page",
                });
                router.push("/dashboard/pages");
            } finally {
                setLoading(false);
            }
        };
        fetchPage();
    }, [pageId, form, router]);

    const onSubmit = async (data: z.infer<typeof formSchema>) => {
        if (!pageId) return;
        try {
            const payload: any = {
                title: data.title.trim(),
                content: data.content.trim(),
                excerpt: data.excerpt?.trim() || undefined,
                status: data.status || 'DRAFT',
                metaTitle: data.metaTitle?.trim() || undefined,
                metaDescription: data.metaDescription?.trim() || undefined,
                featuredImage: data.featuredImage?.trim() || undefined,
                canonicalUrl: data.canonicalUrl?.trim() || undefined,
            };

            // Parse keywords from comma-separated string
            if (data.keywords && data.keywords.trim()) {
                payload.keywords = data.keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
            }

            // Send slug if provided, otherwise backend will auto-generate from title
            if (data.slug && data.slug.trim()) {
                payload.slug = data.slug.trim().toLowerCase();
            }

            await pageApi.updatePage(pageId, payload);
            toast.success("Page updated successfully");
            router.push("/dashboard/pages");
        } catch (error: any) {
            console.error("Error updating page:", error);
            toast.error("Error", {
                description: error?.response?.data?.message || "Failed to update page",
            });
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <>
            <div className="w-full">
                <div className="max-w-5xl mx-auto">
                    <div className="bg-white rounded-xl shadow-lg p-8">
                        <h1 className="text-3xl font-bold text-gray-800 mb-2">Edit Page</h1>
                        <p className="text-gray-600 mb-8">
                            Update page content and SEO settings.
                        </p>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <FormField
                                    control={form.control}
                                    name="title"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Title *</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="e.g About Us"
                                                    {...field}
                                                    onChange={(e) => {
                                                        field.onChange(e);
                                                        // Auto-generate slug from title
                                                        const autoSlug = generateSlug(e.target.value);
                                                        if (autoSlug) {
                                                            form.setValue('slug', autoSlug);
                                                        }
                                                    }}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="slug"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Slug (Auto-generated from title)</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="e.g about-us"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <p className="text-sm text-muted-foreground">
                                                URL-friendly version of the title. Auto-generated but can be edited.
                                            </p>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="excerpt"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Excerpt</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="A brief summary of the page (150-160 characters recommended)"
                                                    rows={3}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="content"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Content *</FormLabel>
                                            <FormControl>
                                                <RichEditor value={field.value} onChange={field.onChange} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="status"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Status</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select status" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="DRAFT">Draft</SelectItem>
                                                        <SelectItem value="PUBLISHED">Published</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="keywords"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Keywords (comma-separated)</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g real estate, property, home" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="featuredImage"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Featured Image</FormLabel>
                                            <FormControl>
                                                <div className="space-y-2">
                                                    <div className="flex gap-2">
                                                        <Input
                                                            placeholder="https://example.com/image.jpg or /uploads/..."
                                                            {...field}
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => setImagePickerOpen(true)}
                                                            title="Choose from gallery"
                                                        >
                                                            <ImageIcon className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                    {field.value && (
                                                        <div className="flex items-center gap-3 mt-2">
                                                            <div className="w-16 h-16 rounded-md overflow-hidden bg-muted">
                                                                <img
                                                                    src={field.value}
                                                                    alt="Featured preview"
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            </div>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => field.onChange("")}
                                                            >
                                                                Remove image
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="metaTitle"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Meta Title (SEO)</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="SEO title" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="metaDescription"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Meta Description (SEO)</FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        placeholder="SEO description (max 160 characters)"
                                                        rows={2}
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="canonicalUrl"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Canonical URL (SEO)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="https://example.com/page" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="flex gap-4 pt-6">
                                    <Button
                                        type="submit"
                                        className="flex-1"
                                        disabled={form.formState.isSubmitting}
                                    >
                                        {form.formState.isSubmitting ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Updating...
                                            </>
                                        ) : "Update Page"}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => router.back()}
                                        disabled={form.formState.isSubmitting}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </div>
                </div>
            </div>
            <ImagePickerDialog
                open={imagePickerOpen}
                onOpenChange={setImagePickerOpen}
                onSelect={(image: GalleryImageItem) => {
                    const url = image.url;
                    form.setValue("featuredImage", url, { shouldValidate: true });
                }}
                title="Select Featured Image"
                description="Choose an existing image from the gallery to use as the featured image for this page."
            />
        </>
    );
}

