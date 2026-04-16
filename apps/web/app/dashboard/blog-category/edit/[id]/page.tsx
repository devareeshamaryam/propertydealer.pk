'use client'

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
const RichEditor = dynamic(() => import("@/components/RichEditor"), {
    ssr: false,
    loading: () => <div className="h-[200px] w-full bg-gray-100 animate-pulse rounded-lg flex items-center justify-center text-gray-400">Loading Editor...</div>
});
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
import blogCategoryApi from "@/lib/api/blog-category/blog-category.api";

const formSchema = z.object({
    name: z.string().min(2, { message: "Name must be at least 2 characters long" }),
    slug: z.string().optional(),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    canonicalUrl: z.string().optional(),
    description: z.string().optional(),
});

export default function EditCategoryPage() {
    const router = useRouter();
    const params = useParams();
    const categoryId = params?.id as string;
    const [loading, setLoading] = useState(true);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            slug: "",
            metaTitle: "",
            metaDescription: "",
            canonicalUrl: "",
            description: "",
        },
    });

    useEffect(() => {
        const fetchCategory = async () => {
            if (!categoryId) return;

            try {
                setLoading(true);
                const category = await blogCategoryApi.getCategoryById(categoryId);
                form.reset({
                    name: category.name || "",
                    slug: category.slug || "",
                    metaTitle: category.metaTitle || "",
                    metaDescription: category.metaDescription || "",
                    canonicalUrl: category.canonicalUrl || "",
                    description: category.description || "",
                });
            } catch (error: any) {
                console.error("Error fetching category:", error);
                toast.error("Error", {
                    description: error?.response?.data?.message || "Failed to load category.",
                });
                router.push("/dashboard/blog-category");
            } finally {
                setLoading(false);
            }
        };

        fetchCategory();
    }, [categoryId, form, router]);

    const onSubmit = async (data: z.infer<typeof formSchema>) => {
        if (!categoryId) return;

        try {
            await blogCategoryApi.updateCategory(categoryId, data);
            toast.success("Category updated successfully");
            router.push("/dashboard/blog-category");
        } catch (error: any) {
            console.error("Error updating category:", error);
            toast.error("Error", {
                description: error?.response?.data?.message || "Failed to update category",
            });
        }
    };

    if (loading) {
        return (
            <div className="w-full flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="ml-3 text-gray-600">Loading category...</span>
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="max-w-5xl mx-auto">
                <div className="bg-white rounded-xl shadow-lg p-8">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Edit Blog Category</h1>
                    <p className="text-gray-600 mb-8">
                        Update the category information below.
                    </p>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Category Name *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g Property" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                            />

                            <FormField control={form.control} name="slug" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Slug</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g property-category" {...field} />
                                    </FormControl>
                                </FormItem>
                            )}
                            />
                            <FormField control={form.control} name="description" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description (Rich Text)</FormLabel>
                                    <FormControl>
                                        <RichEditor
                                            value={field.value || ""}
                                            onChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                            />

                            <FormField control={form.control} name="metaTitle" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Meta Title</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g Property Category" {...field} />
                                    </FormControl>
                                </FormItem>
                            )}
                            />
                            <FormField control={form.control} name="metaDescription" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Meta Description</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="e.g Property Category Description" {...field} />
                                    </FormControl>
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
                                    ) : "Update Category"}
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
    )
}

