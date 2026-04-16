"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
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
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import areaApi from "@/lib/api/area/area.api";
import cityApi from "@/lib/api/city/city.api";
import { toTitleCase } from "@/lib/utils";

// Zod schema
const formSchema = z.object({
  name: z.string().min(2, { message: "Area name must be at least 2 characters" }),
  areaSlug: z.string().min(1, { message: "Area slug is required" }),
  city: z.string().min(1, { message: "Please select a city" }),
  // General SEO
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  canonicalUrl: z.string().optional(),
  description: z.string().optional(),
  // Rent-specific
  rentMetaTitle: z.string().optional(),
  rentMetaDescription: z.string().optional(),
  rentContent: z.string().optional(),
  // Sale-specific
  saleMetaTitle: z.string().optional(),
  saleMetaDescription: z.string().optional(),
  saleContent: z.string().optional(),
});

export default function AddAreaPage() {
  const router = useRouter();
  const [cities, setCities] = useState<Array<{ _id: string; name: string; state: string; country: string }>>([]);
  const [loadingCities, setLoadingCities] = useState(true);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "", areaSlug: "", city: "",
      metaTitle: "", metaDescription: "", canonicalUrl: "", description: "",
      rentMetaTitle: "", rentMetaDescription: "", rentContent: "",
      saleMetaTitle: "", saleMetaDescription: "", saleContent: "",
    },
  });

  const isLoading = form.formState.isSubmitting;

  useEffect(() => {
    cityApi.getAll()
      .then(setCities)
      .catch(() => toast.error("Error", { description: "Failed to load cities." }))
      .finally(() => setLoadingCities(false));
  }, []);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      await areaApi.create({
        name: toTitleCase(values.name),
        areaSlug: values.areaSlug,
        city: values.city,
        metaTitle: values.metaTitle?.trim() || undefined,
        metaDescription: values.metaDescription?.trim() || undefined,
        canonicalUrl: values.canonicalUrl?.trim() || undefined,
        description: values.description?.trim() || undefined,
        rentMetaTitle: values.rentMetaTitle?.trim() || undefined,
        rentMetaDescription: values.rentMetaDescription?.trim() || undefined,
        rentContent: values.rentContent?.trim() || undefined,
        saleMetaTitle: values.saleMetaTitle?.trim() || undefined,
        saleMetaDescription: values.saleMetaDescription?.trim() || undefined,
        saleContent: values.saleContent?.trim() || undefined,
      });
      toast.success("Area created successfully!");
      form.reset();
      router.refresh();
    } catch (error: any) {
      toast.error("Error", { description: error?.response?.data?.message || error?.message || "Failed to create area." });
    }
  }

  return (
    <div className="w-full">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Add New Area</h1>
          <p className="text-gray-600 mb-8">Add an area to a city to make it available for property listings.</p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              {/* City Selection */}
              <FormField control={form.control} name="city" render={({ field }) => (
                <FormItem>
                  <FormLabel>City *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isLoading || loadingCities}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={loadingCities ? "Loading cities..." : "Select a city"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {cities.map((city) => (
                        <SelectItem key={String(city._id)} value={String(city._id)}>
                          {city.name}{city.state ? `, ${city.state}` : ''}{city.country ? `, ${city.country}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Area Name */}
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Area Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. DHA Phase 5" {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        const slug = e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
                        form.setValue('areaSlug', slug);
                        form.setValue('canonicalUrl', `https://propertydealer.pk/area/${slug}`);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Area Slug */}
              <FormField control={form.control} name="areaSlug" render={({ field }) => (
                <FormItem>
                  <FormLabel>Area Slug *</FormLabel>
                  <FormControl><Input placeholder="e.g. dha-phase-5" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* ── General SEO ── */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 space-y-4">
                <h3 className="text-lg font-semibold text-gray-700">General SEO</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="metaTitle" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meta Title</FormLabel>
                      <FormControl><Input placeholder="SEO Title" {...field} value={field.value || ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="canonicalUrl" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Canonical URL</FormLabel>
                      <FormControl><Input placeholder="https://example.com/area" {...field} value={field.value || ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="metaDescription" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meta Description</FormLabel>
                    <FormControl><Input placeholder="SEO Description" {...field} value={field.value || ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Area Description (Rich Text – General)</FormLabel>
                    <FormControl>
                      <RichEditor value={field.value || ""} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* ── Rent SEO & Content ── */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-blue-700">Rent Page SEO & Content</h3>
                  <p className="text-sm text-blue-500">Shown on /properties/rent/city/area pages. If left empty, general SEO is used.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="rentMetaTitle" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-blue-700">Rent Meta Title</FormLabel>
                      <FormControl><Input placeholder="e.g. Houses for Rent in DHA Phase 5" {...field} value={field.value || ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="rentMetaDescription" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-blue-700">Rent Meta Description</FormLabel>
                      <FormControl><Input placeholder="Rent meta description" {...field} value={field.value || ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="rentContent" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-blue-700">Rent Content (Rich Text)</FormLabel>
                    <FormControl>
                      <RichEditor value={field.value || ""} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* ── Sale SEO & Content ── */}
              <div className="p-4 bg-green-50 rounded-lg border border-green-100 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-green-700">Sale Page SEO & Content</h3>
                  <p className="text-sm text-green-500">Shown on /properties/sale/city/area pages. If left empty, general SEO is used.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="saleMetaTitle" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-green-700">Sale Meta Title</FormLabel>
                      <FormControl><Input placeholder="e.g. Houses for Sale in DHA Phase 5" {...field} value={field.value || ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="saleMetaDescription" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-green-700">Sale Meta Description</FormLabel>
                      <FormControl><Input placeholder="Sale meta description" {...field} value={field.value || ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="saleContent" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-green-700">Sale Content (Rich Text)</FormLabel>
                    <FormControl>
                      <RichEditor value={field.value || ""} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Submit */}
              <div className="flex gap-4 pt-6">
                <Button type="submit" disabled={isLoading || loadingCities} className="flex-1 bg-gray-800 hover:bg-gray-900">
                  {isLoading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Creating...</> : "Add Area"}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>Cancel</Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
