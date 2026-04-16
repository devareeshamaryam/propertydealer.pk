'use client'

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Image as ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
const RichEditor = dynamic(() => import("@/components/RichEditor"), {
    ssr: false,
    loading: () => <div className="h-[200px] w-full bg-gray-100 animate-pulse rounded-lg flex items-center justify-center text-gray-400">Loading Editor...</div>
});
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
import blogApi from "@/lib/api/blog/blog.api";
import blogCategoryApi from "@/lib/api/blog-category/blog-category.api";
import { ImagePickerDialog, type GalleryImageItem } from "@/components/ImagePickerDialog";

// Custom validation for image URLs - accepts full URLs or relative paths starting with /uploads/
const imageUrlSchema = z.string().refine(
    (val) => {
        if (!val || val === "") return true; // Empty is allowed
        // Accept full URLs (http/https) or relative paths starting with /uploads/
        return z.string().url().safeParse(val).success || val.startsWith("/uploads/");
    },
    { message: "Must be a valid URL or a path starting with /uploads/" }
).optional().or(z.literal(""));

const formSchema = z.object({
    title: z.string().min(2, { message: "Title must be at least 2 characters long" }),
    slug: z.string().optional(),
    content: z.string().min(10, { message: "Content must be at least 10 characters long" }),
    excerpt: z.string().optional(),
    tags: z.string().optional(),
    featuredImage: imageUrlSchema,
    status: z.enum(['draft', 'published']).optional(),
    metaTitle: z.string().optional(),
    metaDescription: z.string().max(160, { message: "Meta description must be at most 160 characters" }).optional(),
    canonicalUrl: z.string().url().optional().or(z.literal("")),
    categoryId: z.string().optional(),
});

export default function AddBlogPage() {
    const router = useRouter();
    const [categories, setCategories] = useState<any[]>([]);
    const [loadingCategories, setLoadingCategories] = useState(true);
    const [imagePickerOpen, setImagePickerOpen] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: "",
            slug: "",
            content: "",
            excerpt: "",
            tags: "",
            featuredImage: "",
            status: "draft",
            metaTitle: "",
            metaDescription: "",
            canonicalUrl: "",
            categoryId: "none",
        },
    });

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const data = await blogCategoryApi.getAllCategories();
                setCategories(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error("Error fetching categories:", error);
            } finally {
                setLoadingCategories(false);
            }
        };
        fetchCategories();
    }, []);

    const onSubmit = async (data: z.infer<typeof formSchema>) => {
        try {
            const payload: any = {
                title: data.title.trim(),
                content: data.content.trim(),
                excerpt: data.excerpt?.trim() || undefined,
                status: data.status || 'draft',
                metaTitle: data.metaTitle?.trim() || undefined,
                metaDescription: data.metaDescription?.trim() || undefined,
                featuredImage: data.featuredImage?.trim() || undefined,
                canonicalUrl: data.canonicalUrl?.trim() || undefined,
            };

            // Slug will be auto-generated from title by the backend schema pre-save hook
            // Don't send slug - let backend handle it

            // Parse tags from comma-separated string
            if (data.tags && data.tags.trim()) {
                payload.tags = data.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
            }

            if (data.categoryId && data.categoryId !== "none") {
                payload.categoryId = data.categoryId;
            }

            console.log('Creating blog with payload:', payload);

            const response = await blogApi.createBlog(payload);

            if (response.status === 201 || response.status === 200) {
                toast.success("Blog created successfully");
                form.reset();
                router.push("/dashboard/blog");
            } else {
                toast.error("Failed to create blog", {
                    description: `Status: ${response.status}`,
                });
            }
        } catch (error: any) {
            console.error("Error creating blog:", error);
            const errorMessage = error?.response?.data?.message ||
                error?.message ||
                "Failed to create blog. Please check all required fields.";
            toast.error("Error creating blog", {
                description: errorMessage,
            });
        }
    };

    return (
        <>
            <div className="w-full">
                <div className="max-w-5xl mx-auto">
                    <div className="bg-white rounded-xl shadow-lg p-8">
                        <h1 className="text-3xl font-bold text-gray-800 mb-2">Add New Blog Post</h1>
                        <p className="text-gray-600 mb-8">
                            Create a new blog post for your website.
                        </p>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <FormField control={form.control} name="title" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Title *</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="e.g How to Buy Your First Home"
                                                {...field}
                                                onChange={(e) => {
                                                    field.onChange(e);
                                                    // Auto-generate slug and canonical URL from title
                                                    const slug = e.target.value
                                                        .toLowerCase()
                                                        .trim()
                                                        .replace(/[^a-z0-9]+/g, '-')
                                                        .replace(/^-+|-+$/g, '');
                                                    form.setValue('slug', slug);
                                                    if (slug) {
                                                        form.setValue('canonicalUrl', `https://propertydealer.pk/blog/${slug}`);
                                                    }
                                                }}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <FormField control={form.control} name="slug" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Slug (Auto-generated)</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="auto-generated-from-title"
                                                {...field}
                                                className="bg-gray-50 text-gray-600"
                                                readOnly
                                            />
                                        </FormControl>
                                        <p className="text-xs text-gray-500 mt-1">
                                            URL: https://propertydealer.pk/blog/{field.value || 'slug'}
                                        </p>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <FormField control={form.control} name="excerpt" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Excerpt</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="A brief summary of the blog post (150-160 characters recommended)"
                                                rows={3}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                {/* <FormField control={form.control} name="content" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Content *</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Write your blog post content here..."
                                                rows={15}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} /> */}

                                {/* rich editor */}
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
                                    <FormField control={form.control} name="status" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Status</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select status" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="draft">Draft</SelectItem>
                                                    <SelectItem value="published">Published</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <FormField control={form.control} name="categoryId" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Category</FormLabel>
                                            <Select
                                                onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                                                value={field.value || "none"}
                                                disabled={loadingCategories}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select category (optional)" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="none">None</SelectItem>
                                                    {categories.map((category) => (
                                                        <SelectItem key={category._id} value={category._id}>
                                                            {category.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>

                                <FormField control={form.control} name="tags" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tags (comma-separated)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g real estate, property, home" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <FormField control={form.control} name="featuredImage" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Featured Image</FormLabel>
                                        <FormControl>
                                            <div className="space-y-2">
                                                <div className="flex gap-2">
                                                    <Input
                                                        placeholder="https://example.com/image.jpg"
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
                                )} />

                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="metaTitle" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Meta Title (SEO)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="SEO title" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <FormField control={form.control} name="metaDescription" render={({ field }) => (
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
                                    )} />
                                </div>

                                <FormField control={form.control} name="canonicalUrl" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Canonical URL (Auto-generated)</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="https://propertydealer.pk/blog/auto-generated"
                                                {...field}
                                                className="bg-gray-50 text-gray-600"
                                                readOnly
                                            />
                                        </FormControl>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Auto-generated from title for SEO
                                        </p>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <div className="flex gap-4 pt-6">
                                    <Button
                                        type="submit"
                                        className="flex-1"
                                        disabled={form.formState.isSubmitting}
                                    >
                                        {form.formState.isSubmitting ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Creating...
                                            </>
                                        ) : "Create Blog Post"}
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
                description="Choose an existing image from the gallery to use as the featured image for this blog post."
            />
        </>
    )
}

