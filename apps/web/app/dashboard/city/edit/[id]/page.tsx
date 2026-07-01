 "use client";

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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ImagePickerDialog } from "@/components/ImagePickerDialog";
import { Image as ImageIcon, X, Trash2, PlusCircle } from "lucide-react";
import cityApi from "@/lib/api/city/city.api";
import areaApi, { CreateAreaData, SizeContentItem } from "@/lib/api/area/area.api";
import { propertyApi } from "@/lib/api";
import { toTitleCase } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SIZE_OPTIONS = [
  { value: "2marla",  label: "2 Marla"  },
  { value: "3marla",  label: "3 Marla"  },
  { value: "5marla",  label: "5 Marla"  },
  { value: "10marla", label: "10 Marla" },
  { value: "1kanal",  label: "1 Kanal"  },
];

interface AreaItem {
  _id?: string;
  name: string;
  areaSlug?: string;
  sizeContents: SizeContentItem[];
}

const formSchema = z.object({
  name: z.string().min(2, { message: "City name must be at least 2 characters" }),
  state: z.string().min(2, { message: "State/Province is required" }),
  country: z.string().min(2, { message: "Country is required" }),
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
  sizeContents: z.array(z.object({
    size: z.enum(['2marla', '3marla', '5marla', '10marla', '1kanal']),
    purpose: z.enum(['rent', 'sale', 'all']),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    content: z.string().optional(),
  })).optional(),
});

