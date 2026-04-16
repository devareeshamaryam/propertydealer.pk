'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { importApi } from '@/lib/api';
import { toast } from 'sonner';
import { FaCloudUploadAlt, FaFileArchive, FaFileCode } from 'react-icons/fa';

export default function ImportPage() {
  const { register, handleSubmit, reset } = useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const onSubmit = async (data: any) => {
    if (!data.xml || data.xml.length === 0) {
      toast.error('Please select an XML file');
      return;
    }

    setIsLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append('xml', data.xml[0]);
    if (data.imagesXml && data.imagesXml.length > 0) {
      formData.append('imagesXml', data.imagesXml[0]);
    }
    if (data.zip && data.zip.length > 0) {
      formData.append('zip', data.zip[0]);
    }

    try {
      const response = await importApi.importWordPress(formData);
      setResult(response);
      toast.success('Import completed successfully!');
      reset();
    } catch (error: any) {
      console.error('Import Error:', error);
      toast.error('Failed to import properties. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100">Import Properties</h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 max-w-2xl">
        <p className="mb-4 text-gray-600 dark:text-gray-300">
          Upload a WordPress WXR (XML) export file to import properties.
          Optionally, upload a ZIP file containing the images folder (e.g., `wp-content/uploads`) to automatically sync images.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

          {/* XML File Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              WordPress Export File (XML) <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-bray-800 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-600">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <FaFileCode className="w-8 h-8 mb-3 text-gray-400" />
                  <p className="mb-2 text-sm text-gray-500 dark:text-gray-400"><span className="font-semibold">Click to upload XML</span></p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">.xml files only</p>
                </div>
                <input {...register('xml')} type="file" accept=".xml" className="opacity-0 w-full h-full absolute cursor-pointer" />
              </label>
            </div>
          </div>

          {/* Images XML File Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Images XML File <span className="text-xs text-gray-500">(Optional - for image URLs)</span>
            </label>
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-bray-800 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-600">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <FaFileCode className="w-8 h-8 mb-3 text-gray-400" />
                  <p className="mb-2 text-sm text-gray-500 dark:text-gray-400"><span className="font-semibold">Click to upload Images XML</span></p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">.xml files only</p>
                </div>
                <input {...register('imagesXml')} type="file" accept=".xml" className="opacity-0 w-full h-full absolute cursor-pointer" />
              </label>
            </div>
          </div>

          {/* ZIP File Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Images Archive (ZIP) <span className="text-xs text-gray-500">(Optional)</span>
            </label>
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-bray-800 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-600">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <FaFileArchive className="w-8 h-8 mb-3 text-gray-400" />
                  <p className="mb-2 text-sm text-gray-500 dark:text-gray-400"><span className="font-semibold">Click to upload ZIP</span></p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">.zip files only</p>
                </div>
                <input {...register('zip')} type="file" accept=".zip" className="opacity-0 w-full h-full absolute cursor-pointer" />
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Importing...
              </>
            ) : (
              <>
                <FaCloudUploadAlt className="mr-2 h-5 w-5" />
                Start Import
              </>
            )}
          </button>
        </form>

        {result && (
          <div className="mt-8 p-4 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
            <h3 className="text-lg font-medium text-green-800 dark:text-green-300 mb-2">Import Results</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm text-green-700 dark:text-green-400">
              <li>Found: <strong>{result.totalFound}</strong> listings</li>
              <li>Imported: <strong>{result.imported}</strong> listings</li>
              <li>Skipped: <strong>{result.skipped}</strong> listings</li>
              {result.imageMapSize !== undefined && (
                <li>Images Mapped: <strong>{result.imageMapSize}</strong></li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
