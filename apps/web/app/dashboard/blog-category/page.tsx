'use client'
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import blogCategoryApi from '@/lib/api/blog-category/blog-category.api';
import { toast } from 'sonner';

import { Loader2, Eye, Edit, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function BlogCategoryPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await blogCategoryApi.getAllCategories();
        setCategories(Array.isArray(data) ? data : []);
      } catch (err: any) {
        console.error('Error fetching categories:', err);
        setError('Failed to load categories. Please try again later.');
        toast.error('Error', {
          description: err?.response?.data?.message || 'Failed to load categories.',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  const handleView = async (categoryId: string) => {
    try {
      const category = await blogCategoryApi.getCategoryById(categoryId);
      setSelectedCategory(category);
      setViewDialogOpen(true);
    } catch (error: any) {
      toast.error('Error', {
        description: error?.response?.data?.message || 'Failed to load category details.',
      });
    }
  };

  const handleEdit = (categoryId: string) => {
    router.push(`/dashboard/blog-category/edit/${categoryId}`);
  };

  const handleDelete = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingId(categoryId);
      await blogCategoryApi.deleteCategory(categoryId);
      toast.success('Category deleted successfully!');
      // Refresh the list
      const data = await blogCategoryApi.getAllCategories();
      setCategories(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Error deleting category:', error);
      toast.error('Error', {
        description: error?.response?.data?.message || 'Failed to delete category. Please try again.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="w-full">
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">
              Blog Categories Dashboard
            </h2>
            <p className="text-gray-600">
              Manage all blog categories for your content
            </p>
          </div>
          <Button onClick={() => router.push('/dashboard/blog-category/add-category')}>
            Add New Category
          </Button>
        </div>
      </div>

      {/* Categories Table */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-3 text-gray-600">Loading categories...</span>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">No categories found.</p>
            <Button onClick={() => router.push('/dashboard/blog-category/add-category')}>
              Add Your First Category
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Parent Category</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category: any) => (
                <TableRow key={category._id}>
                  <TableCell className="font-medium">
                    <div className="max-w-[200px]">
                      <p className="truncate">{category.name}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {category.slug || 'N/A'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[300px]">
                      <p className="truncate text-sm text-gray-600">
                        {category.description || 'No description'}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {category.parent ? (
                      <Badge variant="secondary">
                        {typeof category.parent === 'object' ? category.parent.name : 'Parent'}
                      </Badge>
                    ) : (
                      <span className="text-sm text-gray-400">None</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {formatDate(category.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleView(category._id)}
                        title="View category details"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(category._id)}
                        title="Edit category"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(category._id)}
                        disabled={deletingId === category._id}
                        title="Delete category"
                      >
                        {deletingId === category._id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-destructive" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-destructive" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* View Category Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Category Details</DialogTitle>
            <DialogDescription>
              View detailed information about the category
            </DialogDescription>
          </DialogHeader>
          {selectedCategory && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Category Name</label>
                <p className="text-lg font-semibold mt-1">{selectedCategory.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Slug</label>
                <p className="text-sm font-mono text-gray-700 mt-1">{selectedCategory.slug || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Description</label>
                <p className="text-sm text-gray-700 mt-1">{selectedCategory.description || 'No description'}</p>
              </div>
              {selectedCategory.parent && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Parent Category</label>
                  <p className="text-sm font-semibold mt-1">
                    {typeof selectedCategory.parent === 'object' 
                      ? selectedCategory.parent.name 
                      : 'Parent Category'}
                  </p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-500">Created At</label>
                <p className="text-sm text-gray-600 mt-1">{formatDate(selectedCategory.createdAt)}</p>
              </div>
              {selectedCategory.updatedAt && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Last Updated</label>
                  <p className="text-sm text-gray-600 mt-1">{formatDate(selectedCategory.updatedAt)}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
