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
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { slugify } from '@/lib/utils';

const updateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, and hyphens only'),
  description: z.string().max(500).optional(),
  isPublic: z.boolean(),
});

type UpdateValues = z.infer<typeof updateSchema>;

interface EditCollectionFormProps {
  collection: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    isPublic: boolean;
  };
}

export function EditCollectionForm({ collection }: EditCollectionFormProps) {
  const { t } = useTranslation('collections');
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(true); // Start as true since we have existing slug

  const form = useForm<UpdateValues>({
    resolver: zodResolver(updateSchema as any),
    defaultValues: {
      name: collection.name,
      slug: collection.slug,
      description: collection.description || '',
      isPublic: collection.isPublic,
    },
  });

  const watchedName = form.watch('name');

  // Auto-generate slug from name only if slug was reset to original
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

  async function onSubmit(data: UpdateValues) {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/collections/${collection.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('failedToUpdate'));
      }

      toast.success(t('updatedSuccess'));
      router.push(`/collections/${collection.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('failedToUpdate'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardHeader>
          <CardTitle>{t('collectionDetails')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
              {t('slugDescriptionEdit')}
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

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>{t('public')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('publicDescription')}
              </p>
            </div>
            <Switch
              checked={form.watch('isPublic')}
              onCheckedChange={(checked) => form.setValue('isPublic', checked)}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            {t('cancel')}
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('saveChanges')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
