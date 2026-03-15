'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/context/AuthContext';
import { leadImportAPI } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import {
  Upload, Download, FileSpreadsheet, CheckCircle,
  AlertCircle, ArrowLeft, File, X, Info
} from 'lucide-react';
import Link from 'next/link';

interface ImportResult {
  batchId: string;
  batchName: string;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  inserted: number;
  invalidRows: Array<{ row: number; error: string }>;
}

export default function LeadImportPage() {
  const { user } = useAuth();
  const { t, isRTL } = useTranslation();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [batchName, setBatchName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  if (user?.role !== 'Admin') {
    router.replace('/dashboard');
    return null;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
      setError('');
      if (!batchName) setBatchName(`Import ${new Date().toLocaleDateString()}`);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('batchName', batchName || `Import ${new Date().toLocaleDateString()}`);
      const res = await leadImportAPI.importLeads(formData);
      setResult(res.data.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to import leads';
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const res = await leadImportAPI.downloadTemplate();
      const url = window.URL.createObjectURL(new Blob([res.data as BlobPart]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'leads_import_template.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download template');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/admin/leads" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className={`w-5 h-5 text-gray-500 ${isRTL ? 'rotate-180' : ''}`} />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              {isRTL ? 'استيراد العملاء المحتملين' : 'Import Leads'}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {isRTL ? 'استيراد العملاء المحتملين من ملفات Excel أو CSV' : 'Bulk import leads from Excel or CSV files'}
            </p>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">{isRTL ? 'الأعمدة المطلوبة:' : 'Required Columns:'}</p>
            <p className="text-xs text-blue-600">
              <strong>Company Name</strong> (required), Contact Person, Email, Phone, Country, Source, Notes
            </p>
            <p className="text-xs text-blue-500 mt-1">
              {isRTL ? 'الصيغ المدعومة: .xlsx، .xls، .csv' : 'Supported formats: .xlsx, .xls, .csv — Max 10MB'}
            </p>
          </div>
        </div>

        {/* Download Template */}
        <button
          onClick={handleDownloadTemplate}
          disabled={downloadingTemplate}
          className="flex items-center gap-2 px-4 py-2 border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium"
        >
          <Download className="w-4 h-4" />
          {downloadingTemplate ? (isRTL ? 'جارٍ التنزيل…' : 'Downloading…') : (isRTL ? 'تنزيل قالب Excel' : 'Download Excel Template')}
        </button>

        {/* Batch Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {isRTL ? 'اسم الدُفعة' : 'Batch Name'}
          </label>
          <input
            type="text"
            value={batchName}
            onChange={e => setBatchName(e.target.value)}
            placeholder={isRTL ? 'مثال: استيراد يناير 2026' : 'e.g. January 2026 Import'}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Drop Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
            file ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          }`}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <FileSpreadsheet className="w-10 h-10 text-blue-500" />
              <p className="font-medium text-gray-800">{file.name}</p>
              <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
              <button
                onClick={e => { e.stopPropagation(); setFile(null); setResult(null); }}
                className="mt-2 flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
              >
                <X className="w-3.5 h-3.5" />
                {isRTL ? 'إزالة الملف' : 'Remove file'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-10 h-10 text-gray-400" />
              <p className="font-medium text-gray-600">
                {isRTL ? 'اسحب وأفلت الملف هنا' : 'Drag & drop your file here'}
              </p>
              <p className="text-sm text-gray-400">
                {isRTL ? 'أو انقر للاختيار' : 'or click to browse'}
              </p>
              <p className="text-xs text-gray-400">.xlsx, .xls, .csv</p>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Upload Button */}
        {file && !result && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {isRTL ? 'جارٍ الاستيراد…' : 'Importing…'}
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                {isRTL ? 'استيراد العملاء المحتملين' : 'Import Leads'}
              </>
            )}
          </button>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-green-800">
                  {isRTL ? 'تم الاستيراد بنجاح' : 'Import Successful'}
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: isRTL ? 'الإجمالي' : 'Total Rows', value: result.totalRecords, color: 'text-gray-700' },
                  { label: isRTL ? 'صحيحة' : 'Valid', value: result.validRecords, color: 'text-blue-600' },
                  { label: isRTL ? 'تم الإدراج' : 'Inserted', value: result.inserted, color: 'text-green-600' },
                  { label: isRTL ? 'خاطئة' : 'Invalid', value: result.invalidRecords, color: 'text-red-600' },
                ].map(stat => (
                  <div key={stat.label} className="bg-white rounded-lg p-3 text-center border border-gray-100">
                    <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                    <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {result.invalidRows.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                <h3 className="font-medium text-orange-800 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {isRTL ? 'الصفوف الخاطئة' : 'Invalid Rows'} ({result.invalidRows.length})
                </h3>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {result.invalidRows.map((row, i) => (
                    <div key={i} className="text-xs text-orange-700 bg-orange-100 rounded px-2 py-1">
                      {isRTL ? `الصف ${row.row}:` : `Row ${row.row}:`} {row.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Link
                href="/admin/leads"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
              >
                {isRTL ? 'عرض جميع العملاء المحتملين' : 'View All Leads'}
              </Link>
              <Link
                href="/admin/leads/distribution"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-blue-300 text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors text-sm"
              >
                {isRTL ? 'توزيع العملاء' : 'Distribute Leads'}
              </Link>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
