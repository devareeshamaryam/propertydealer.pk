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
import { ImagePickerDialog } from "@/components/ImagePickerDialog";
import { Image as ImageIcon, X } from "lucide-react";
import { useState } from "react";

// Assuming this is your API client (adjust path/name if different)
import cityApi from "@/lib/api/city/city.api";
import { propertyApi } from "@/lib/api";
import { toTitleCase } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, PlusCircle } from "lucide-react";
import { useEffect } from "react";

// Zod schema – only name is required, state and country are optional
const formSchema = z.object({
  name: z.string().min(2, { message: "City name must be at least 2 characters" }),
  state: z.string().optional(),
  country: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  canonicalUrl: z.string().optional(),
  description: z.string().optional(),
  rentMetaTitle: z.string().optional(),
  rentMetaDescription: z.string().optional(),
  rentContent: z.string().optional(),
  saleMetaTitle: z.string().optional(),
  saleMetaDescription: z.string().optional(),
  saleContent: z.string().optional(),
  buyContent: z.string().optional(),
  thumbnail: z.string().optional(),
  typeContents: z.array(z.object({
    propertyType: z.string().min(1, "Type is required"),
    purpose: z.enum(['rent', 'sale', 'all']),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    content: z.string().optional(),
  })).optional(),
});

export default function AddCityPage() {
  const router = useRouter();
  const [imageDialogOpen, setImageDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      state: undefined,
      country: undefined,
      metaTitle: "",
      metaDescription: "",
      canonicalUrl: "",
      description: "",
      rentMetaTitle: "",
      rentMetaDescription: "",
      rentContent: "",
      saleMetaTitle: "",
      saleMetaDescription: "",
      saleContent: "",
      buyContent: "",
      thumbnail: "",
      typeContents: [],
    },
  });

  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  useEffect(() => {
    const fetchTypes = async () => {
      try {
        const types = await propertyApi.getTypes();
        setAvailableTypes(types || []);
      } catch (error) {
        console.error("Error fetching property types:", error);
      }
    };
    fetchTypes();
  }, []);

  const addTypeContent = () => {
    const current = form.getValues("typeContents") || [];
    form.setValue("typeContents", [
      ...current,
      { propertyType: "", purpose: "rent", metaTitle: "", metaDescription: "", content: "" }
    ]);
  };

  const removeTypeContent = (index: number) => {
    const current = form.getValues("typeContents") || [];
    form.setValue("typeContents", current.filter((_, i) => i !== index));
  };

  const isLoading = form.formState.isSubmitting;

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      // Only send fields that have values (filter out empty strings)
      const payload: any = {
        name: toTitleCase(values.name.trim()),
      };

      if (values.state && values.state.trim()) {
        payload.state = toTitleCase(values.state.trim());
      }

      if (values.country && values.country.trim()) {
        payload.country = toTitleCase(values.country.trim());
      }

      if (values.metaTitle?.trim()) payload.metaTitle = values.metaTitle.trim();
      if (values.metaDescription?.trim()) payload.metaDescription = values.metaDescription.trim();
      if (values.canonicalUrl?.trim()) payload.canonicalUrl = values.canonicalUrl.trim();
      if (values.description?.trim()) payload.description = values.description.trim();
      if (values.rentMetaTitle?.trim()) payload.rentMetaTitle = values.rentMetaTitle.trim();
      if (values.rentMetaDescription?.trim()) payload.rentMetaDescription = values.rentMetaDescription.trim();
      if (values.rentContent?.trim()) payload.rentContent = values.rentContent.trim();
      if (values.saleMetaTitle?.trim()) payload.saleMetaTitle = values.saleMetaTitle.trim();
      if (values.saleMetaDescription?.trim()) payload.saleMetaDescription = values.saleMetaDescription.trim();
      if (values.saleContent?.trim()) payload.saleContent = values.saleContent.trim();
      if (values.buyContent?.trim()) payload.buyContent = values.buyContent.trim();
      if (values.thumbnail?.trim()) payload.thumbnail = values.thumbnail.trim();
      if (values.typeContents && values.typeContents.length > 0) {
        payload.typeContents = values.typeContents;
      }

      await cityApi.create(payload);

      toast.success("City created successfully!");
      form.reset();
      router.refresh();           // Refresh server components / data
      // Optional: router.push("/dashboard/city"); // go to list
    } catch (error: any) {
      console.error("Create city error:", error);
      console.error("Error response:", error?.response?.data);

      // Get validation errors if they exist
      const validationErrors = error?.response?.data?.message;
      const errorMessage = Array.isArray(validationErrors)
        ? validationErrors.join(', ')
        : validationErrors || error?.message || "Failed to create city. Please try again.";

      toast.error("Error", { description: errorMessage });
    }
  }

  return (
    <div className="w-full">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Add New City</h1>
          <p className="text-gray-600 mb-8">
            Add a city to make it available for property listings. Only the city name is required and must be unique.
          </p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              {/* City Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Karachi" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* State / Province */}
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State / Province (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Sindh" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Country */}
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Pakistan" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* City Thumbnail */}
              <FormField
                control={form.control}
                name="thumbnail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City Thumbnail (Optional)</FormLabel>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <FormControl>
                          <Input
                            placeholder="Image URL or choose from gallery"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setImageDialogOpen(true)}
                        >
                          <ImageIcon className="h-4 w-4 mr-2" />
                          Gallery
                        </Button>
                      </div>

                      {field.value && (
                        <div className="relative w-full h-48 rounded-lg overflow-hidden border bg-gray-50">
                          <img
                            src={field.value}
                            alt="City thumbnail preview"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://placehold.co/600x400?text=Invalid+Image+URL';
                            }}
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2 h-8 w-8 rounded-full"
                            onClick={() => field.onChange("")}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Meta Title */}
                <FormField
                  control={form.control}
                  name="metaTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meta Title (SEO)</FormLabel>
                      <FormControl>
                        <Input placeholder="SEO Title" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Canonical URL */}
                <FormField
                  control={form.control}
                  name="canonicalUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Canonical URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com/city" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Meta Description */}
              <FormField
                control={form.control}
                name="metaDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meta Description (SEO)</FormLabel>
                    <FormControl>
                      <Input placeholder="SEO Description" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Rich Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City Description (Rich Text - General)</FormLabel>
                    <FormControl>
                      <RichEditor
                        value={field.value || ""}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-700">Specific Content Sections</h3>
                <p className="text-sm text-gray-500 -mt-4">Define specific content for different property purposes. If left empty, the general description above will be used.</p>

                {/* Rent Section */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="rentMetaTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-blue-600 font-medium">Rent Meta Title (SEO)</FormLabel>
                          <FormControl>
                            <Input placeholder="Meta title for rent page" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="rentMetaDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-blue-600 font-medium">Rent Meta Description (SEO)</FormLabel>
                          <FormControl>
                            <Input placeholder="Meta description for rent page" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="rentContent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-blue-600 font-medium">Rent Content (Rich Text)</FormLabel>
                        <FormControl>
                          <RichEditor
                            value={field.value || ""}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Sale Section */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="saleMetaTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-green-600 font-medium">Sale Meta Title (SEO)</FormLabel>
                          <FormControl>
                            <Input placeholder="Meta title for sale page" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="saleMetaDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-green-600 font-medium">Sale Meta Description (SEO)</FormLabel>
                          <FormControl>
                            <Input placeholder="Meta description for sale page" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="saleContent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-green-600 font-medium">Sale Content (Rich Text)</FormLabel>
                        <FormControl>
                          <RichEditor
                            value={field.value || ""}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Buy Content */}
                <FormField
                  control={form.control}
                  name="buyContent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-purple-600 font-medium">Buy Content (Rich Text)</FormLabel>
                      <FormControl>
                        <RichEditor
                          value={field.value || ""}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Property Type Specific Content */}
                <div className="mt-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">Property Type Specific Content</h3>
                      <p className="text-sm text-gray-500">Add custom content for specific combinations like "House for Rent in {form.watch('name') || 'City'}"</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addTypeContent}
                      className="flex items-center gap-2"
                    >
                      <PlusCircle className="h-4 w-4" />
                      Add Specific Type Content
                    </Button>
                  </div>

                  {form.watch("typeContents")?.map((_, index) => (
                    <div key={index} className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm space-y-4 relative group">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeTypeContent(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name={`typeContents.${index}.propertyType`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Property Type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {availableTypes.map((t) => (
                                    <SelectItem key={t} value={t}>{t}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`typeContents.${index}.purpose`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Purpose</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select purpose" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="rent">Rent</SelectItem>
                                  <SelectItem value="sale">Sale</SelectItem>
                                  <SelectItem value="all">All</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name={`typeContents.${index}.metaTitle`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Meta Title</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="SEO Title" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`typeContents.${index}.metaDescription`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Meta Description</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="SEO Description" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name={`typeContents.${index}.content`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rich Content</FormLabel>
                            <FormControl>
                              <RichEditor
                                value={field.value || ""}
                                onChange={field.onChange}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  ))}

                  {(!form.watch("typeContents") || form.watch("typeContents")?.length === 0) && (
                    <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                      <p className="text-gray-500 italic">No specific property type content added yet.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Image Picker Dialog */}
              <ImagePickerDialog
                open={imageDialogOpen}
                onOpenChange={setImageDialogOpen}
                onSelect={(image) => {
                  form.setValue("thumbnail", image.url);
                }}
                title="Select City Thumbnail"
                description="Choose an image for the city card on the home page."
              />

              {/* Submit Buttons */}
              <div className="flex gap-4 pt-6">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-gray-800 hover:bg-gray-900"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Add City"
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}