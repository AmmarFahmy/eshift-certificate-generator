'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AdminLogin from '@/components/AdminLogin';
import StudentCertificate from '@/components/StudentCertificate';

function PageContent() {
  const searchParams = useSearchParams();
  const course = searchParams.get('course');
  const template = searchParams.get('template');

  // Show student view when course + template are in the URL
  if (course && template) {
    return <StudentCertificate />;
  }

  // Otherwise show admin login
  return <AdminLogin />;
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <PageContent />
    </Suspense>
  );
}
