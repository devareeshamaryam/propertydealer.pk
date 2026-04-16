"use client"

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, X, Plus } from 'lucide-react'
import { toTitleCase } from '@/lib/utils'
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
import dynamic from 'next/dynamic'
const RichEditor = dynamic(() => import('@/components/RichEditor'), {
  ssr: false,
  loading: () => <div className="h-[200px] w-full bg-gray-100 animate-pulse rounded-lg flex items-center justify-center text-gray-400">Loading Editor...</div>
})

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
  name: string
  city: string | City
}

export default function EditProperty() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  // Form state
  const [listingType, setListingType] = useState<'rent' | 'sale'>('rent')
  const [propertyType, setPropertyType] = useState('')
  const [cityId, setCityId] = useState('')
  const [areaId, setAreaId] = useState('')
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [bedrooms, setBedrooms] = useState('')
  const [bathrooms, setBathrooms] = useState('')
  const [areaSize, setAreaSize] = useState('') // Property size in sq ft
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [latitude, setLatitude] = useState<number | undefined>()
  const [longitude, setLongitude] = useState<number | undefined>()
  const [videoUrl, setVideoUrl] = useState('')

  // Cities and Areas state
  const [cities, setCities] = useState<City[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [loadingProperty, setLoadingProperty] = useState(true)
  const [loadingAreas, setLoadingAreas] = useState(false)
  const [showAddCityModal, setShowAddCityModal] = useState(false)
  const [showAddAreaModal, setShowAddAreaModal] = useState(false)
  const [newCityName, setNewCityName] = useState('')
  const [newAreaName, setNewAreaName] = useState('')
  const [isAddingLocation, setIsAddingLocation] = useState(false)

  // Image state
  const [mainImageFile, setMainImageFile] = useState<File | null>(null)
  const [mainImagePreview, setMainImagePreview] = useState<string | null>(null)

  // Separate state for existing and new additional images
  const [existingImages, setExistingImages] = useState<string[]>([])
  const [newImages, setNewImages] = useState<{ file: File, preview: string }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [marla, setMarla] = useState('')
  const [kanal, setKanal] = useState('')

  const [features, setFeatures] = useState<string[]>([''])

  const params = useParams()
  const propertyId = params.id as string


  // Fetch cities on component mount
  useEffect(() => {
    const fetchCities = async () => {
      try {
        const data = await cityApi.getAll()
        setCities(prev => {
          // Merge fetched cities with existing (which might have our seeded city)
          const newCities = [...prev]
          data.forEach((city: any) => {
            if (!newCities.find(c => String(c._id) === String(city._id))) {
              newCities.push(city)
            }
          })
          return newCities
        })
      } catch (error: any) {
        console.error('Error fetching cities:', error)
        toast.error('Error', {
          description: 'Failed to load cities. Please try again.',
        })
      }
    }
    fetchCities()
  }, [])

  // Fetch property data
  useEffect(() => {
    const fetchProperty = async (propertyId: string) => {
      try {
        setLoadingProperty(true)
        const property = await propertyApi.getPropertyById({ id: propertyId })

        setListingType(property.listingType)

        // Map backend lowercase type to capitalized frontend type
        const typeMapping: Record<string, string> = {
          'house': 'House',
          'apartment': 'Apartment',
          'flat': 'Flat',
          'commercial': 'Commercial',
          'land': 'Land',
          'shop': 'Shop',
          'office': 'Office',
          'factory': 'Factory',
          'hotel': 'Hotel',
          'restaurant': 'Restaurant',
          'plot': 'Plot'
        }
        setPropertyType(typeMapping[property.propertyType] || 'House')

        // Handle populated Area and City
        if (property.area && typeof property.area === 'object') {
          const areaObj = property.area;
          const areaIdStr = String(areaObj._id);

          // Seed cities list with the current city if it's populated
          if (areaObj.city && typeof areaObj.city === 'object') {
            const cityObj = areaObj.city;
            const cityIdStr = String(cityObj._id);
            setCityId(cityIdStr);
            setCities(prev => {
              const exists = prev.find(c => String(c._id) === cityIdStr);
              return exists ? prev : [...prev, cityObj];
            });
          } else if (areaObj.city) {
            setCityId(String(areaObj.city));
          }

          // Seed areas list with the current area
          setAreaId(areaIdStr);
          setAreas(prev => {
            const exists = prev.find(a => String(a._id) === areaIdStr);
            return exists ? prev : [...prev, areaObj];
          });
        } else if (property.area) {
          setAreaId(String(property.area));
        }

        setTitle(property.title)
        setLocation(property.location)
        setBedrooms(property.bedrooms?.toString() || '0')
        setBathrooms(property.bathrooms?.toString() || '0')
        setAreaSize(property.areaSize?.toString() || '0')
        setPrice(property.price?.toString() || '0')
        setMarla(property.marla?.toString() || '')
        setKanal(property.kanal?.toString() || '')
        setDescription(property.description || '')
        setContactNumber(property.contactNumber || '')
        setWhatsappNumber(property.whatsappNumber || '')
        setLatitude(property.latitude)
        setLongitude(property.longitude)
        setVideoUrl(property.videoUrl || '')

        // Correct field names for images
        setMainImagePreview(property.mainPhotoUrl || null)
        setExistingImages(property.additionalPhotosUrls || [])

        setFeatures(property.features && property.features.length > 0 ? property.features : [''])
      } catch (error: any) {
        console.error('Error fetching property:', error)
        toast.error('Error', {
          description: 'Failed to load property. Please try again.',
        })
      } finally {
        setLoadingProperty(false)
      }
    }
    if (propertyId) {
      fetchProperty(propertyId)
    }

  }, [propertyId])

  useEffect(() => {
    const fetchAreas = async () => {
      if (!cityId) {
        setAreas([])
        return
      }

      try {
        setLoadingAreas(true)
        const data = await areaApi.getAll(cityId)

        setAreas(prev => {
          // Merge fetched areas with existing (which might have our seeded area)
          const newAreas = [...prev]
          data.forEach((area: any) => {
            if (!newAreas.find(a => String(a._id) === String(area._id))) {
              newAreas.push(area)
            }
          })
          return newAreas
        })
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

    if (!loadingProperty) {
      fetchAreas()
    }
  }, [cityId, loadingProperty])

  const handleCreateCity = async () => {
    if (!newCityName.trim()) return
    try {
      setIsAddingLocation(true)
      const data = await cityApi.create({ name: toTitleCase(newCityName.trim()) })
      toast.success('City added successfully')
      const allCities = await cityApi.getAll()
      setCities(allCities)
      setCityId(String(data._id))
      setAreaId('')
      setShowAddCityModal(false)
      setNewCityName('')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add city')
    } finally {
      setIsAddingLocation(false)
    }
  }

  const generateSlug = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

  const handleCreateArea = async () => {
    if (!newAreaName.trim() || !cityId) return
    try {
      setIsAddingLocation(true)
      const areaSlug = generateSlug(newAreaName)
      const data = await areaApi.create({ name: toTitleCase(newAreaName.trim()), city: cityId, areaSlug })
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
      setMainImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setMainImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeMainImage = () => {
    setMainImageFile(null)
    setMainImagePreview(null)
  }

  const handleAddImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      Array.from(files).forEach(file => {
        const reader = new FileReader()
        reader.onloadend = () => {
          setNewImages(prev => [...prev, { file, preview: reader.result as string }])
        }
        reader.readAsDataURL(file)
      })
    }
  }

  const removeImage = (index: number) => {
    if (index < existingImages.length) {
      setExistingImages(prev => prev.filter((_, i) => i !== index))
    } else {
      const newImageIndex = index - existingImages.length
      setNewImages(prev => prev.filter((_, i) => i !== newImageIndex))
    }
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
      'Shop': 'shop',
      'Office': 'office',
      'Flat': 'flat',
      'Commercial': 'commercial',
      'Plot': 'plot',
      'Land': 'land',
      'Factory': 'factory',
      'Hotel': 'hotel',
      'Restaurant': 'restaurant',
      'Other': 'other'
    }
    return mapping[type] || type.toLowerCase()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!propertyType || !cityId || !areaId || !title || !location || !bedrooms || !bathrooms || !areaSize || !price || !description || !contactNumber) {
      toast.error('Please fill in all required fields')
      return
    }

    // Main image is optional when editing (only required if no existing preview)
    if (!mainImageFile && !mainImagePreview) {
      toast.error('Please upload a main photo or keep the existing one')
      return
    }

    setIsLoading(true)

    try {
      // Create FormData
      const formData = new FormData()

      // Add main photo only if a new file is selected
      if (mainImageFile) {
        formData.append('mainPhoto', mainImageFile)
      }

      // Add JSON data as separate fields (backend expects these in the body)
      formData.append('listingType', listingType)
      formData.append('propertyType', mapPropertyTypeToBackend(propertyType))
      formData.append('area', areaId) // Area ID (ObjectId)
      formData.append('title', title)
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

      // Append existing photos
      existingImages.forEach(url => {
        formData.append('existingPhotos', url)
      })

      // Append new photos
      newImages.forEach(img => {
        formData.append('additionalPhotos', img.file)
      })

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

      // Update property using the property ID
      const response = await propertyApi.update(propertyId, formData)

      toast.success('Property updated successfully!', {
        description: 'Your property has been updated.',
      })

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push('/dashboard/property')
        router.refresh()
      }, 1500)

    } catch (error: any) {
      console.error('Error updating property:', error)
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        'Failed to update property. Please try again.'

      toast.error('Update Failed', {
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
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Update Property</h1>
          <p className="text-gray-600 mb-8">Fill in the details to update your property</p>

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
                <Select
                  value={cityId}
                  onValueChange={(value) => {
                    setCityId(value)
                    setAreaId('')
                  }}
                  disabled={isLoading || loadingProperty}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={loadingProperty ? "Loading property..." : "Select city"} />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map((city) => (
                      <SelectItem key={String(city._id)} value={String(city._id)}>
                        {city.name}
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
                      <SelectItem key={String(area._id)} value={String(area._id)}>
                        {area.name}
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

            {/* Main Photo Upload */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Main Photo *
              </label>
              {mainImagePreview ? (
                <div className="relative">
                  <img
                    src={mainImagePreview}
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
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-500 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleMainImageUpload}
                    disabled={isLoading}
                    className="hidden"
                    id="main-photo"
                  />
                  <label htmlFor="main-photo" className="cursor-pointer">
                    <div className="flex flex-col items-center">
                      <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-700">Click to upload main photo</span>
                      <span className="text-xs text-gray-500 mt-1">PNG, JPG up to 10MB</span>
                    </div>
                  </label>
                </div>
              )}
            </div>

            {/* Additional Photos */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Additional Photos
              </label>
              <div className="grid grid-cols-3 gap-4">
                {[...existingImages, ...newImages.map(n => n.preview)].map((preview, index) => (
                  <div key={index} className="relative">
                    <img
                      src={preview}
                      alt={`Additional ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <Button
                      type="button"
                      onClick={() => removeImage(index)}
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
                  'Update Property'
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