export default function EditCityPage() {
  const router = useRouter();
  const params = useParams();
  const cityId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);

  // 🆕 Area-related state
  const [cityAreas, setCityAreas] = useState<AreaItem[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string>(""); // "" = new area
  const [areaName, setAreaName] = useState("");
  const [areaSizeContents, setAreaSizeContents] = useState<SizeContentItem[]>([]);
  const [savingArea, setSavingArea] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "", state: "", country: "Pakistan",
      metaTitle: "", metaDescription: "", canonicalUrl: "",
      description: "", rentMetaTitle: "", rentMetaDescription: "",
      rentContent: "", saleMetaTitle: "", saleMetaDescription: "",
      saleContent: "", buyContent: "", thumbnail: "",
      typeContents: [],
      sizeContents: [],
    },
  });

  const isLoading = form.formState.isSubmitting || loading;

  useEffect(() => {
    const fetchCity = async () => {
      try {
        setLoading(true);
        const city = await cityApi.getById(cityId);
        form.reset({
          name: city.name || "", state: city.state || "",
          country: city.country || "Pakistan",
          metaTitle: city.metaTitle || "", metaDescription: city.metaDescription || "",
          canonicalUrl: city.canonicalUrl || "", description: city.description || "",
          rentMetaTitle: city.rentMetaTitle || "", rentMetaDescription: city.rentMetaDescription || "",
          rentContent: city.rentContent || "", saleMetaTitle: city.saleMetaTitle || "",
          saleMetaDescription: city.saleMetaDescription || "", saleContent: city.saleContent || "",
          buyContent: city.buyContent || "", thumbnail: city.thumbnail || "",
          typeContents: city.typeContents || [],
          sizeContents: city.sizeContents || [],
        });
      } catch (error: any) {
        toast.error("Error", { description: error?.response?.data?.message || "Failed to load city." });
        router.push("/dashboard/city");
      } finally {
        setLoading(false);
      }
    };
    const fetchTypes = async () => {
      try { const types = await propertyApi.getTypes(); setAvailableTypes(types || []); }
      catch (e) { console.error(e); }
    };
    const fetchAreas = async () => {
      try {
        const areas = await areaApi.getAll(cityId);
        setCityAreas(areas || []);
      } catch (e) { console.error(e); }
    };
    if (cityId) { fetchCity(); fetchTypes(); fetchAreas(); }
  }, [cityId, form, router]);

  const addTypeContent = () => {
    const cur = form.getValues("typeContents") || [];
    form.setValue("typeContents", [...cur, { propertyType: "", purpose: "rent", metaTitle: "", metaDescription: "", content: "" }]);
  };
  const removeTypeContent = (i: number) => form.setValue("typeContents", (form.getValues("typeContents") || []).filter((_, idx) => idx !== i));

  const addSizeContent = () => {
    const cur = form.getValues("sizeContents") || [];
    form.setValue("sizeContents", [...cur, { size: "5marla", purpose: "all", metaTitle: "", metaDescription: "", content: "" }]);
  };
  const removeSizeContent = (i: number) => form.setValue("sizeContents", (form.getValues("sizeContents") || []).filter((_, idx) => idx !== i));

  // 🆕 Area handlers — "new" sentinel used because Radix Select disallows empty string values
  const handleSelectArea = (id: string) => {
    if (id === "new") {
      setSelectedAreaId("");
      setAreaName("");
      setAreaSizeContents([]);
      return;
    }
    setSelectedAreaId(id);
    const found = cityAreas.find((a) => a._id === id);
    setAreaName(found?.name || "");
    setAreaSizeContents(found?.sizeContents || []);
  };

  const addAreaSizeContent = () => {
    setAreaSizeContents((prev) => [...prev, { size: "5marla", purpose: "all", metaTitle: "", metaDescription: "", content: "" }]);
  };

  const removeAreaSizeContent = (idx: number) => {
    setAreaSizeContents((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateAreaSizeContentField = (idx: number, field: keyof SizeContentItem, value: string) => {
    setAreaSizeContents((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  };

  const generateSlug = (name: string) =>
    name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const saveArea = async () => {
    if (!areaName.trim()) {
      toast.error("Error", { description: "Area name is required." });
      return;
    }
    setSavingArea(true);
    try {
      const payload: Partial<CreateAreaData> = {
        name: toTitleCase(areaName.trim()),
        city: cityId,
        areaSlug: generateSlug(areaName),
        sizeContents: areaSizeContents,
      };

      if (selectedAreaId) {
        await areaApi.update(selectedAreaId, payload);
        toast.success("Area updated successfully!");
      } else {
        const created = await areaApi.create(payload as CreateAreaData);
        toast.success("Area created successfully!");
        setSelectedAreaId(created._id);
      }

      const refreshed = await areaApi.getAll(cityId);
      setCityAreas(refreshed || []);
    } catch (error: any) {
      toast.error("Error", { description: error?.response?.data?.message || "Failed to save area." });
    } finally {
      setSavingArea(false);
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const payload = { ...values, name: toTitleCase(values.name.trim()), state: toTitleCase(values.state.trim()), country: toTitleCase(values.country.trim()) };
      await cityApi.update(cityId, payload);
      toast.success("City updated successfully!");
      router.push("/dashboard/city");
    } catch (error: any) {
      toast.error("Error", { description: error?.response?.data?.message || error?.message || "Failed to update city." });
    }
  }

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 text-gray-600">Loading city...</span>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Edit City</h1>
          <p className="text-gray-600 mb-8">Update city information.</p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>City Name *</FormLabel><FormControl><Input placeholder="e.g. Karachi" {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="state" render={({ field }) => (
                  <FormItem><FormLabel>State / Province *</FormLabel><FormControl><Input placeholder="e.g. Sindh" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="country" render={({ field }) => (
                  <FormItem><FormLabel>Country *</FormLabel><FormControl><Input placeholder="e.g. Pakistan" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <FormField control={form.control} name="thumbnail" render={({ field }) => (
                <FormItem>
                  <FormLabel>City Thumbnail (Optional)</FormLabel>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <FormControl><Input placeholder="Image URL or choose from gallery" {...field} value={field.value || ""} /></FormControl>
                      <Button type="button" variant="outline" onClick={() => setImageDialogOpen(true)}>
                        <ImageIcon className="h-4 w-4 mr-2" />Gallery
                      </Button>
                    </div>
                    {field.value && (
                      <div className="relative w-full h-48 rounded-lg overflow-hidden border bg-gray-50">
                        <img src={field.value} alt="preview" className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/600x400?text=Invalid+Image+URL'; }} />
                        <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8 rounded-full" onClick={() => field.onChange("")}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="metaTitle" render={({ field }) => (
                  <FormItem><FormLabel>Meta Title (SEO)</FormLabel><FormControl><Input placeholder="SEO Title" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="canonicalUrl" render={({ field }) => (
                  <FormItem><FormLabel>Canonical URL</FormLabel><FormControl><Input placeholder="https://example.com/city" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <FormField control={form.control} name="metaDescription" render={({ field }) => (
                <FormItem><FormLabel>Meta Description (SEO)</FormLabel><FormControl><Input placeholder="SEO Description" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
              )} />

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>City Description (Rich Text - General)</FormLabel><FormControl><RichEditor value={field.value || ""} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>
              )} />

              {/* ── Specific Content Sections ─────────────────────────── */}
              <div className="grid grid-cols-1 gap-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-700">Specific Content Sections</h3>
                <p className="text-sm text-gray-500 -mt-4">Define specific content for different property purposes. If left empty, the general description above will be used.</p>

                {/* Rent */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="rentMetaTitle" render={({ field }) => (
                      <FormItem><FormLabel className="text-blue-600 font-medium">Rent Meta Title (SEO)</FormLabel><FormControl><Input placeholder="Meta title for rent page" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="rentMetaDescription" render={({ field }) => (
                      <FormItem><FormLabel className="text-blue-600 font-medium">Rent Meta Description (SEO)</FormLabel><FormControl><Input placeholder="Meta description for rent page" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="rentContent" render={({ field }) => (
                    <FormItem><FormLabel className="text-blue-600 font-medium">Rent Content (Rich Text)</FormLabel><FormControl><RichEditor value={field.value || ""} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                {/* Sale */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="saleMetaTitle" render={({ field }) => (
                      <FormItem><FormLabel className="text-green-600 font-medium">Sale Meta Title (SEO)</FormLabel><FormControl><Input placeholder="Meta title for sale page" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="saleMetaDescription" render={({ field }) => (
                      <FormItem><FormLabel className="text-green-600 font-medium">Sale Meta Description (SEO)</FormLabel><FormControl><Input placeholder="Meta description for sale page" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="saleContent" render={({ field }) => (
                    <FormItem><FormLabel className="text-green-600 font-medium">Sale Content (Rich Text)</FormLabel><FormControl><RichEditor value={field.value || ""} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                {/* Buy */}
                <FormField control={form.control} name="buyContent" render={({ field }) => (
                  <FormItem><FormLabel className="text-purple-600 font-medium">Buy Content (Rich Text)</FormLabel><FormControl><RichEditor value={field.value || ""} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>
                )} />

                {/* ── Property Type Specific (existing) ─────────────────── */}
                <div className="mt-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">Property Type Specific Content</h3>
                      <p className="text-sm text-gray-500">Add custom content for specific combinations like "House for Rent in {form.watch('name') || 'City'}"</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addTypeContent} className="flex items-center gap-2">
                      <PlusCircle className="h-4 w-4" />Add Specific Type Content
                    </Button>
                  </div>

                  {form.watch("typeContents")?.map((_, index) => (
                    <div key={index} className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm space-y-4 relative group">
                      <Button type="button" variant="ghost" size="icon"
                        className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeTypeContent(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name={`typeContents.${index}.propertyType`} render={({ field }) => (
                          <FormItem><FormLabel>Property Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                              <SelectContent>{availableTypes.filter((t) => t && t.trim() !== "").map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                            </Select><FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name={`typeContents.${index}.purpose`} render={({ field }) => (
                          <FormItem><FormLabel>Purpose</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select purpose" /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="rent">Rent</SelectItem>
                                <SelectItem value="sale">Sale</SelectItem>
                                <SelectItem value="all">All</SelectItem>
                              </SelectContent>
                            </Select><FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name={`typeContents.${index}.metaTitle`} render={({ field }) => (
                          <FormItem><FormLabel>Meta Title</FormLabel><FormControl><Input {...field} placeholder="SEO Title" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name={`typeContents.${index}.metaDescription`} render={({ field }) => (
                          <FormItem><FormLabel>Meta Description</FormLabel><FormControl><Input {...field} placeholder="SEO Description" /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                      <FormField control={form.control} name={`typeContents.${index}.content`} render={({ field }) => (
                        <FormItem><FormLabel>Rich Content</FormLabel><FormControl><RichEditor value={field.value || ""} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                  ))}

                  {(!form.watch("typeContents") || form.watch("typeContents")?.length === 0) && (
                    <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                      <p className="text-gray-500 italic">No specific property type content added yet.</p>
                    </div>
                  )}
                </div>

                {/* ── Property Size Specific Content ─────────────────── */}
                <div className="mt-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">Property Size Specific Content</h3>
                      <p className="text-sm text-gray-500">
                        Add SEO content for specific marla / kanal sizes, e.g. "5 Marla House for Sale in {form.watch('name') || 'City'}"
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addSizeContent} className="flex items-center gap-2">
                      <PlusCircle className="h-4 w-4" />Add Size Content
                    </Button>
                  </div>

                  {form.watch("sizeContents")?.map((_, index) => (
                    <div key={index} className="p-6 bg-white border border-orange-100 rounded-xl shadow-sm space-y-4 relative group">
                      <Button type="button" variant="ghost" size="icon"
                        className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeSizeContent(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name={`sizeContents.${index}.size`} render={({ field }) => (
                          <FormItem><FormLabel>Property Size</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger></FormControl>
                              <SelectContent>
                                {SIZE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                              </SelectContent>
                            </Select><FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name={`sizeContents.${index}.purpose`} render={({ field }) => (
                          <FormItem><FormLabel>Purpose</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select purpose" /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="all">All (Buy &amp; Rent)</SelectItem>
                                <SelectItem value="rent">Rent</SelectItem>
                                <SelectItem value="sale">Sale</SelectItem>
                              </SelectContent>
                            </Select><FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      {/* Live URL preview */}
                      <p className="text-xs text-gray-400 font-mono bg-gray-50 px-3 py-2 rounded">
                        /properties/{form.watch(`sizeContents.${index}.purpose`) || 'all'}/
                        {(form.watch('name') || 'city').toLowerCase()}/house/
                        {form.watch(`sizeContents.${index}.size`) || '5marla'}
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name={`sizeContents.${index}.metaTitle`} render={({ field }) => (
                          <FormItem><FormLabel>Meta Title</FormLabel><FormControl><Input {...field} placeholder="SEO Title" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name={`sizeContents.${index}.metaDescription`} render={({ field }) => (
                          <FormItem><FormLabel>Meta Description</FormLabel><FormControl><Input {...field} placeholder="SEO Description" /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>

                      <FormField control={form.control} name={`sizeContents.${index}.content`} render={({ field }) => (
                        <FormItem><FormLabel>Rich Content</FormLabel><FormControl><RichEditor value={field.value || ""} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                  ))}

                  {(!form.watch("sizeContents") || form.watch("sizeContents")?.length === 0) && (
                    <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-orange-200">
                      <p className="text-gray-500 italic">No size-specific content added yet.</p>
                      <p className="text-xs text-gray-400 mt-1">Click "Add Size Content" to add 2/3/5/10 Marla or 1 Kanal SEO content.</p>
                    </div>
                  )}
                </div>

                {/* ── 🆕 Area Specific Content (saved independently from City) ─────────────────── */}
                <div className="mt-8 space-y-6 border-t pt-8">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">Area Specific Content</h3>
                    <p className="text-sm text-gray-500">
                      Select an existing area or add a new one, then add size-wise SEO content for it.
                      e.g. "10 Marla House for Sale in DHA Phase 7, {form.watch('name') || 'City'}"
                    </p>
                  </div>

                  <div className="p-6 bg-white border border-orange-100 rounded-xl shadow-sm space-y-6">
                    {/* Area selector + name */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1.5 block">Select Area</label>
                        <Select value={selectedAreaId || "new"} onValueChange={handleSelectArea}>
                          <SelectTrigger>
                            <SelectValue placeholder="-- New Area --" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">-- New Area --</SelectItem>
                            {cityAreas
                              .filter((a) => a._id && a._id.trim() !== "")
                              .map((a) => (
                                <SelectItem key={a._id} value={a._id as string}>{a.name}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1.5 block">Area Name</label>
                        <Input
                          placeholder="e.g. DHA Phase 7"
                          value={areaName}
                          onChange={(e) => setAreaName(e.target.value)}
                        />
                      </div>
                    </div>

                    {areaName.trim() && (
                      <p className="text-xs text-gray-400 font-mono bg-gray-50 px-3 py-2 rounded">
                        /properties/all/{(form.watch('name') || 'city').toLowerCase()}/{generateSlug(areaName)}
                      </p>
                    )}

                    {/* Area's size contents */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-md font-semibold text-gray-700">Size Specific Content for this Area</h4>
                        <Button type="button" variant="outline" size="sm" onClick={addAreaSizeContent} className="flex items-center gap-2">
                          <PlusCircle className="h-4 w-4" />Add Size Content
                        </Button>
                      </div>

                      {areaSizeContents.map((item, index) => (
                        <div key={index} className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-4 relative group">
                          <Button type="button" variant="ghost" size="icon"
                            className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeAreaSizeContent(index)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Property Size</label>
                              <Select value={item.size} onValueChange={(val) => updateAreaSizeContentField(index, "size", val)}>
                                <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
                                <SelectContent>
                                  {SIZE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Purpose</label>
                              <Select value={item.purpose} onValueChange={(val) => updateAreaSizeContentField(index, "purpose", val)}>
                                <SelectTrigger><SelectValue placeholder="Select purpose" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All (Buy &amp; Rent)</SelectItem>
                                  <SelectItem value="rent">Rent</SelectItem>
                                  <SelectItem value="sale">Sale</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Live URL preview */}
                          <p className="text-xs text-gray-400 font-mono bg-white px-3 py-2 rounded border">
                            /properties/{item.purpose || 'all'}/
                            {(form.watch('name') || 'city').toLowerCase()}/
                            {generateSlug(areaName) || 'area'}/
                            {item.size || '5marla'}
                          </p>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Meta Title</label>
                              <Input
                                placeholder="SEO Title"
                                value={item.metaTitle || ""}
                                onChange={(e) => updateAreaSizeContentField(index, "metaTitle", e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Meta Description</label>
                              <Input
                                placeholder="SEO Description"
                                value={item.metaDescription || ""}
                                onChange={(e) => updateAreaSizeContentField(index, "metaDescription", e.target.value)}
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Rich Content</label>
                            <RichEditor
                              value={item.content || ""}
                              onChange={(val: string) => updateAreaSizeContentField(index, "content", val)}
                            />
                          </div>
                        </div>
                      ))}

                      {areaSizeContents.length === 0 && (
                        <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                          <p className="text-gray-500 italic text-sm">No size-specific content added for this area yet.</p>
                        </div>
                      )}
                    </div>

                    {/* Save Area button (independent of main City form submit) */}
                    <div className="flex justify-end pt-2 border-t">
                      <Button type="button" onClick={saveArea} disabled={savingArea} className="bg-orange-600 hover:bg-orange-700">
                        {savingArea ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving Area...</>
                        ) : (
                          selectedAreaId ? "Update Area" : "Save New Area"
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* List of existing areas for quick reference */}
                  {cityAreas.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {cityAreas.map((a) => (
                        <button
                          key={a._id}
                          type="button"
                          onClick={() => handleSelectArea(a._id || "new")}
                          className={`text-xs px-3 py-1.5 rounded-full border ${selectedAreaId === a._id ? "bg-orange-600 text-white border-orange-600" : "bg-white text-gray-600 border-gray-300 hover:border-orange-300"}`}
                        >
                          {a.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

              </div>{/* end Specific Content Sections */}

              <ImagePickerDialog
                open={imageDialogOpen}
                onOpenChange={setImageDialogOpen}
                onSelect={(image) => { form.setValue("thumbnail", image.url); }}
                title="Select City Thumbnail"
                description="Choose an image for the city card on the home page."
              />

              <div className="flex gap-4 pt-6">
                <Button type="submit" disabled={isLoading} className="flex-1 bg-gray-800 hover:bg-gray-900">
                  {isLoading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Updating...</> : "Update City"}
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