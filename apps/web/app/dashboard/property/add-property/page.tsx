"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Loader2, Plus } from "lucide-react";
import { propertyApi, subscriptionApi, userApi } from "@/lib/api";
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

import { GalleryField, VideoField } from "@/components/media";
import {
  AreaSizeField,
  FeaturesPicker,
  FormSteps,
  PriceField,
} from "@/components/dashboard";
import { toTitleCase } from "@/lib/utils";
import { marlaKanalFor } from "@/lib/pk";
import { useAuth } from "@/context/auth-context";
import dynamic from "next/dynamic";
const RichEditor = dynamic(() => import("@/components/RichEditor"), {
  ssr: false,
  loading: () => (
    <div className="h-[200px] w-full bg-gray-100 animate-pulse rounded-lg flex items-center justify-center text-gray-400">
      Loading Editor...
    </div>
  ),
});

// Dynamically import MapPicker as it uses window object
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
  areaslug: string;
  name: string;
  city: string | City;
}

/**
 * Three steps rather than one twenty-field scroll.
 *
 * This is how every portal in this market takes a listing (OLX, Zameen,
 * Graana): what and where, then the numbers, then the photos. Each step
 * validates only its own fields, so an agent is told what is missing while it
 * is still on screen instead of after pressing Publish at the bottom.
 */
const PROPERTY_STEPS = [
  {
    id: 1,
    title: "Property & location",
    hint: "What you are listing, and where it is.",
  },
  {
    id: 2,
    title: "Size & price",
    hint: "Rooms, plot size in marla or kanal, and the asking price.",
  },
  {
    id: 3,
    title: "Photos & contact",
    hint: "Photos sell the listing — add as many as you have.",
  },
];

