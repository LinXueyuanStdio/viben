'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
  description: z.string().max(500).optional(),
  isPublic: z.boolean(),
});

type CreateValues = z.infer<typeof createSchema>;

export function CreateCollectionButton() {
  const { t } = useTranslation('collections');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema as any),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      isPublic: true,
    },
  });

  const watchedName = form.watch('name');

  // Auto-generate slug from name if not manually edited
  useEffect(() => {
    if (!slugManuallyEdited && watchedName) {
      const generatedSlug = slugify(watchedName);
      form.setValue('slug', generatedSlug, { shouldValidate: false });
    }
  }, [watchedName, slugManuallyEdited, form]);

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSlugManuallyEdited(true);
    form.setValue('slug', e.target.value, { shouldValidate: true });
  }

  async function onSubmit(data: CreateValues) {
    setIsLoading(true);

    try {
      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('failedToCreate'));
      }

      const { collection } = await response.json();
      toast.success(t('createdSuccess'));
      setOpen(false);
      form.reset();
      setSlugManuallyEdited(false);
      router.push(`/collections/${collection.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('failedToCreate'));
    } finally {
      setIsLoading(false);
    }
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) {
      form.reset();
      setSlugManuallyEdited(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t('newCollection')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{t('createCollection')}</DialogTitle>
            <DialogDescription>
              {t('createCollectionDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('name')}</Label>
              <Input
                id="name"
                placeholder={t('namePlaceholder')}
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">{t('slug')}</Label>
              <Input
                id="slug"
                placeholder={t('slugPlaceholder')}
                value={form.watch('slug')}
                onChange={handleSlugChange}
              />
              <p className="text-xs text-muted-foreground">
                {t('slugDescription')}
              </p>
              {form.formState.errors.slug && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.slug.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('descriptionOptional')}</Label>
              <Textarea
                id="description"
                placeholder={t('descriptionPlaceholder')}
                {...form.register('description')}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('public')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('publicDescription')}
                </p>
              </div>
              <Switch
                checked={form.watch('isPublic')}
                onCheckedChange={(checked) => form.setValue('isPublic', checked)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('createCollection')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
