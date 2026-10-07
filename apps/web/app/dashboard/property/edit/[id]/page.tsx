"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { GalleryField } from "@/components/media";
import { AreaSizeField, PriceField } from "@/components/dashboard";
import { Loader2, Plus } from "lucide-react";
import { toTitleCase } from "@/lib/utils";
import { marlaKanalFor } from "@/lib/pk";
import { useAuth } from "@/context/auth-context";
import { propertyApi } from "@/lib/api";
import cityApi from "@/lib/api/city/city.api";
import areaApi from "@/lib/api/area/area.api";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import dynamic from "next/dynamic";
const RichEditor = dynamic(() => import("@/components/RichEditor"), {
  ssr: false,
  loading: () => (
    <div className="h-[200px] w-full bg-gray-100 animate-pulse rounded-lg flex items-center justify-center text-gray-400">
      Loading Editor...
    </div>
  ),
});

const MapPicker = dynamic(() => import("@/components/MapPicker"), {
  ssr: false,
  loading: () => (
    <div className="h-[300px] w-full bg-gray-100 animate-pulse rounded-lg flex items-center justify-center text-gray-400">
      Loading Map...
    </div>
  ),
});

interface City {
  _id: string;
  name: string;
  state: string;
  country: string;
}

interface Area {
  _id: string;
  name: string;
  city: string | City;
}