export default function AddProperty() {
  const router = useRouter();
  const { user, refreshSession } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  /**
   * What this account is allowed to publish. Fetched up front so a full form
   * is never the way someone finds out their free listing is used up.
   */
  const [planState, setPlanState] = useState<{
    name: string;
    used: number;
    propertyLimit: number;
    canCreate: boolean;
  } | null>(null);

  // Form state
  const [listingType, setListingType] = useState<"rent" | "sale">("rent");
  const [propertyType, setPropertyType] = useState("");
  const [cityId, setCityId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [isSlugEdited, setIsSlugEdited] = useState(false);
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
  const [loadingCities, setLoadingCities] = useState(true);
  const [loadingAreas, setLoadingAreas] = useState(false);

  // Photos, in display order. The first is the cover. They are already
  // uploaded to the media library by the time they land here, so this is a
  // list of URLs rather than File objects waiting to be posted.
  const [photos, setPhotos] = useState<string[]>([]);
  // One short walkthrough clip, shown as the last slide of the gallery.
  const [videoUrl, setVideoUrl] = useState("");
  const [videoPosterUrl, setVideoPosterUrl] = useState("");
  const [features, setFeatures] = useState<string[]>([""]);

  // Gallery image selection state
  const [showAddCityModal, setShowAddCityModal] = useState(false);
  const [showAddAreaModal, setShowAddAreaModal] = useState(false);
  const [newCityName, setNewCityName] = useState("");
  const [newAreaName, setNewAreaName] = useState("");
  const [isAddingLocation, setIsAddingLocation] = useState(false);

  /*
   * A backstop, for the accounts that predate agent-by-default.
   *
   * Sign-up makes every new account an AGENT now, so this does nothing for
   * almost everyone. It stays for the USER rows created while sign-up still
   * asked "buying or selling?" — they open this form, get promoted, and never
   * see an application or an admin step.
   *
   * The role lives inside the JWT, so the session is refreshed straight after:
   * without that the sidebar would keep showing a buyer's dashboard until the
   * next sign-in.
   */
  useEffect(() => {
    if (!user || isAdmin) return;
    if (user.role === "AGENT") return;

    let cancelled = false;

    (async () => {
      try {
        await userApi.becomeAgent();
        if (!cancelled) await refreshSession();
      } catch (error) {
        // Not fatal: the listing still saves, and the API promotes the account
        // again when the property is actually created.
        console.error("Could not switch this account to an agent:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, isAdmin, refreshSession]);

  useEffect(() => {
    if (isAdmin) return;
    let cancelled = false;

    (async () => {
      try {
        const plan = await subscriptionApi.getMyPlan();
        if (!cancelled) setPlanState(plan);
      } catch {
        // Older API build, or a network hiccup. The server still enforces the
        // limit on save; this banner is a courtesy.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  // Fetch cities on component mount
  useEffect(() => {
    const fetchCitiesData = async () => {
      try {
        setLoadingCities(true);
        const data = await cityApi.getAll();
        setCities(data);
      } catch (error: any) {
        console.error("Error fetching cities:", error);
        toast.error("Error", {
          description: "Failed to load cities. Please try again.",
        });
      } finally {
        setLoadingCities(false);
      }
    };
    fetchCitiesData();
  }, []);

  // Fetch areas when city changes
  useEffect(() => {
    const fetchAreasData = async () => {
      if (!cityId) {
        setAreas([]);
        setAreaId(""); // Reset area when city is cleared
        return;
      }

      try {
        setLoadingAreas(true);
        const data = await areaApi.getAll(cityId);
        setAreas(data);
        setAreaId(""); // Reset area selection when city changes
      } catch (error: any) {
        console.error("Error fetching areas:", error);
        toast.error("Error", {
          description: "Failed to load areas. Please try again.",
        });
        setAreas([]);
      } finally {
        setLoadingAreas(false);
      }
    };

    fetchAreasData();
  }, [cityId]);
  /** The chosen city and area by name, for the map search box. */
  const selectedCityName =
    cities.find((c) => String(c._id) === cityId)?.name ?? "";
  const selectedAreaName =
    areas.find((a) => String(a._id) === areaId)?.name ?? "";

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
      setShowAddCityModal(false);
      setNewCityName("");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to add city");
    } finally {
      setIsAddingLocation(false);
    }
  };

  const handleCreateArea = async () => {
    if (!newAreaName.trim() || !cityId) return;
    try {
      setIsAddingLocation(true);
      const slug = generateSlug(newAreaName);
      const data = await areaApi.create({
        name: toTitleCase(newAreaName.trim()),
        city: cityId,
        areaSlug: slug,
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

  // Map frontend propertyType to backend format (lowercase)
  const mapPropertyTypeToBackend = (type: string): string => {
    const mapping: Record<string, string> = {
      House: "house",
      Apartment: "apartment",
      Flat: "flat",
      Commercial: "commercial",
      Plot: "plot",
      Land: "land",
      Shop: "shop",
      Office: "office",
      Factory: "factory",
      Hotel: "hotel",
      Restaurant: "restaurant",
      Other: "other",
    };
    return mapping[type] || type.toLowerCase();
  };

  const generateSlug = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const handleSubmit = async (e: React.FormEvent, asDraft: boolean = false) => {
    e.preventDefault();

    const computedSlug = slug?.trim() ? slug : generateSlug(title);
    if (!slug?.trim() && computedSlug) {
      setSlug(computedSlug);
      setIsSlugEdited(false);
    }

    // Validation. Drafts are intentionally lenient — only the title is required
    // so that admins can save partially-filled WIP listings (matches WordPress
    // draft behaviour). Publish/submit still requires the full set of fields.
    if (asDraft) {
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
        !computedSlug ||
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

      if (photos.length === 0 && !videoUrl) {
        toast.error("Add at least one photo or walkthrough video");
        return;
      }
    }

    setIsLoading(true);

    try {
      // Create FormData
      const formData = new FormData();

      // The photos are already in the media library, so the form posts their
      // URLs. The API accepts mainPhotoUrl / additionalPhotosUrls alongside the
      // older file fields, so nothing on the server had to change.
      const [cover, ...rest] = photos;
      const effectiveCover = cover || videoPosterUrl || "";
      if (effectiveCover) formData.append("mainPhotoUrl", effectiveCover);
      for (const url of rest) formData.append("additionalPhotosUrls", url);
      // Tells the API this list is the gallery as it now stands, so removing
      // the last extra photo is saved as "no extra photos" rather than ignored.
      formData.append("photosProvided", "true");
      // Always sent, so clearing the video actually removes it.
      formData.append("videoUrl", videoUrl);
      formData.append("videoPosterUrl", videoPosterUrl);

      // Add JSON data as separate fields (backend expects these in the body)
      formData.append("listingType", listingType);
      formData.append("propertyType", mapPropertyTypeToBackend(propertyType));
      formData.append("area", areaId); // Area ID (ObjectId)
      formData.append("title", title);
      formData.append("slug", computedSlug);
      formData.append("location", location);
      formData.append("bedrooms", bedrooms);
      formData.append("bathrooms", bathrooms);
      formData.append("areaSize", areaSize); // Property size in sq ft
      formData.append("price", price);
      // Kept in step with the size: these two columns drive the marla/kanal
      // size filters and the area landing pages.
      const { marla, kanal } = marlaKanalFor(Number(areaSize));
      if (marla > 0) formData.append("marla", String(marla));
      if (kanal > 0) formData.append("kanal", String(kanal));
      formData.append("description", description);
      formData.append("contactNumber", contactNumber);
      formData.append("whatsappNumber", whatsappNumber || contactNumber);

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

      // Indicate intent to backend so it can apply role-based status logic
      if (asDraft) formData.append("status", "draft");

      // Submit to API
      const response = await propertyApi.create(formData);

      /*
       * What actually happened is decided on the server: a clean listing is
       * published immediately by the screening check, a questionable one waits
       * for an admin. Telling everyone "pending approval" would be wrong half
       * the time, so the real status is read back from the response.
       */
      const saved = response?.property ?? response?.data?.property;
      const savedStatus: string | undefined = saved?.status;

      if (asDraft) {
        toast.success("Saved as draft", {
          description:
            "You can find it under Drafts and publish it later from the dashboard.",
        });
      } else if (savedStatus === "approved") {
        toast.success("Your property is live", {
          description: "It is on the website now — share the link or view it.",
        });
      } else {
        toast.success("Property submitted", {
          description:
            "Our team is checking it for safety. It usually goes live the same day.",
        });
      }

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push("/dashboard/property");
        router.refresh();
      }, 1500);
    } catch (error: any) {
      console.error("Error submitting property:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to submit property. Please try again.";

      // A plan limit is not a failure the agent can fix by trying again.
      if (/plan|package|limit|subscription/i.test(String(errorMessage))) {
        toast.error("Listing limit reached", {
          description: errorMessage,
          action: {
            label: "See packages",
            onClick: () => router.push("/dashboard/purchase-package"),
          },
          duration: 10000,
        });
        return;
      }

      toast.error("Submission Failed", {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const goToStep = (next: number) => {
    setStep(next);
    // The form is taller than the viewport; land on the step heading.
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** Only the fields on screen are checked, with a message naming the step. */
  const handleContinue = () => {
    if (step === 1) {
      if (!propertyType) return toast.error("Choose the property type");
      if (!cityId) return toast.error("Choose the city");
      if (!areaId) return toast.error("Choose the area or society");
      if (!title.trim()) return toast.error("Add a title for the listing");
      if (!location.trim())
        return toast.error("Add the address or landmark");
    }

    if (step === 2) {
      if (!bedrooms) return toast.error("Enter the number of bedrooms");
      if (!bathrooms) return toast.error("Enter the number of bathrooms");
      if (!areaSize) return toast.error("Enter the property size");
      if (!price) return toast.error("Enter the price");
    }

    goToStep(Math.min(step + 1, PROPERTY_STEPS.length));
  };

  return (
    <div className="w-full">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-2xl font-semibold text-gray-800 mb-2">
            Add New Property
          </h1>
          <p className="text-gray-600 mb-6">
            Three short steps — you can save a draft at any point.
          </p>

          <FormSteps
            steps={PROPERTY_STEPS}
            current={step}
            onGoTo={goToStep}
            className="mb-6"
          />

          {planState && !planState.canCreate && (
            <div className="mb-6 flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center">
              <p className="flex-1">
                <span className="font-semibold">
                  Your {planState.name} plan is full
                </span>{" "}
                — {planState.used} of {planState.propertyLimit} listings used.
                You can still save this as a draft and publish it once you have
                a package.
              </p>
              <Button
                type="button"
                size="sm"
                className="shrink-0"
                onClick={() => router.push("/dashboard/purchase-package")}
              >
                See packages
              </Button>
            </div>
          )}

          <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
            {step === 1 && <>
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
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  City *
                </label>
                <Select
                  value={cityId}
                  onValueChange={setCityId}
                  disabled={isLoading || loadingCities}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        loadingCities ? "Loading cities..." : "Select city"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map((city) => (
                      <SelectItem
                        key={String(city._id)}
                        value={String(city._id)}
                      >
                        {city.name || "Unnamed City"}
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
                        {area.name || "Unnamed Area"}
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
                onChange={(e) => {
                  const nextTitle = e.target.value;
                  setTitle(nextTitle);
                  if (!isSlugEdited) {
                    setSlug(generateSlug(nextTitle));
                  }
                  if (!nextTitle.trim()) {
                    setSlug("");
                    setIsSlugEdited(false);
                  }
                }}
                placeholder="E.g., Luxury 3 Bedroom Apartment in DHA"
                disabled={isLoading}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Slug */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Slug *
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlug(generateSlug(e.target.value));
                  setIsSlugEdited(true);
                }}
                placeholder="E.g., luxury-3-bedroom-apartment-in-dha"
                disabled={isLoading || title === ""}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {!title && (
                <p className="text-xs text-gray-500 mt-1">
                  Please enter a title first
                </p>
              )}
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
                {/*
                  The map is tied to the address: "Find from address" searches
                  the street, area and city entered above, so the pin and the
                  written address describe the same place instead of drifting
                  apart. The city also decides the opening view.
                */}
                <MapPicker
                  onLocationSelect={(lat, lng) => {
                    setLatitude(lat);
                    setLongitude(lng);
                  }}
                  initialLat={latitude}
                  initialLng={longitude}
                  addressQuery={[location, selectedAreaName, selectedCityName]
                    .filter(Boolean)
                    .join(", ")}
                  city={selectedCityName}
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

            </>}

            {step === 2 && <>
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

            </>}

            {step === 3 && <>
            {/*
              One photo control instead of three.

              This used to be a "Main Photo" box with Upload / Choose-from-gallery
              tabs, plus a separate "Additional Photos" grid, plus a gallery
              dialog — and the main photo was mandatory before you could save.
              Now it is one gallery: select or drop as many photos as you like in
              one go, drag to reorder, and the first one is the cover.

              Photos upload through the media library as they are chosen, so by
              the time the form is submitted they are already WebP with readable
              file names and AI-written alt text, and the form posts URLs rather
              than re-uploading megabytes of files.
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

            <VideoField
              value={videoUrl}
              posterValue={videoPosterUrl}
              onChange={({ url, posterUrl }) => {
                setVideoUrl(url);
                setVideoPosterUrl(posterUrl);
              }}
              context={title || "Property walkthrough"}
              disabled={isLoading}
            />

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Property Description *
              </label>
              {/* rich editor */}
              <RichEditor
                value={description}
                onChange={setDescription}
                placeholder="Describe your property (features, amenities, nearby attractions, demand details)..."
                minHeight="min-h-[300px]"
              />
            </div>

            {/*
              Ticked, not typed: see lib/property-features.ts. The list shown
              follows the property type, and anything an older listing already
              says is kept as a custom chip.
            */}
            <FeaturesPicker
              value={features.filter((feature) => feature.trim() !== "")}
              onChange={setFeatures}
              propertyType={propertyType}
              disabled={isLoading}
            />

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

            </>}

            {/*
              An agent's listing is created as "pending" and an admin publishes
              it (property.service applies that by role). Saying so here beats
              finding out from a status badge afterwards.
            */}
            {step === PROPERTY_STEPS.length && !isAdmin && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Your listing is sent for approval and goes live once an admin
                reviews it — usually the same day.
              </p>
            )}

            {/* Navigation */}
            <div className="flex flex-wrap items-center gap-3 border-t pt-6">
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => goToStep(step - 1)}
                  disabled={isLoading}
                >
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  Back
                </Button>
              )}

              {step < PROPERTY_STEPS.length ? (
                <Button
                  type="button"
                  onClick={handleContinue}
                  disabled={isLoading}
                  className="min-w-[180px] flex-1 bg-gray-800 hover:bg-gray-900 sm:flex-none"
                >
                  Continue
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="min-w-[180px] flex-1 bg-gray-800 hover:bg-gray-900 sm:flex-none"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    isAdmin ? "Publish Property" : "Submit for approval"
                  )}
                </Button>
              )}

              {/* Available from any step: a draft only needs a title. */}
              <Button
                type="button"
                variant="secondary"
                onClick={(e: any) => handleSubmit(e, true)}
                disabled={isLoading}
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
                variant="ghost"
                onClick={() => router.push("/dashboard/property")}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>

          </form>
          {/* Add City Modal */}
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
