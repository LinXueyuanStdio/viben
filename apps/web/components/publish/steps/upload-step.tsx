'use client';

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PackageType } from '../publish-wizard';

interface UploadStepProps {
  packageType: PackageType;
  file: File | null;
  onFileChange: (file: File | null) => void;
}

const ACCEPTED_TYPES = {
  'application/zip': ['.zip'],
  'application/gzip': ['.gz', '.tgz'],
  'application/x-tar': ['.tar'],
};

const MAX_SIZE = 50 * 1024 * 1024; // 50MB

export function UploadStep({ packageType, file, onFileChange }: UploadStepProps) {
  const { t } = useTranslation();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileChange(acceptedFiles[0]);
      }
    },
    [onFileChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_SIZE,
    multiple: false,
  });

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (packageType === 'skill') {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 rounded-lg border border-dashed p-12 text-center">
        <div className="rounded-full bg-green-500/10 p-4">
          <File className="h-8 w-8 text-green-500" />
        </div>
        <div>
          <h3 className="text-lg font-medium">{t('publish.upload.noUploadNeeded')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('publish.upload.skillContentProvided')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50'
        }`}
      >
        <input {...getInputProps()} />
        <div className="rounded-full bg-primary/10 p-4">
          <Upload className="h-8 w-8 text-primary" />
        </div>
        <div className="mt-4">
          <p className="text-lg font-medium">
            {isDragActive ? t('publish.upload.dropHere') : t('publish.upload.dragAndDrop')}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('publish.upload.orClickBrowse')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('publish.upload.maxSize')}
          </p>
        </div>
      </div>

      {file && (
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2">
              <File className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatSize(file.size)}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onFileChange(null);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
