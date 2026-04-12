'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  LogOut,
  Copy,
  Check,
  Link2,
  Upload,
  Settings,
  ExternalLink,
  ImageIcon,
  Type,
  AlertCircle,
} from 'lucide-react';
import CertificateCanvas from './CertificateCanvas';

const FONT_OPTIONS = [
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Palatino', value: 'Palatino' },
  { label: 'Garamond', value: 'Garamond' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Helvetica', value: 'Helvetica' },
  { label: 'Verdana', value: 'Verdana' },
  { label: 'Montserrat', value: 'Montserrat' },
  { label: 'Lato', value: 'Lato' },
  { label: 'Dancing Script', value: 'Dancing Script' },
  { label: 'Great Vibes', value: 'Great Vibes' },
  { label: 'Cinzel', value: 'Cinzel' },
  { label: 'Playfair Display', value: 'Playfair Display' },
  { label: 'Cormorant Garamond', value: 'Cormorant Garamond' },
  { label: 'Merriweather', value: 'Merriweather' },
];

interface Settings {
  templateUrl: string;
  course: string;
  nameX: number;
  nameY: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  shadow: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  templateUrl: '',
  course: '',
  nameX: 50,
  nameY: 65,
  fontSize: 72,
  color: '#1a1a1a',
  fontFamily: 'Georgia',
  bold: true,
  italic: false,
  shadow: false,
};

const PREVIEW_NAME = 'Sample Recipient Name';

export default function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [canvasError, setCanvasError] = useState('');
  const [activeTab, setActiveTab] = useState<'template' | 'text' | 'share'>('template');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load saved settings from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('certgenSettings');
      if (saved) setSettings(JSON.parse(saved));
    } catch {
      // ignore
    }
  }, []);

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem('certgenSettings', JSON.stringify(next));
      return next;
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError('');

    const token = sessionStorage.getItem('admin_token') || '';
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        updateSetting('templateUrl', data.url);
        setCanvasError('');
      } else {
        setUploadError(data.error || 'Upload failed.');
      }
    } catch {
      setUploadError('Upload failed. Please try using a URL instead.');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const generateUrl = () => {
    const base = window.location.origin + window.location.pathname;
    const params = new URLSearchParams({
      course: settings.course,
      template: settings.templateUrl,
    });
    // Only include optional params when they differ from defaults
    if (settings.nameX !== DEFAULT_SETTINGS.nameX)       params.set('nameX', settings.nameX.toString());
    if (settings.nameY !== DEFAULT_SETTINGS.nameY)       params.set('nameY', settings.nameY.toString());
    if (settings.fontSize !== DEFAULT_SETTINGS.fontSize) params.set('fontSize', settings.fontSize.toString());
    if (settings.color !== DEFAULT_SETTINGS.color)       params.set('color', settings.color);
    if (settings.fontFamily !== DEFAULT_SETTINGS.fontFamily) params.set('font', settings.fontFamily);
    if (!settings.bold)    params.set('bold', 'false');   // default is true
    if (settings.italic)   params.set('italic', 'true');  // default is false
    if (settings.shadow)   params.set('shadow', 'true');  // default is false
    setGeneratedUrl(`${base}?${params.toString()}`);
    setActiveTab('share');
  };

  const copyUrl = () => {
    if (!generatedUrl) return;
    navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
    setCanvasError('');
  }, []);

  const handleCanvasError = useCallback((msg: string) => {
    setCanvasError(msg);
  }, []);

  const canGenerate = !!(settings.course.trim() && settings.templateUrl.trim());

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
              <Settings className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-tight">Certificate Admin</h1>
              <p className="text-xs text-gray-400 leading-tight">Configure &amp; share certificate links</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Settings Panel (left / top) ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            {(
              [
                { id: 'template', label: 'Template', icon: ImageIcon },
                { id: 'text', label: 'Text Style', icon: Type },
                { id: 'share', label: 'Share', icon: Link2 },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                  activeTab === id
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Tab: Template */}
          {activeTab === 'template' && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-5">
              <h2 className="font-semibold text-gray-900">Certificate Template</h2>

              {/* URL input */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Image URL
                </label>
                <input
                  type="text"
                  value={settings.templateUrl}
                  onChange={(e) => {
                    updateSetting('templateUrl', e.target.value);
                    setCanvasError('');
                  }}
                  placeholder="https://example.com/certificate.jpg"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Paste an image URL or upload below. Use JPG, PNG, or WebP.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400">or upload</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {/* File upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {uploading ? 'Uploading…' : 'Click to upload template image'}
              </button>

              {uploadError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2.5 rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {uploadError}
                </div>
              )}

              {/* Course name */}
              <div className="pt-2 border-t border-gray-100">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Course / Program Name
                </label>
                <input
                  type="text"
                  value={settings.course}
                  onChange={(e) => updateSetting('course', e.target.value)}
                  placeholder="e.g. English Workshop"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Shown as the page title for students.
                </p>
              </div>
            </div>
          )}

          {/* Tab: Text Style */}
          {activeTab === 'text' && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-5">
              <h2 className="font-semibold text-gray-900">Name Placement &amp; Style</h2>

              {/* Position sliders */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Horizontal&nbsp;
                    <span className="text-indigo-600 font-semibold">{settings.nameX}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.5"
                    value={settings.nameX}
                    onChange={(e) => updateSetting('nameX', Number(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Vertical&nbsp;
                    <span className="text-indigo-600 font-semibold">{settings.nameY}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.5"
                    value={settings.nameY}
                    onChange={(e) => updateSetting('nameY', Number(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                </div>
              </div>

              {/* Font size */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Font Size&nbsp;
                  <span className="text-indigo-600 font-semibold">{settings.fontSize}px</span>
                </label>
                <input
                  type="range"
                  min="12"
                  max="400"
                  step="1"
                  value={settings.fontSize}
                  onChange={(e) => updateSetting('fontSize', Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>

              {/* Font family */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Font Family
                </label>
                <select
                  value={settings.fontFamily}
                  onChange={(e) => updateSetting('fontFamily', e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  style={{ fontFamily: settings.fontFamily }}
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Color */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Text Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.color}
                    onChange={(e) => updateSetting('color', e.target.value)}
                    className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer shrink-0 p-0.5"
                  />
                  <input
                    type="text"
                    value={settings.color}
                    onChange={(e) => updateSetting('color', e.target.value)}
                    placeholder="#1a1a1a"
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Style toggles */}
              <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100">
                {(
                  [
                    { key: 'bold', label: 'Bold', style: 'font-bold' },
                    { key: 'italic', label: 'Italic', style: 'italic' },
                    { key: 'shadow', label: 'Shadow', style: '' },
                  ] as const
                ).map(({ key, label, style }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={settings[key]}
                      onChange={(e) => updateSetting(key, e.target.checked)}
                      className="w-4 h-4 accent-indigo-600"
                    />
                    <span className={`text-sm text-gray-700 ${style}`}>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Tab: Share */}
          {activeTab === 'share' && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
              <h2 className="font-semibold text-gray-900">Generate Student Link</h2>
              <p className="text-sm text-gray-500">
                Generate a shareable URL that students use to enter their name and download their
                certificate.
              </p>

              {!canGenerate && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2.5 rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  Complete <strong>Template</strong> settings (template image + course name) first.
                </div>
              )}

              <button
                onClick={generateUrl}
                disabled={!canGenerate}
                className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Link2 className="w-4 h-4" />
                Generate URL
              </button>

              {generatedUrl && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedUrl}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 text-xs font-mono min-w-0"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      onClick={copyUrl}
                      title="Copy URL"
                      className="shrink-0 px-3 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <a
                      href={generatedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open in new tab"
                      className="shrink-0 px-3 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors flex items-center"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                  {copied && (
                    <p className="text-xs text-green-600 font-medium">Copied to clipboard!</p>
                  )}
                  <p className="text-xs text-gray-400">
                    Share this link with students. Settings are encoded in the URL — no account
                    needed.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Preview Panel (right / bottom) ── */}
        <div className="lg:col-span-3 lg:sticky lg:top-20 self-start">
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Live Preview</h2>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                &ldquo;{PREVIEW_NAME}&rdquo;
              </span>
            </div>

            {settings.templateUrl ? (
              <>
                {canvasError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2.5 rounded-xl mb-3">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {canvasError}
                  </div>
                )}
                <div className="flex justify-center">
                  <CertificateCanvas
                    templateUrl={settings.templateUrl}
                    name={PREVIEW_NAME}
                    nameX={settings.nameX}
                    nameY={settings.nameY}
                    fontSize={settings.fontSize}
                    color={settings.color}
                    fontFamily={settings.fontFamily}
                    bold={settings.bold}
                    italic={settings.italic}
                    shadow={settings.shadow}
                    onCanvasReady={handleCanvasReady}
                    onError={handleCanvasError}
                    className="shadow-md"
                  />
                </div>
              </>
            ) : (
              <div className="border-2 border-dashed border-gray-200 rounded-xl h-72 flex flex-col items-center justify-center gap-3 text-gray-400">
                <ImageIcon className="w-12 h-12 opacity-25" />
                <p className="text-sm text-center px-4">
                  Enter a template URL or upload an image to see the preview
                </p>
              </div>
            )}

            {!canvasError && settings.templateUrl && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={generateUrl}
                  disabled={!canGenerate}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Link2 className="w-4 h-4" />
                  Generate Student URL
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