export default function EditProperty() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [listingType, setListingType] = useState<"rent" | "sale">("rent");
  const [propertyType, setPropertyType] = useState("");
  const [cityId, setCityId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [areaSize, setAreaSize] = useState(""); // Property size in sq ft
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();

  // Cities and Areas state
  const [cities, setCities] = useState<City[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loadingProperty, setLoadingProperty] = useState(true);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [showAddCityModal, setShowAddCityModal] = useState(false);
  const [showAddAreaModal, setShowAddAreaModal] = useState(false);
  const [newCityName, setNewCityName] = useState("");
  const [newAreaName, setNewAreaName] = useState("");
  const [isAddingLocation, setIsAddingLocation] = useState(false);

  // Photos in display order; the first is the cover. Already-uploaded URLs,
  // so there are no File objects to carry around.
  const [photos, setPhotos] = useState<string[]>([]);

  const [features, setFeatures] = useState<string[]>([""]);

  // Track existing status so we can offer publish-from-draft semantics in the
  // submit buttons. Possible values match the backend: pending|approved|rejected|draft.
  const [currentStatus, setCurrentStatus] = useState<
    "pending" | "approved" | "rejected" | "draft" | undefined
  >(undefined);

  /*
   * What the listing arrived with, so an edit that does not touch the size
   * leaves its marla/kanal exactly as they were. Some older rows carry a
   * hand-entered marla that does not match their square footage, and quietly
   * recomputing it would move the listing between size filters.
   */
  const [originalSize, setOriginalSize] = useState<{
    areaSize: string;
    marla?: number;
    kanal?: number;
  } | null>(null);

  /** Set when the listing's saved city/area could not be resolved. */
  const [locationUnresolved, setLocationUnresolved] = useState(false);

  const params = useParams();
  const propertyId = params.id as string;

  // Fetch cities on component mount
  useEffect(() => {
    const fetchCities = async () => {
      try {
        const data = await cityApi.getAll();
        setCities((prev) => {
          // Merge fetched cities with existing (which might have our seeded city)
          const newCities = [...prev];
          data.forEach((city: any) => {
            if (!newCities.find((c) => String(c._id) === String(city._id))) {
              newCities.push(city);
            }
          });
          return newCities;
        });
      } catch (error: any) {
        console.error("Error fetching cities:", error);
        toast.error("Error", {
          description: "Failed to load cities. Please try again.",
        });
      }
    };
    fetchCities();
  }, []);

  /**
   * Put the listing's own city and area back into the two dropdowns, whatever
   * shape the API returned them in, and seed the lists with them so they are
   * selectable even if they are missing from the fetched options (an
   * deactivated city, a long list, a failed request).
   */
  const restoreLocation = async (areaValue: unknown) => {
    if (!areaValue) {
      setLocationUnresolved(true);
      return;
    }

    try {
      let areaObj: any =
        typeof areaValue === "object" ? (areaValue as any) : null;

      // Shape 3: only an id — ask for the area itself.
      if (!areaObj) {
        areaObj = await areaApi.getById(String(areaValue));
      }

      if (!areaObj?._id) {
        setLocationUnresolved(true);
        return;
      }

      const areaIdStr = String(areaObj._id);
      setAreaId(areaIdStr);
      setAreas((prev) =>
        prev.some((a) => String(a._id) === areaIdStr) ? prev : [...prev, areaObj],
      );

      let cityObj: any =
        areaObj.city && typeof areaObj.city === "object" ? areaObj.city : null;

      // Shape 2: the city came back as an id.
      if (!cityObj && areaObj.city) {
        try {
          cityObj = await cityApi.getById(String(areaObj.city));
        } catch {
          // Fall through to using the bare id: the city list almost certainly
          // contains it, and the selection still saves correctly.
          setCityId(String(areaObj.city));
        }
      }

      if (cityObj?._id) {
        const cityIdStr = String(cityObj._id);
        setCityId(cityIdStr);
        setCities((prev) =>
          prev.some((c) => String(c._id) === cityIdStr) ? prev : [...prev, cityObj],
        );
      } else if (!areaObj.city) {
        setLocationUnresolved(true);
      }
    } catch (error) {
      console.error("Could not restore the listing's location:", error);
      setLocationUnresolved(true);
    }
  };

  // Fetch property data
  useEffect(() => {
    const fetchProperty = async (propertyId: string) => {
      try {
        setLoadingProperty(true);
        const property = await propertyApi.getPropertyById({ id: propertyId });

        setListingType(property.listingType);

        // Map backend lowercase type to capitalized frontend type
        const typeMapping: Record<string, string> = {
          house: "House",
          apartment: "Apartment",
          flat: "Flat",
          commercial: "Commercial",
          land: "Land",
          shop: "Shop",
          office: "Office",
          factory: "Factory",
          hotel: "Hotel",
          restaurant: "Restaurant",
          plot: "Plot",
        };
        setPropertyType(typeMapping[property.propertyType] || "House");

        /*
         * Restore the city and area this listing already has.
         *
         * Three shapes turn up here and all three have to end with both
         * dropdowns filled in, because a save writes whatever they hold:
         *   1. area populated with its city populated  — the normal case
         *   2. area populated, city still an id        — resolve the city
         *   3. area is just an id                      — fetch the area first
         *
         * Anything left unresolved raises the banner below instead of quietly
         * showing two empty dropdowns, which is how a published listing could
         * lose its location on an unrelated edit.
         */
        await restoreLocation(property.area);

        setTitle(property.title);
        setLocation(property.location);
        setBedrooms(property.bedrooms?.toString() || "0");
        setBathrooms(property.bathrooms?.toString() || "0");
        setAreaSize(property.areaSize?.toString() || "0");
        setOriginalSize({
          areaSize: property.areaSize?.toString() || "0",
          marla: property.marla,
          kanal: property.kanal,
        });
        setPrice(property.price?.toString() || "0");
        setDescription(property.description || "");
        setContactNumber(property.contactNumber || "");
        setWhatsappNumber(property.whatsappNumber || "");
        setLatitude(property.latitude);
        setLongitude(property.longitude);

        // Correct field names for images
        setPhotos(
          [property.mainPhotoUrl, ...(property.additionalPhotosUrls ?? [])].filter(
            (url): url is string => Boolean(url),
          ),
        );

        setFeatures(
          property.features && property.features.length > 0
            ? property.features
            : [""],
        );
        setCurrentStatus(property.status);
      } catch (error: any) {
        console.error("Error fetching property:", error);
        toast.error("Error", {
          description: "Failed to load property. Please try again.",
        });
      } finally {
        setLoadingProperty(false);
      }
    };
    if (propertyId) {
      fetchProperty(propertyId);
    }
  }, [propertyId]);

  useEffect(() => {
    const fetchAreas = async () => {
      if (!cityId) {
        // Keep the listing's own area in the list: clearing it here is what made
        // an edit open with an empty Area dropdown before the city resolved.
        if (!areaId) setAreas([]);
        return;
      }

      try {
        setLoadingAreas(true);
        const data = await areaApi.getAll(cityId);

        setAreas((prev) => {
          // Merge fetched areas with existing (which might have our seeded area)
          const newAreas = [...prev];
          data.forEach((area: any) => {
            if (!newAreas.find((a) => String(a._id) === String(area._id))) {
              newAreas.push(area);
            }
          });
          return newAreas;
        });
      } catch (error: any) {
        console.error("Error fetching areas:", error);
        toast.error("Error", {
          description: "Failed to load areas. Please try again.",
        });
        // Leave whatever is already there — including this listing's own area.
      } finally {
        setLoadingAreas(false);
      }
    };

    if (!loadingProperty) {
      fetchAreas();
    }
  }, [cityId, areaId, loadingProperty]);

  const handleCreateCity = async () => {
    if (!newCityName.trim()) return;
    try {
      setIsAddingLocation(true);
      const data = await cityApi.create({
        name: toTitleCase(newCityName.trim()),
      });
      toast.success("City added successfully");
      const allCities = await cityApi.getAll();
      setCities(allCities);
      setCityId(String(data._id));
      setAreaId("");
      setShowAddCityModal(false);
      setNewCityName("");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to add city");
    } finally {
      setIsAddingLocation(false);
    }
  };

  const generateSlug = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const handleCreateArea = async () => {
    if (!newAreaName.trim() || !cityId) return;
    try {
      setIsAddingLocation(true);
      const areaSlug = generateSlug(newAreaName);
      const data = await areaApi.create({
        name: toTitleCase(newAreaName.trim()),
        city: cityId,
        areaSlug,
      });
      toast.success("Area added successfully");
      const allAreas = await areaApi.getAll(cityId);
      setAreas(allAreas);
      setAreaId(String(data._id));
      setShowAddAreaModal(false);
      setNewAreaName("");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to add area");
    } finally {
      setIsAddingLocation(false);
    }
  };

  const addFeature = () => {
    setFeatures([...features, ""]);
  };

  const updateFeature = (index: number, value: string) => {
    const newFeatures = [...features];
    newFeatures[index] = value;
    setFeatures(newFeatures);
  };

  const removeFeature = (index: number) => {
    setFeatures(features.filter((_, i) => i !== index));
  };

  // Map frontend propertyType to backend format (lowercase)
  const mapPropertyTypeToBackend = (type: string): string => {
    const mapping: Record<string, string> = {
      House: "house",
      Apartment: "apartment",
      Shop: "shop",
      Office: "office",
      Flat: "flat",
      Commercial: "commercial",
      Plot: "plot",
      Land: "land",
      Factory: "factory",
      Hotel: "hotel",
      Restaurant: "restaurant",
      Other: "other",
    };
    return mapping[type] || type.toLowerCase();
  };

  // `targetStatus` lets the same handler power three buttons:
  //   - undefined  -> just save (preserve existing status)
  //   - 'draft'    -> save and force draft
  //   - 'pending'  -> publish (re-submit for approval / publish if admin)
  const handleSubmit = async (
    e: React.FormEvent,
    targetStatus?: "draft" | "pending",
  ) => {
    e.preventDefault();

    const isDraftSave = targetStatus === "draft";

    // Validation: drafts only require a title; otherwise enforce full set.
    if (isDraftSave) {
      if (!title) {
        toast.error("Please enter at least a title to save as draft");
        return;
      }
    } else {
      if (
        !propertyType ||
        !cityId ||
        !areaId ||
        !title ||
        !location ||
        !bedrooms ||
        !bathrooms ||
        !areaSize ||
        !price ||
        !description ||
        !contactNumber
      ) {
        toast.error("Please fill in all required fields");
        return;
      }

      if (photos.length === 0) {
        toast.error("Keep at least one photo of the property");
        return;
      }
    }

    setIsLoading(true);

    try {
      // Create FormData
      const formData = new FormData();

      // Add JSON data as separate fields (backend expects these in the body)
      formData.append("listingType", listingType);
      formData.append("propertyType", mapPropertyTypeToBackend(propertyType));
      formData.append("area", areaId); // Area ID (ObjectId)
      formData.append("title", title);
      formData.append("location", location);
      formData.append("bedrooms", bedrooms);
      formData.append("bathrooms", bathrooms);
      formData.append("areaSize", areaSize); // Property size in sq ft
      formData.append("price", price);
      /*
       * These two columns drive the marla/kanal size filters and the area
       * landing pages. Recomputed from the size only when the size was
       * actually changed — otherwise the values already on the listing are
       * sent back untouched.
       */
      const sizeUnchanged = originalSize?.areaSize === areaSize;
      const { marla, kanal } = sizeUnchanged
        ? { marla: originalSize?.marla ?? 0, kanal: originalSize?.kanal ?? 0 }
        : marlaKanalFor(Number(areaSize));
      if (marla > 0) formData.append("marla", String(marla));
      if (kanal > 0) formData.append("kanal", String(kanal));
      formData.append("description", description);
      formData.append("contactNumber", contactNumber);
      formData.append("whatsappNumber", whatsappNumber || contactNumber);

      // Every photo is already in the media library, so post URLs. The first
      // is the cover; the rest are the gallery, in the order shown.
      const [cover, ...rest] = photos;
      if (cover) formData.append("mainPhotoUrl", cover);
      for (const url of rest) formData.append("additionalPhotosUrls", url);
      // Tells the API this list is the gallery as it now stands, so removing
      // the last extra photo is saved as "no extra photos" rather than ignored.
      formData.append("photosProvided", "true");

      if (latitude !== undefined)
        formData.append("latitude", latitude.toString());
      if (longitude !== undefined)
        formData.append("longitude", longitude.toString());

      // Add features (filter out empty strings)
      const validFeatures = features.filter((f) => f.trim() !== "");
      if (validFeatures.length > 0) {
        validFeatures.forEach((feature, index) => {
          formData.append(`features[${index}]`, feature);
        });
      }

      // Communicate desired status change to backend (role-based enforcement
      // happens server-side: non-admins can only flip between draft/pending).
      if (targetStatus) formData.append("status", targetStatus);

      // Update property using the property ID
      const response = await propertyApi.update(propertyId, formData);

      const successMsg = isDraftSave
        ? "Saved as draft"
        : targetStatus === "pending"
          ? "Property submitted for approval"
          : "Property updated successfully!";
      const successDesc = isDraftSave
        ? "You can publish it later from the dashboard."
        : "Your property has been updated.";
      toast.success(successMsg, { description: successDesc });

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push("/dashboard/property");
        router.refresh();
      }, 1500);
    } catch (error: any) {
      console.error("Error updating property:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to update property. Please try again.";

      toast.error("Update Failed", {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-2xl font-semibold text-gray-800 mb-2">
            Update Property
          </h1>
          <p className="text-gray-600 mb-8">
            Fill in the details to update your property
          </p>

          <form onSubmit={(e) => handleSubmit(e)} className="space-y-6">
            {/* Listing Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Listing Type *
              </label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setListingType("rent")}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                    listingType === "rent"
                      ? "bg-gray-800 text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  For Rent
                </button>
                <button
                  type="button"
                  onClick={() => setListingType("sale")}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                    listingType === "sale"
                      ? "bg-gray-800 text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  For Sale
                </button>
              </div>
            </div>

            {/* Property Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Property Type *
              </label>
              <Select
                value={propertyType}
                onValueChange={setPropertyType}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select property type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="House">House</SelectItem>
                  <SelectItem value="Apartment">Apartment</SelectItem>
                  <SelectItem value="Shop">Shop</SelectItem>
                  <SelectItem value="Office">Office</SelectItem>
                  <SelectItem value="Flat">Flat</SelectItem>
                  <SelectItem value="Commercial">Commercial</SelectItem>
                  <SelectItem value="Plot">Plot</SelectItem>
                  <SelectItem value="Land">Land</SelectItem>
                  <SelectItem value="Factory">Factory</SelectItem>
                  <SelectItem value="Hotel">Hotel</SelectItem>
                  <SelectItem value="Restaurant">Restaurant</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* City and Area Selection */}
            {locationUnresolved && !loadingProperty && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <span aria-hidden className="mt-0.5 font-bold">!</span>
                <span>
                  This listing&apos;s saved city and area could not be loaded, so
                  they are not selected below. Pick them again before saving —
                  otherwise the location on the live page will change.
                </span>
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  City *
                </label>
                <Select
                  value={cityId}
                  onValueChange={(value) => {
                    setCityId(value);
                    setAreaId("");
                  }}
                  disabled={isLoading || loadingProperty}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        loadingProperty ? "Loading property..." : "Select city"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map((city) => (
                      <SelectItem
                        key={String(city._id)}
                        value={String(city._id)}
                      >
                        {city.name}
                      </SelectItem>
                    ))}
                    {/* Admin only: POST /cities is behind AdminGuard. */}
                    {isAdmin && (
                      <div
                        className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 text-primary font-medium hover:bg-gray-100 cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault();
                          setShowAddCityModal(true);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-2" /> Add New City
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Area *
                </label>
                <Select
                  value={areaId}
                  onValueChange={setAreaId}
                  disabled={isLoading || loadingAreas || !cityId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        !cityId
                          ? "Select city first"
                          : loadingAreas
                            ? "Loading areas..."
                            : "Select area"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map((area) => (
                      <SelectItem
                        key={String(area._id)}
                        value={String(area._id)}
                      >
                        {area.name}
                      </SelectItem>
                    ))}
                    {cityId && isAdmin && (
                      <div
                        className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 text-primary font-medium hover:bg-gray-100 cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault();
                          setShowAddAreaModal(true);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-2" /> Add New Area
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {!cityId ? (
                  <p className="text-xs text-gray-500 mt-1">
                    Please select a city first
                  </p>
                ) : (
                  !isAdmin && (
                    // Agents cannot create areas (AdminGuard), so say what to
                    // do instead of leaving them hunting for a + button.
                    <p className="text-xs text-gray-500 mt-1">
                      Area missing? Ask an admin to add it, or pick the nearest
                      one and write the exact address below.
                    </p>
                  )
                )}
              </div>
            </div>

            {/* Property Title */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Property Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="E.g., Luxury 3 Bedroom Apartment in DHA"
                disabled={isLoading}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Location / Address *
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Enter complete address"
                disabled={isLoading}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Map Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Pin Location on Map
              </label>
              <div className="mb-2">
                <MapPicker
                  onLocationSelect={(lat, lng) => {
                    setLatitude(lat);
                    setLongitude(lng);
                  }}
                  initialLat={latitude}
                  initialLng={longitude}
                />
              </div>
              <p className="text-xs text-gray-500">
                Click on the map to pin the exact location of your property.
                {latitude && longitude && (
                  <span className="text-green-600 font-medium ml-1">
                    Location pinned: {latitude.toFixed(4)},{" "}
                    {longitude.toFixed(4)}
                  </span>
                )}
              </p>
            </div>

            {/* Beds, baths and size */}
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Bedrooms *
                </label>
                <input
                  type="number"
                  min="0"
                  value={bedrooms}
                  onChange={(e) => setBedrooms(e.target.value)}
                  placeholder="0"
                  disabled={isLoading}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Bathrooms *
                </label>
                <input
                  type="number"
                  min="0"
                  value={bathrooms}
                  onChange={(e) => setBathrooms(e.target.value)}
                  placeholder="0"
                  disabled={isLoading}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              {/*
                Marla / Kanal / sq ft in one control.

                There used to be a required "Property Size (sq ft)" box plus
                separate optional Marla and Kanal boxes — three numbers that
                could contradict each other, and a plot sold as "5 marla" had to
                be converted by hand. Square feet is still what gets stored and
                sent, so existing listings and size filters are untouched.
              */}
              <AreaSizeField
                value={areaSize}
                onChange={setAreaSize}
                label="Property size"
                required
                disabled={isLoading}
              />
            </div>

            {/* Price, with the amount read back in lakh / crore */}
            <PriceField
              value={price}
              onChange={setPrice}
              mode={listingType === "rent" ? "rent" : "sale"}
              required
              disabled={isLoading}
            />

            {/*
              One gallery instead of a required "Main Photo" plus a separate
              "Additional Photos" grid. Existing photos load in order, new ones
              upload through the media library as they are picked, and the
              first photo is the cover — drag to change it.
            */}
            <GalleryField
              label="Property photos"
              value={photos}
              onChange={setPhotos}
              folder="properties"
              context={title || "Property listing"}
              max={20}
              hint="The first photo is the cover shown in search results. Drag to reorder."
            />

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Property Description *
              </label>
              {/* rich editor */}
              <RichEditor
                value={description}
                onChange={setDescription}
                placeholder="Update property description..."
                minHeight="min-h-[300px]"
              />
            </div>

            {/* Features */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Property Features
              </label>
              <div className="space-y-3">
                {features.map((feature, index) => (
                  <div key={index} className="flex gap-3">
                    <input
                      type="text"
                      value={feature}
                      onChange={(e) => updateFeature(index, e.target.value)}
                      placeholder={`Feature ${index + 1} (e.g., Swimming Pool, Parking, Security)`}
                      disabled={isLoading}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {features.length > 1 && (
                      <Button
                        type="button"
                        onClick={() => removeFeature(index)}
                        variant="destructive"
                        size="sm"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  onClick={addFeature}
                  disabled={isLoading}
                  variant="outline"
                  className="w-full border-dashed"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add More Features
                </Button>
              </div>
            </div>

            {/* Contact Number & WhatsApp Number */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Contact Number *
                </label>
                <input
                  type="tel"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="03XX XXXXXXX"
                  disabled={isLoading}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  WhatsApp Number (Optional)
                </label>
                <input
                  type="tel"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="923XX XXXXXXX"
                  disabled={isLoading}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">
                  If empty, contact number will be used for WhatsApp.
                </p>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex flex-wrap gap-4 pt-6">
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1 min-w-[180px] bg-gray-800 hover:bg-gray-900"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Submitting...
                  </>
                ) : currentStatus === "draft" ? (
                  "Save Changes"
                ) : (
                  "Update Property"
                )}
              </Button>

              {/* If currently a draft, expose a Publish button to flip status */}
              {currentStatus === "draft" && (
                <Button
                  type="button"
                  onClick={(e: any) => handleSubmit(e, "pending")}
                  disabled={isLoading}
                  className="min-w-[160px] bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    "Publish"
                  )}
                </Button>
              )}

              {/* Always allow saving the current draft (or downgrading) */}
              <Button
                type="button"
                variant="secondary"
                onClick={(e: any) => handleSubmit(e, "draft")}
                disabled={isLoading}
                className="min-w-[160px]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save as Draft"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard")}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
          </form>
          <Dialog open={showAddCityModal} onOpenChange={setShowAddCityModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New City</DialogTitle>
                <DialogDescription>
                  Enter the name of the new city to add it to the system.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">City Name</label>
                  <input
                    type="text"
                    value={newCityName}
                    onChange={(e) => setNewCityName(e.target.value)}
                    placeholder="E.g., Islamabad"
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <Button
                  onClick={handleCreateCity}
                  disabled={isAddingLocation || !newCityName.trim()}
                  className="w-full"
                >
                  {isAddingLocation ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Add City
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add Area Modal */}
          <Dialog open={showAddAreaModal} onOpenChange={setShowAddAreaModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Area</DialogTitle>
                <DialogDescription>
                  Enter the name of the new area for the selected city.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Area Name</label>
                  <input
                    type="text"
                    value={newAreaName}
                    onChange={(e) => setNewAreaName(e.target.value)}
                    placeholder="E.g., DHA Phase 1"
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <Button
                  onClick={handleCreateArea}
                  disabled={isAddingLocation || !newAreaName.trim()}
                  className="w-full"
                >
                  {isAddingLocation ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Add Area
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
