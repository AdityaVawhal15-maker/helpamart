import { useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, X, CheckCircle2, ZoomIn, ZoomOut } from 'lucide-react'
import Cropper from 'react-easy-crop'
import type { Area, Point } from 'react-easy-crop'
import { uploadProfilePhoto } from '@/lib/supabase'
import { useToast } from './Toast'
import 'react-easy-crop/react-easy-crop.css'

interface PhotoCropUploadProps {
  currentPhotoUrl: string | null
  photoInitials: string
  onPhotoUploadSuccess: (photoUrl: string) => void
  uploading?: boolean
  disabled?: boolean
}

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area
): Promise<Blob> {
  const image = new Image()
  image.src = imageSrc
  
  return new Promise((resolve, reject) => {
    image.onload = () => {
      const canvas = document.createElement('canvas')
      const scaleX = image.naturalWidth / image.width
      const scaleY = image.naturalHeight / image.height
      
      // Use the size of the crop area to create a square output
      const size = Math.min(pixelCrop.width, pixelCrop.height)
      canvas.width = size
      canvas.height = size
      
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }
      
      ctx.drawImage(
        image,
        pixelCrop.x * scaleX,
        pixelCrop.y * scaleY,
        size * scaleX,
        size * scaleY,
        0,
        0,
        size,
        size
      )
      
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Could not create image blob'))
        },
        'image/jpeg',
        0.95
      )
    }
    image.onerror = () => reject(new Error('Could not load image'))
  })
}

