import React, { useRef } from 'react';
import { Camera, Upload } from 'lucide-react';
import Spinner from './Spinner';

interface ImageUploaderProps {
  onUpload: (file: File) => void;
  currentImage?: string;
  label?: string;
  loading?: boolean;
}

export default function ImageUploader({
  onUpload,
  currentImage,
  label,
  loading = false,
}: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
    // Reset input so the same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    if (!loading) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>}
      
      <div 
        onClick={handleClick}
        className={`
          relative flex flex-col items-center justify-center w-full h-48 
          border-2 border-dashed rounded-xl overflow-hidden
          transition-colors cursor-pointer group
          ${currentImage ? 'border-gray-200' : 'border-gray-300 hover:border-primary hover:bg-primary-50'}
          ${loading ? 'opacity-70 cursor-not-allowed' : ''}
        `}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/jpeg, image/png, image/webp"
          className="hidden"
        />

        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10">
            <Spinner size="md" />
            <span className="mt-2 text-sm font-medium text-gray-600">Uploading...</span>
          </div>
        ) : currentImage ? (
          <>
            <img 
              src={currentImage} 
              alt="Uploaded" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex flex-col items-center text-white">
                <Camera size={24} className="mb-1" />
                <span className="text-sm font-medium">Change Photo</span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center text-primary mb-3 group-hover:scale-110 transition-transform">
              <Upload size={24} />
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">Click to upload image</p>
            <p className="text-xs text-gray-500">Max 5MB, JPG/PNG/WEBP</p>
          </div>
        )}
      </div>
    </div>
  );
}
