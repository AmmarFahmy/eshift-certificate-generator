'use client';

import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, Award, AlertCircle } from 'lucide-react';
import CertificateCanvas from './CertificateCanvas';

function StudentCertificateContent() {
  const searchParams = useSearchParams();

  const course = searchParams.get('course') || '';
  const template = searchParams.get('template') || '';
  const nameX = parseFloat(searchParams.get('nameX') || '50');
  const nameY = parseFloat(searchParams.get('nameY') || '65');
  const fontSize = parseInt(searchParams.get('fontSize') || '72', 10);
  const color = searchParams.get('color') || '#1a1a1a';
  const fontFamily = searchParams.get('font') || 'Georgia';
  const bold = searchParams.get('bold') !== 'false';
  const italic = searchParams.get('italic') === 'true';
  const shadow = searchParams.get('shadow') === 'true';

  const [inputName, setInputName] = useState('');
  const [displayName, setDisplayName] = useState('Your Name Here');
  const [canvasError, setCanvasError] = useState('');
  const [downloaded, setDownloaded] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Live preview: debounce name input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayName(inputName.trim() || 'Your Name Here');
    }, 250);
    return () => clearTimeout(timer);
  }, [inputName]);

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
    setCanvasError('');
  }, []);

  const handleCanvasError = useCallback((msg: string) => {
    setCanvasError(msg);
  }, []);

  const handleDownload = () => {
    if (!canvasRef.current || !inputName.trim()) return;
    const link = document.createElement('a');
    const safeName = inputName.trim().replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');
    link.download = `certificate-${safeName}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-4 pb-10">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center pt-10 pb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl mb-4 shadow-lg shadow-indigo-200">
            <Award className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            {course || 'Certificate of Completion'}
          </h1>
          <p className="text-gray-500 mt-1">Enter your name to get your personalized certificate</p>
        </div>

        {/* Name input card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-5">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Your Full Name
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDownload()}
              placeholder="e.g. Jane Smith"
              maxLength={80}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              autoFocus
            />
            <button
              onClick={handleDownload}
              disabled={!inputName.trim() || !!canvasError}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 active:bg-indigo-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              {downloaded ? 'Downloaded!' : 'Download'}
            </button>
          </div>
          {inputName.trim() && (
            <p className="text-xs text-gray-400 mt-2">
              Preview updates live below. Click Download to save your certificate.
            </p>
          )}
        </div>

        {/* Certificate preview */}
        {template && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Live Preview</h2>

            {canvasError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {canvasError}
              </div>
            )}

            <div className="flex justify-center">
              <CertificateCanvas
                templateUrl={template}
                name={displayName}
                nameX={nameX}
                nameY={nameY}
                fontSize={fontSize}
                color={color}
                fontFamily={fontFamily}
                bold={bold}
                italic={italic}
                shadow={shadow}
                onCanvasReady={handleCanvasReady}
                onError={handleCanvasError}
                className="shadow-xl rounded-xl"
              />
            </div>

            {inputName.trim() && !canvasError && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-8 py-3.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 active:bg-green-800 transition-colors shadow-lg shadow-green-100 text-base"
                >
                  <Download className="w-5 h-5" />
                  {downloaded ? 'Certificate Downloaded!' : 'Download My Certificate'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function StudentCertificate() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <StudentCertificateContent />
    </Suspense>
  );
}
