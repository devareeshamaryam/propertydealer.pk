'use client'
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import blogApi from '@/lib/api/blog/blog.api';
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

export default function BlogPage() {
  const router = useRouter();
  const [blogs, setBlogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBlog, setSelectedBlog] = useState<any>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchBlogs();
  }, [statusFilter]);

  const fetchBlogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const status = statusFilter === 'all' ? undefined : statusFilter;
      const data = await blogApi.getAllBlogs(status);
      setBlogs(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error fetching blogs:', err);
      setError('Failed to load blogs. Please try again later.');
      toast.error('Error', {
        description: err?.response?.data?.message || 'Failed to load blogs.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleView = async (blogId: string) => {
    try {
      const blog = await blogApi.getBlogById(blogId);
      setSelectedBlog(blog);
      setViewDialogOpen(true);
    } catch (error: any) {
      toast.error('Error', {
        description: error?.response?.data?.message || 'Failed to load blog details.',
      });
    }
  };

  const handleEdit = (blogId: string) => {
    router.push(`/dashboard/blog/edit/${blogId}`);
  };

  const handleDelete = async (blogId: string) => {
    if (!confirm('Are you sure you want to delete this blog? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingId(blogId);
      await blogApi.deleteBlog(blogId);
      toast.success('Blog deleted successfully!');
      fetchBlogs();
    } catch (error: any) {
      console.error('Error deleting blog:', error);
      toast.error('Error', {
        description: error?.response?.data?.message || 'Failed to delete blog. Please try again.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'published') {
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
              Blog Posts Dashboard
            </h2>
            <p className="text-gray-600">
              Manage all blog posts and content
            </p>
          </div>
          <div className="flex gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Posts</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => router.push('/dashboard/blog/add-blog')}>
              Add New Blog
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
            <Button onClick={fetchBlogs}>
              Retry
            </Button>
          </div>
        ) : blogs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">No blogs found.</p>
            <Button onClick={() => router.push('/dashboard/blog/add-blog')}>
              Add Your First Blog
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Categories</TableHead>
                <TableHead>Views</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blogs.map((blog: any) => (
                <TableRow key={blog._id}>
                  <TableCell className="font-medium">
                    <div className="max-w-[300px]">
                      <p className="truncate">{blog.title}</p>
                      {blog.excerpt && (
                        <p className="text-sm text-gray-500 truncate mt-1">{blog.excerpt}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(blog.status)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {blog.categories && blog.categories.length > 0 ? (
                        blog.categories.map((cat: any, idx: number) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {typeof cat === 'object' ? cat.name : 'Category'}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-gray-400">None</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-600">{blog.views || 0}</span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {formatDate(blog.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleView(blog._id)}
                        title="View blog details"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(blog._id)}
                        title="Edit blog"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(blog._id)}
                        disabled={deletingId === blog._id}
                        title="Delete blog"
                      >
                        {deletingId === blog._id ? (
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
            <DialogTitle>Blog Details</DialogTitle>
            <DialogDescription>
              View detailed information about the blog post
            </DialogDescription>
          </DialogHeader>
          {selectedBlog && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Title</label>
                <p className="text-lg font-semibold mt-1">{selectedBlog.title}</p>
              </div>
              {selectedBlog.excerpt && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Excerpt</label>
                  <p className="text-sm text-gray-700 mt-1">{selectedBlog.excerpt}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-500">Content</label>
                <div className="text-sm text-gray-700 mt-1 max-h-40 overflow-y-auto">
                  {selectedBlog.content}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <div className="mt-1">{getStatusBadge(selectedBlog.status)}</div>
              </div>
              {selectedBlog.categories && selectedBlog.categories.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Categories</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedBlog.categories.map((cat: any, idx: number) => (
                      <Badge key={idx} variant="secondary">
                        {typeof cat === 'object' ? cat.name : 'Category'}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {selectedBlog.tags && selectedBlog.tags.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Tags</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedBlog.tags.map((tag: string, idx: number) => (
                      <Badge key={idx} variant="outline">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Views</label>
                  <p className="text-sm font-semibold mt-1">{selectedBlog.views || 0}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Created At</label>
                  <p className="text-sm text-gray-600 mt-1">{formatDate(selectedBlog.createdAt)}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