export function PhotoCropUpload({
  currentPhotoUrl,
  photoInitials,
  onPhotoUploadSuccess,
  uploading = false,
  disabled = false,
}: PhotoCropUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const { toast } = useToast()

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showCropModal, setShowCropModal] = useState(false)
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast('Please select a JPG, PNG, or WebP image.', 'error')
      return
    }

    // Validate file size (4MB)
    if (file.size > 4 * 1024 * 1024) {
      toast('Image must be less than 4MB.', 'error')
      return
    }

    setSelectedFile(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string)
      setShowCropModal(true)
      // Reset crop state for new image
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCroppedAreaPixels(null)
    }
    reader.readAsDataURL(file)
  }

  const handleCropComplete = useCallback((croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
    
    // Update preview canvas in real-time
    if (previewCanvasRef.current && previewUrl) {
      const image = new Image()
      image.src = previewUrl
      image.onload = () => {
        const canvas = previewCanvasRef.current
        if (!canvas) return
        
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        
        const scaleX = image.naturalWidth / image.width
        const scaleY = image.naturalHeight / image.height
        
        const size = Math.min(croppedAreaPixels.width, croppedAreaPixels.height)
        canvas.width = size
        canvas.height = size
        
        ctx.drawImage(
          image,
          croppedAreaPixels.x * scaleX,
          croppedAreaPixels.y * scaleY,
          size * scaleX,
          size * scaleY,
          0,
          0,
          size,
          size
        )
      }
    }
  }, [previewUrl])

  const handleCropConfirm = async () => {
    if (!selectedFile || !previewUrl || !croppedAreaPixels) return

    setIsProcessing(true)
    try {
      // Generate cropped image blob using the same pixel crop that was shown in preview
      const blob = await getCroppedImg(
        previewUrl,
        croppedAreaPixels
      )

      // Create a new File object from the blob
      const croppedFile = new File([blob], selectedFile.name, { type: selectedFile.type })

      // Upload the cropped image
      const userId = localStorage.getItem('supabase-auth-user-id') || 'anon'
      const photoUrl = await uploadProfilePhoto(croppedFile, userId)

      // Notify parent component
      onPhotoUploadSuccess(photoUrl)

      // Close modal and reset
      setShowCropModal(false)
      setSelectedFile(null)
      setPreviewUrl(null)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCroppedAreaPixels(null)
      toast('Photo updated successfully!', 'success')
    } catch (error) {
      console.error('[PhotoCropUpload] crop/upload error:', error)
      toast((error as Error).message || 'Could not update photo.', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCancel = () => {
    setShowCropModal(false)
    setSelectedFile(null)
    setPreviewUrl(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <>
      {/* Photo Display Section */}
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="w-20 h-20 rounded-2xl bg-navy text-white overflow-hidden shrink-0 border border-grey-soft flex items-center justify-center font-display text-2xl">
          {currentPhotoUrl ? (
            <img src={currentPhotoUrl} className="w-full h-full object-cover" alt="Profile" />
          ) : (
            <span>{photoInitials || '?'}</span>
          )}
        </div>

        {/* Upload Button */}
        <div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={disabled || uploading || isProcessing}
            className="flex items-center gap-2 px-4 py-2 border border-grey-soft rounded-xl text-sm text-navy font-medium hover:border-gold/40 hover:bg-ivory-light transition-colors disabled:opacity-50 cursor-pointer"
          >
            {uploading || isProcessing ? (
              <>
                <div className="h-4 w-4 rounded-full border-2 border-gold border-t-transparent animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Change Photo
              </>
            )}
          </button>
          <p className="text-xs text-grey mt-1.5">JPG, PNG or WebP · Max 4MB</p>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileSelect}
          disabled={disabled || uploading || isProcessing}
        />
      </div>

      {/* Crop Modal */}
      <AnimatePresence>
        {showCropModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={handleCancel}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-grey-soft flex items-center justify-between">
                <h2 className="text-lg font-semibold text-navy">Crop Photo</h2>
                <button
                  onClick={handleCancel}
                  disabled={isProcessing}
                  className="text-grey hover:text-navy transition-colors disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto flex flex-col p-6">
                <div className="flex-1 flex flex-col gap-6">
                  {/* Crop Editor - Fixed Square Viewport */}
                  {previewUrl && (
                    <div className="flex flex-col gap-3">
                      <p className="text-sm font-medium text-navy">Position Your Photo</p>
                      <div className="relative w-full bg-ivory-dark rounded-xl overflow-hidden" style={{ aspectRatio: '1' }}>
                        <Cropper
                          image={previewUrl}
                          crop={crop}
                          zoom={zoom}
                          aspect={1}
                          cropShape="rect"
                          showGrid={false}
                          onCropChange={setCrop}
                          onCropComplete={handleCropComplete}
                          onZoomChange={setZoom}
                          classes={{
                            containerClassName: 'absolute inset-0',
                            mediaClassName: 'w-full h-full',
                            cropAreaClassName: 'border-2 border-gold shadow-lg',
                          }}
                          restrictPosition={false}
                        />
                      </div>

                      {/* Zoom Controls */}
                      <div className="flex items-center gap-3 px-2">
                        <button
                          onClick={() => setZoom(Math.max(1, zoom - 0.1))}
                          disabled={zoom <= 1}
                          className="p-2 text-grey hover:text-navy hover:bg-ivory-light rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Zoom Out"
                        >
                          <ZoomOut className="h-4 w-4" />
                        </button>
                        
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="range"
                            min="1"
                            max="3"
                            step="0.1"
                            value={zoom}
                            onChange={(e) => setZoom(Number(e.target.value))}
                            className="flex-1 h-1 bg-grey-soft rounded-lg appearance-none cursor-pointer"
                            style={{
                              background: `linear-gradient(to right, #ddd 0%, #ddd ${((zoom - 1) / 2) * 100}%, #e8dcc8 ${((zoom - 1) / 2) * 100}%, #e8dcc8 100%)`
                            }}
                          />
                          <span className="text-xs text-grey w-8 text-right">{zoom.toFixed(1)}x</span>
                        </div>
                        
                        <button
                          onClick={() => setZoom(Math.min(3, zoom + 0.1))}
                          disabled={zoom >= 3}
                          className="p-2 text-grey hover:text-navy hover:bg-ivory-light rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Zoom In"
                        >
                          <ZoomIn className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Preview */}
                  {previewUrl && (
                    <div className="flex flex-col gap-3">
                      <p className="text-sm font-medium text-navy">Preview</p>
                      <div className="flex justify-center">
                        <div className="w-40 h-40 rounded-2xl bg-ivory-dark border-2 border-grey-soft overflow-hidden flex items-center justify-center">
                          <canvas
                            ref={previewCanvasRef}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-grey text-center">This is exactly what will be saved</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-6 mt-auto border-t border-grey-soft">
                  <button
                    onClick={handleCancel}
                    disabled={isProcessing}
                    className="flex-1 px-4 py-2.5 border border-grey-soft rounded-xl text-sm font-semibold text-navy hover:bg-ivory-light transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCropConfirm}
                    disabled={isProcessing}
                    className="flex-1 px-4 py-2.5 bg-navy text-white rounded-xl text-sm font-semibold hover:bg-navy-mid transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        Processing…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Confirm & Save
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

