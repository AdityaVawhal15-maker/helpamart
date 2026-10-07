import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, X, CheckCircle2 } from 'lucide-react'
import ReactCrop from 'react-image-crop'
import type { Crop } from 'react-image-crop'
import { uploadProfilePhoto } from '@/lib/supabase'
import { useToast } from './Toast'
// CSS for react-image-crop
import 'react-image-crop/dist/ReactCrop.css'

interface PhotoCropUploadProps {
  currentPhotoUrl: string | null
  photoInitials: string
  onPhotoUploadSuccess: (photoUrl: string) => void
  uploading?: boolean
  disabled?: boolean
}

export function PhotoCropUpload({
  currentPhotoUrl,
  photoInitials,
  onPhotoUploadSuccess,
  uploading = false,
  disabled = false,
}: PhotoCropUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const { toast } = useToast()

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showCropModal, setShowCropModal] = useState(false)
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: 90,
    height: 90,
    x: 5,
    y: 5,
  })
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
    }
    reader.readAsDataURL(file)
  }

  const handleCropConfirm = async () => {
    if (!imgRef.current || !selectedFile || !previewUrl) return

    setIsProcessing(true)
    try {
      // Get the crop dimensions
      const img = imgRef.current
      const scaleX = img.naturalWidth / img.width
      const scaleY = img.naturalHeight / img.height

      const x = (crop.x / 100) * img.width * scaleX
      const y = (crop.y / 100) * img.height * scaleY
      const width = (crop.width / 100) * img.width * scaleX
      const height = (crop.height / 100) * img.height * scaleY

      // Create canvas and draw cropped image
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not get canvas context')

      ctx.drawImage(
        img,
        x,
        y,
        width,
        height,
        0,
        0,
        width,
        height
      )

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Could not create image blob'))
          },
          selectedFile.type || 'image/jpeg',
          0.95
        )
      })

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
              className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-grey-soft flex items-center justify-between sticky top-0 bg-white">
                <h2 className="text-lg font-semibold text-navy">Crop Photo</h2>
                <button
                  onClick={handleCancel}
                  disabled={isProcessing}
                  className="text-grey hover:text-navy transition-colors disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Crop Area */}
                {previewUrl && (
                  <div className="flex justify-center">
                    <div className="w-full max-w-md">
                      <ReactCrop
                        crop={crop}
                        onChange={(c) => setCrop(c)}
                        aspect={1}
                        circularCrop={false}
                        className="max-w-full"
                      >
                        <img
                          ref={imgRef}
                          src={previewUrl}
                          alt="Crop preview"
                          className="max-w-full h-auto"
                          onLoad={(e) => {
                            // Center crop on load
                            const { naturalWidth, naturalHeight } = e.currentTarget
                            const minDim = Math.min(naturalWidth, naturalHeight)
                            setCrop({
                              unit: 'px',
                              width: minDim * 0.9,
                              height: minDim * 0.9,
                              x: (naturalWidth - minDim * 0.9) / 2,
                              y: (naturalHeight - minDim * 0.9) / 2,
                            })
                          }}
                        />
                      </ReactCrop>
                    </div>
                  </div>
                )}

                {/* Preview */}
                {previewUrl && (
                  <div className="text-center">
                    <p className="text-sm text-grey mb-3">Preview</p>
                    <div className="w-32 h-32 mx-auto rounded-2xl bg-ivory-dark border border-grey-soft overflow-hidden">
                      {imgRef.current && crop && (
                        <canvas
                          ref={(canvas) => {
                            if (!canvas || !imgRef.current) return
                            const img = imgRef.current
                            const scaleX = img.naturalWidth / img.width
                            const scaleY = img.naturalHeight / img.height

                            const x = (crop.x / 100) * img.width * scaleX
                            const y = (crop.y / 100) * img.height * scaleY
                            const width = (crop.width / 100) * img.width * scaleX
                            const height = (crop.height / 100) * img.height * scaleY

                            canvas.width = width
                            canvas.height = height
                            const ctx = canvas.getContext('2d')
                            if (ctx) {
                              ctx.drawImage(img, x, y, width, height, 0, 0, width, height)
                            }
                          }}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-4 border-t border-grey-soft">
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
