'use client'
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import pageApi from '../../../lib/api/page/page.api';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function PagesPage() {
  const router = useRouter();
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPage, setSelectedPage] = useState<any>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter ] = useState('all');

  useEffect(() => {
    fetchPages();
  }, [statusFilter]);

  const fetchPages = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await pageApi.getAllPages();
      let filteredData = Array.isArray(data) ? data : [];
      
      // Apply status filter
      if (statusFilter !== 'all') {
        filteredData = filteredData.filter((page: any) => page.status === statusFilter);
      }
      
      setPages(filteredData);
    } catch (err: any) {
      console.error('Error fetching pages:', err);
      setError('Failed to load pages. Please try again later.');
      toast.error('Error', {
        description: err?.response?.data?.message || 'Failed to load pages.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleView = async (pageId: string) => {
    try {
      const page = await pageApi.getPageById(pageId);
      setSelectedPage(page);
      setViewDialogOpen(true);
    } catch (error: any) {
      toast.error('Error', {
        description: error?.response?.data?.message || 'Failed to load blog details.',
      });
    }
  };

  const handleEdit = (pageId: string) => {
    router.push(`/dashboard/pages/edit/${pageId}`);
  };

  const handleDelete = async (pageId: string) => {
    if (!confirm('Are you sure you want to delete this page? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingId(pageId);
      await pageApi.deletePage(pageId);
      toast.success('Page deleted successfully!');
      fetchPages();
    } catch (error: any) {
      console.error('Error deleting page:', error);
      toast.error('Error', {
        description: error?.response?.data?.message || 'Failed to delete page. Please try again.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'PUBLISHED' || status === 'published') {
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Published</Badge>;
    }
    return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Draft</Badge>;
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
              Pages Dashboard
            </h2>
            <p className="text-gray-600">
              Manage all pages and content
            </p>
          </div>
          <div className="flex gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pages</SelectItem>
                <SelectItem value="PUBLISHED">Published</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => router.push('/dashboard/pages/add-page')}>
              Add New Page
            </Button>
          </div>
        </div>
      </div>

      {/* Blogs Table */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-3 text-gray-600">Loading blogs...</span>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={fetchPages}>
              Retry
            </Button>
          </div>
        ) : pages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">No blogs found.</p>
            <Button onClick={() => router.push('/dashboard/pages/add-page')}>
              Add Your First Page
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Keywords</TableHead>
                <TableHead>Views</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((page: any) => (
                <TableRow key={page._id}>
                  <TableCell className="font-medium">
                    <div className="max-w-[300px]">
                      <p className="truncate">{page.title}</p>
                      {page.excerpt && (
                        <p className="text-sm text-gray-500 truncate mt-1">{page.excerpt}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(page.status)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {page.keywords && page.keywords.length > 0 ? (
                        page.keywords.slice(0, 3).map((keyword: string, idx: number) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {keyword}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-gray-400">None</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-600">{page.views || 0}</span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {formatDate(page.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleView(page._id)}
                        title="View page details"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(page._id)}
                        title="Edit page"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(page._id)}
                        disabled={deletingId === page._id}
                        title="Delete page"
                      >
                        {deletingId === page._id ? (
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

      {/* View Blog Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Page Details</DialogTitle>
            <DialogDescription>
              View detailed information about the page
            </DialogDescription>
          </DialogHeader>
          {selectedPage && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Title</label>
                <p className="text-lg font-semibold mt-1">{selectedPage.title}</p>
              </div>
              {selectedPage.excerpt && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Excerpt</label>
                  <p className="text-sm text-gray-700 mt-1">{selectedPage.excerpt}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-500">Content</label>
                {/* render rich text editor text as html */}
                <div className="text-sm text-gray-700 mt-1 max-h-40 overflow-y-auto" dangerouslySetInnerHTML={{ __html: selectedPage.content }} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <div className="mt-1">{getStatusBadge(selectedPage.status)}</div>
              </div>
              {selectedPage.keywords && selectedPage.keywords.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Keywords</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedPage.keywords.map((keyword: string, idx: number) => (
                      <Badge key={idx} variant="outline">{keyword}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {selectedPage.metaTitle && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Meta Title</label>
                  <p className="text-sm text-gray-700 mt-1">{selectedPage.metaTitle}</p>
                </div>
              )}
              {selectedPage.metaDescription && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Meta Description</label>
                  <p className="text-sm text-gray-700 mt-1">{selectedPage.metaDescription}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Views</label>
                  <p className="text-sm font-semibold mt-1">{selectedPage.views || 0}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Created At</label>
                  <p className="text-sm text-gray-600 mt-1">{formatDate(selectedPage.createdAt)}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
