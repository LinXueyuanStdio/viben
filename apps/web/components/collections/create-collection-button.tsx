'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
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
        throw new Error(error.error || 'Failed to create collection');
      }

      const { collection } = await response.json();
      toast.success('Collection created');
      setOpen(false);
      form.reset();
      setSlugManuallyEdited(false);
      router.push(`/collections/${collection.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create collection');
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
          New Collection
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Create Collection</DialogTitle>
            <DialogDescription>
              Create a curated list of MCP servers and skills to share.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="My Awesome Collection"
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                placeholder="my-awesome-collection"
                value={form.watch('slug')}
                onChange={handleSlugChange}
              />
              <p className="text-xs text-muted-foreground">
                URL-friendly identifier. Auto-generated from name.
              </p>
              {form.formState.errors.slug && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.slug.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="What is this collection about?"
                {...form.register('description')}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Public</Label>
                <p className="text-xs text-muted-foreground">
                  Anyone can view this collection
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
              Create Collection
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
