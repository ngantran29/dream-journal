import React, { useRef } from 'react';

interface ImageUploadAreaProps {
  onImagesSelected: (files: File[]) => void;
}

const ImageUploadArea: React.FC<ImageUploadAreaProps> = ({
  onImagesSelected,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    onImagesSelected(Array.from(files));
  };

  return (
    <div>
          <div
      className="flex flex-col items-center justify-center rounded-md border border-dashed border-border p-6 justify-center cursor-pointer hover:bg-muted/50"
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />

      <button>Upload images</button>
    </div>

    <small className="text-xs text-muted-foreground mt-1 items-center">
    PNG, JPG, WEBP — optional
    </small>
    </div>
  );
};

export default ImageUploadArea;
