"use client"

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, X, Plus, Image as ImageIcon } from 'lucide-react'
import { propertyApi } from '@/lib/api'
import cityApi from '@/lib/api/city/city.api'
import areaApi from '@/lib/api/area/area.api'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { ImagePickerDialog, type GalleryImageItem } from '@/components/ImagePickerDialog'
import { toTitleCase } from '@/lib/utils'
import dynamic from 'next/dynamic'
const RichEditor = dynamic(() => import('@/components/RichEditor'), {
  ssr: false,
  loading: () => <div className="h-[200px] w-full bg-gray-100 animate-pulse rounded-lg flex items-center justify-center text-gray-400">Loading Editor...</div>
})

// Dynamically import MapPicker as it uses window object
const MapPicker = dynamic(() => import('@/components/MapPicker'), {
  ssr: false,
  loading: () => <div className="h-[300px] w-full bg-gray-100 animate-pulse rounded-lg flex items-center justify-center text-gray-400">Loading Map...</div>
})

interface City {
  _id: string
  name: string
  state: string
  country: string
}

interface Area {
  _id: string
  areaslug: string
  name: string
  city: string | City
}

export default function AddProperty() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  // Form state
  const [listingType, setListingType] = useState<'rent' | 'sale'>('rent')
  const [propertyType, setPropertyType] = useState('')
  const [cityId, setCityId] = useState('')
  const [areaId, setAreaId] = useState('')
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [isSlugEdited, setIsSlugEdited] = useState(false)
  const [location, setLocation] = useState('')
  const [bedrooms, setBedrooms] = useState('')
  const [bathrooms, setBathrooms] = useState('')
  const [areaSize, setAreaSize] = useState('') // Property size in sq ft
  const [price, setPrice] = useState('')
  const [marla, setMarla] = useState('')
  const [kanal, setKanal] = useState('')
  const [description, setDescription] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [latitude, setLatitude] = useState<number | undefined>()
  const [longitude, setLongitude] = useState<number | undefined>()
  const [videoUrl, setVideoUrl] = useState('')

  // Cities and Areas state
  const [cities, setCities] = useState<City[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [loadingCities, setLoadingCities] = useState(true)
  const [loadingAreas, setLoadingAreas] = useState(false)

  // Image state - store both File objects and preview URLs
  const [mainImageFile, setMainImageFile] = useState<File | null>(null)
  const [mainImagePreview, setMainImagePreview] = useState<string | null>(null)
  const [additionalImageFiles, setAdditionalImageFiles] = useState<File[]>([])
  const [additionalImagePreviews, setAdditionalImagePreviews] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [features, setFeatures] = useState<string[]>([''])

  // Gallery image selection state
  const [mainImageSource, setMainImageSource] = useState<'upload' | 'gallery'>('upload')
  const [mainImageUrl, setMainImageUrl] = useState<string | null>(null)
  const [galleryDialogOpen, setGalleryDialogOpen] = useState(false)
  const [showAddCityModal, setShowAddCityModal] = useState(false)
  const [showAddAreaModal, setShowAddAreaModal] = useState(false)
  const [newCityName, setNewCityName] = useState('')
  const [newAreaName, setNewAreaName] = useState('')
  const [isAddingLocation, setIsAddingLocation] = useState(false)

  // Fetch cities on component mount
  useEffect(() => {
    const fetchCitiesData = async () => {
      try {
        setLoadingCities(true)
        const data = await cityApi.getAll()
        setCities(data)
      } catch (error: any) {
        console.error('Error fetching cities:', error)
        toast.error('Error', {
          description: 'Failed to load cities. Please try again.',
        })
      } finally {
        setLoadingCities(false)
      }
    }
    fetchCitiesData()
  }, [])

  // Fetch areas when city changes
  useEffect(() => {
    const fetchAreasData = async () => {
      if (!cityId) {
        setAreas([])
        setAreaId('') // Reset area when city is cleared
        return
      }

      try {
        setLoadingAreas(true)
        const data = await areaApi.getAll(cityId)
        setAreas(data)
        setAreaId('') // Reset area selection when city changes
      } catch (error: any) {
        console.error('Error fetching areas:', error)
        toast.error('Error', {
          description: 'Failed to load areas. Please try again.',
        })
        setAreas([])
      } finally {
        setLoadingAreas(false)
      }
    }

    fetchAreasData()
  }, [cityId])

  const handleCreateCity = async () => {
    if (!newCityName.trim()) return
    try {
      setIsAddingLocation(true)
      const data = await cityApi.create({ name: toTitleCase(newCityName.trim()) })
      toast.success('City added successfully')
      const allCities = await cityApi.getAll()
      setCities(allCities)
      setCityId(String(data._id))
      setShowAddCityModal(false)
      setNewCityName('')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add city')
    } finally {
      setIsAddingLocation(false)
    }
  }

  const handleCreateArea = async () => {
    if (!newAreaName.trim() || !cityId) return
    try {
      setIsAddingLocation(true)
      const slug = generateSlug(newAreaName)
      const data = await areaApi.create({ name: toTitleCase(newAreaName.trim()), city: cityId, areaSlug: slug })
      toast.success('Area added successfully')
      const allAreas = await areaApi.getAll(cityId)
      setAreas(allAreas)
      setAreaId(String(data._id))
      setShowAddAreaModal(false)
      setNewAreaName('')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add area')
    } finally {
      setIsAddingLocation(false)
    }
  }

  const handleMainImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setMainImageSource('upload')
      setMainImageUrl(null)
      setMainImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setMainImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAddImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const newFiles = Array.from(files)
      setAdditionalImageFiles(prev => [...prev, ...newFiles])

      newFiles.forEach(file => {
        const reader = new FileReader()
        reader.onloadend = () => {
          setAdditionalImagePreviews(prev => [...prev, reader.result as string])
        }
        reader.readAsDataURL(file)
      })
    }
  }

  const removeMainImage = () => {
    setMainImageFile(null)
    setMainImagePreview(null)
    setMainImageUrl(null)
  }

  const removeAdditionalImage = (index: number) => {
    setAdditionalImageFiles(prev => prev.filter((_, i) => i !== index))
    setAdditionalImagePreviews(prev => prev.filter((_, i) => i !== index))
  }

  const addFeature = () => {
    setFeatures([...features, ''])
  }

  const updateFeature = (index: number, value: string) => {
    const newFeatures = [...features]
    newFeatures[index] = value
    setFeatures(newFeatures)
  }

  const removeFeature = (index: number) => {
    setFeatures(features.filter((_, i) => i !== index))
  }

  // Map frontend propertyType to backend format (lowercase)
  const mapPropertyTypeToBackend = (type: string): string => {
    const mapping: Record<string, string> = {
      'House': 'house',
      'Apartment': 'apartment',
      'Flat': 'flat',
      'Commercial': 'commercial',
      'Plot': 'plot',
      'Land': 'land',
      'Shop': 'shop',
      'Office': 'office',
      'Factory': 'factory',
      'Hotel': 'hotel',
      'Restaurant': 'restaurant',
      'Other': 'other'
    }
    return mapping[type] || type.toLowerCase()
  }

  const generateSlug = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const computedSlug = slug?.trim() ? slug : generateSlug(title)
    if (!slug?.trim() && computedSlug) {
      setSlug(computedSlug)
      setIsSlugEdited(false)
    }

    // Validation
    if (!propertyType || !cityId || !areaId || !title || !computedSlug || !location || !bedrooms || !bathrooms || !areaSize || !price || !description || !contactNumber) {
      toast.error('Please fill in all required fields')
      return
    }

    if (!mainImageFile && !mainImageUrl) {
      toast.error('Please upload a main photo or select one from the gallery')
      return
    }

    setIsLoading(true)

    try {
      // Create FormData
      const formData = new FormData()

      // Add main photo (either uploaded file or existing URL from gallery)
      if (mainImageFile) {
        formData.append('mainPhoto', mainImageFile)
      } else if (mainImageUrl) {
        formData.append('mainPhotoUrl', mainImageUrl)
      }

      // Add additional photos (only non-null files)
      additionalImageFiles.forEach((file) => {
        if (file) {
          formData.append('additionalPhotos', file)
        }
      })

      // Add JSON data as separate fields (backend expects these in the body)
      formData.append('listingType', listingType)
      formData.append('propertyType', mapPropertyTypeToBackend(propertyType))
      formData.append('area', areaId) // Area ID (ObjectId)
      formData.append('title', title)
      formData.append('slug', computedSlug)
      formData.append('location', location)
      formData.append('bedrooms', bedrooms)
      formData.append('bathrooms', bathrooms)
      formData.append('areaSize', areaSize) // Property size in sq ft
      formData.append('price', price)
      if (marla) formData.append('marla', marla)
      if (kanal) formData.append('kanal', kanal)
      formData.append('description', description)
      formData.append('contactNumber', contactNumber)
      formData.append('whatsappNumber', whatsappNumber || contactNumber)

      if (latitude !== undefined) formData.append('latitude', latitude.toString())
      if (longitude !== undefined) formData.append('longitude', longitude.toString())
      if (videoUrl) formData.append('videoUrl', videoUrl)

      // Add features (filter out empty strings)
      const validFeatures = features.filter(f => f.trim() !== '')
      if (validFeatures.length > 0) {
        validFeatures.forEach((feature, index) => {
          formData.append(`features[${index}]`, feature)
        })
      }

      // Submit to API
      const response = await propertyApi.create(formData)

      toast.success('Property submitted successfully!', {
        description: 'Your property is pending approval and will be visible once approved.',
      })

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push('/dashboard/property')
        router.refresh()
      }, 1500)

    } catch (error: any) {
      console.error('Error submitting property:', error)
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        'Failed to submit property. Please try again.'

      toast.error('Submission Failed', {
        description: errorMessage,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Add New Property</h1>
          <p className="text-gray-600 mb-8">Fill in the details to list your property</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Listing Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Listing Type *
              </label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setListingType('rent')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${listingType === 'rent'
                    ? 'bg-gray-800 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  For Rent
                </button>
                <button
                  type="button"
                  onClick={() => setListingType('sale')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${listingType === 'sale'
                    ? 'bg-gray-800 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
              <Select value={propertyType} onValueChange={setPropertyType} disabled={isLoading}>
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
                <Select value={cityId} onValueChange={setCityId} disabled={isLoading || loadingCities}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={loadingCities ? "Loading cities..." : "Select city"} />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map((city) => (
                      <SelectItem key={String(city._id)} value={String(city._id)}>
                        {city.name || 'Unnamed City'}
                      </SelectItem>
                    ))}
                    <div
                      className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 text-primary font-medium hover:bg-gray-100 cursor-pointer"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowAddCityModal(true);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" /> Add New City
                    </div>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Area *
                </label>
                <Select value={areaId} onValueChange={setAreaId} disabled={isLoading || loadingAreas || !cityId}>
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
                      <SelectItem key={String(area._id)} value={String(area._id)}>
                        {area.name || 'Unnamed Area'}
                      </SelectItem>
                    ))}
                    {cityId && (
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
                {!cityId && (
                  <p className="text-xs text-gray-500 mt-1">Please select a city first</p>
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
                  const nextTitle = e.target.value
                  setTitle(nextTitle)
                  if (!isSlugEdited) {
                    setSlug(generateSlug(nextTitle))
                  }
                  if (!nextTitle.trim()) {
                    setSlug('')
                    setIsSlugEdited(false)
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
                  setSlug(generateSlug(e.target.value))
                  setIsSlugEdited(true)
                }}
                placeholder="E.g., luxury-3-bedroom-apartment-in-dha"
                disabled={isLoading || title === ''}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {!title && (
                <p className="text-xs text-gray-500 mt-1">Please enter a title first</p>
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
                <MapPicker
                  onLocationSelect={(lat, lng) => {
                    setLatitude(lat)
                    setLongitude(lng)
                  }}
                  initialLat={latitude}
                  initialLng={longitude}
                />
              </div>
              <p className="text-xs text-gray-500">
                Click on the map to pin the exact location of your property.
                {latitude && longitude && (
                  <span className="text-green-600 font-medium ml-1">
                    Location pinned: {latitude.toFixed(4)}, {longitude.toFixed(4)}
                  </span>
                )}
              </p>
            </div>

            {/* Beds, Baths, and Area */}
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
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Property Size (sq ft) *
                </label>
                <input
                  type="number"
                  min="0"
                  value={areaSize}
                  onChange={(e) => setAreaSize(e.target.value)}
                  placeholder="0"
                  disabled={isLoading}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Marla and Kanal */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Marla
                </label>
                <input
                  type="number"
                  min="0"
                  value={marla}
                  onChange={(e) => setMarla(e.target.value)}
                  placeholder="0"
                  disabled={isLoading}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Kanal
                </label>
                <input
                  type="number"
                  min="0"
                  value={kanal}
                  onChange={(e) => setKanal(e.target.value)}
                  placeholder="0"
                  disabled={isLoading}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Price */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                {listingType === 'rent' ? 'Monthly Rent (PKR) *' : 'Sale Price (PKR) *'}
              </label>
              <input
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Enter amount"
                disabled={isLoading}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Main Photo - Upload or Gallery */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Main Photo *
              </label>

              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setMainImageSource('upload')}
                  className={`text-xs px-3 py-1.5 rounded-full border ${mainImageSource === 'upload'
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-700 border-gray-200'
                    }`}
                >
                  Upload new
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMainImageSource('gallery')
                    setGalleryDialogOpen(true)
                  }}
                  className={`text-xs px-3 py-1.5 rounded-full border flex items-center gap-1 ${mainImageSource === 'gallery'
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-700 border-gray-200'
                    }`}
                >
                  <ImageIcon className="w-3 h-3" />
                  Choose from gallery
                </button>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-500 transition-colors">
                {(mainImagePreview && mainImageSource === 'upload') || (mainImageUrl && mainImageSource === 'gallery') ? (
                  <div className="relative">
                    <img
                      src={mainImageSource === 'upload' ? mainImagePreview! : mainImageUrl!}
                      alt="Main property"
                      className="w-full h-64 object-cover rounded-lg"
                    />
                    <Button
                      type="button"
                      onClick={removeMainImage}
                      variant="destructive"
                      size="icon"
                      className="absolute top-3 right-3"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col items-center">
                      <ImageIcon className="w-12 h-12 text-gray-400 mb-3" />
                      <span className="text-sm font-medium text-gray-700 mb-1">
                        {mainImageSource === 'upload'
                          ? 'Click below to upload main photo'
                          : 'Choose a main photo from the gallery'}
                      </span>
                      <span className="text-xs text-gray-500 mb-3">PNG, JPG up to 10MB</span>

                      {mainImageSource === 'upload' ? (
                        <>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleMainImageUpload}
                            disabled={isLoading}
                            className="hidden"
                            id="main-photo"
                          />
                          <label
                            htmlFor="main-photo"
                            className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-gray-800 transition-colors"
                          >
                            Select Image
                          </label>
                        </>
                      ) : (
                        <Button
                          type="button"
                          onClick={() => setGalleryDialogOpen(true)}
                          className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                        >
                          <ImageIcon className="w-4 h-4 mr-2" />
                          Open Gallery
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Additional Photos */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Additional Photos
              </label>
              <div className="grid grid-cols-3 gap-4">
                {additionalImagePreviews.map((preview, index) => (
                  <div key={index} className="relative">
                    <img
                      src={preview}
                      alt={`Additional ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <Button
                      type="button"
                      onClick={() => removeAdditionalImage(index)}
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}

                {/* Add More Button */}
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-500 transition-colors h-32 flex items-center justify-center cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center">
                    <Plus className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-xs text-gray-600">Add Photos</span>
                  </div>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleAddImages}
                  disabled={isLoading}
                  className="hidden"
                  ref={fileInputRef}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Property Description *
              </label>
              {/* rich editor */}
              <RichEditor value={description} onChange={setDescription} />
            </div>

            {/* Video URL */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                YouTube Video URL (Optional)
              </label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                disabled={isLoading}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">Provide a YouTube link to showcase a video of your property.</p>
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
                <p className="text-xs text-gray-500 mt-1">If empty, contact number will be used for WhatsApp.</p>
              </div>
            </div>

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
                    Submitting...
                  </>
                ) : (
                  'Publish Property'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/dashboard')}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
          </form>
          {/* Gallery picker dialog for main image */}
          <ImagePickerDialog
            open={galleryDialogOpen}
            onOpenChange={setGalleryDialogOpen}
            onSelect={(image: GalleryImageItem) => {
              setMainImageSource('gallery')
              setMainImageUrl(image.url)
              setMainImageFile(null)
              setMainImagePreview(null)
            }}
            title="Select Main Property Image"
            description="Choose an existing image from the gallery to use as the main photo for this property."
          />

          {/* Add City Modal */}
          <Dialog open={showAddCityModal} onOpenChange={setShowAddCityModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New City</DialogTitle>
                <DialogDescription>Enter the name of the new city to add it to the system.</DialogDescription>
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
                  {isAddingLocation ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
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
                <DialogDescription>Enter the name of the new area for the selected city.</DialogDescription>
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
                  {isAddingLocation ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Add Area
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  )
}