'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { slugify } from '@/lib/utils';

const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, and hyphens only'),
  description: z.string().max(500).optional().or(z.literal('')),
  isPublic: z.boolean(),
});

type CreateValues = z.infer<typeof createSchema>;

function getDefaultState() {
  return { name: '', slug: '', description: '', isPublic: true };
}

export function CreateCollectionButton() {
  const { t } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  function resetForm() {
    setName('');
    setSlug('');
    setDescription('');
    setIsPublic(true);
    setSlugManuallyEdited(false);
    setFieldErrors({});
  }

  // Auto-generate slug from name if not manually edited
  useEffect(() => {
    if (!slugManuallyEdited && name) {
      setSlug(slugify(name));
    }
  }, [name, slugManuallyEdited]);

  function clearFieldError(field: string) {
    if (fieldErrors[field]) {
      setFieldErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    }
  }

  function validate(): CreateValues | null {
    const result = createSchema.safeParse({ name, slug, description, isPublic });
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const path = issue.path[0] as string;
        if (!errors[path]) errors[path] = issue.message;
      }
      setFieldErrors(errors);
      return null;
    }
    setFieldErrors({});
    return result.data;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = validate();
    if (!data) return;

    setIsLoading(true);

    try {
      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('collections.failedToCreate'));
      }

      const { collection } = await response.json();
      toast.success(t('collections.createdSuccess'));
      setOpen(false);
      resetForm();
      router.push(`/collections/${collection.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('collections.failedToCreate'));
    } finally {
      setIsLoading(false);
    }
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) resetForm();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t('collections.newCollection')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('collections.createCollection')}</DialogTitle>
            <DialogDescription>{t('collections.createCollectionDesc')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('collections.name')}</Label>
              <Input
                id="name"
                placeholder={t('collections.namePlaceholder')}
                value={name}
                onChange={(e) => { setName(e.target.value); clearFieldError('name'); }}
              />
              {fieldErrors.name && <p className="text-sm text-destructive">{fieldErrors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">{t('collections.slug')}</Label>
              <Input
                id="slug"
                placeholder={t('collections.slugPlaceholder')}
                value={slug}
                onChange={(e) => { setSlugManuallyEdited(true); setSlug(e.target.value); clearFieldError('slug'); }}
              />
              <p className="text-xs text-muted-foreground">{t('collections.slugDescription')}</p>
              {fieldErrors.slug && <p className="text-sm text-destructive">{fieldErrors.slug}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('collections.descriptionOptional')}</Label>
              <Textarea
                id="description"
                placeholder={t('collections.descriptionPlaceholder')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('collections.public')}</Label>
                <p className="text-xs text-muted-foreground">{t('collections.publicDescription')}</p>
              </div>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('collections.createCollection')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
