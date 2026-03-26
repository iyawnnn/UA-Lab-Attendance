"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-xl p-10 border border-gray-100 text-center">
        
        <h1 className="text-4xl font-extrabold text-blue-900 tracking-tight mb-4">
          Laboratory System
        </h1>
        <p className="text-gray-500 mb-10 text-lg">
          Secure identity verification and attendance tracking.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link 
            href="/student" 
            className="group flex flex-col items-center justify-center p-8 bg-blue-50 hover:bg-blue-600 rounded-2xl transition-all duration-300 border border-blue-100 hover:border-blue-600"
          >
            <h2 className="text-2xl font-bold text-blue-900 group-hover:text-white mb-2">Student Portal</h2>
            <p className="text-sm text-blue-700 group-hover:text-blue-100">Register device or log attendance</p>
          </Link>

          <Link 
            href="/admin" 
            className="group flex flex-col items-center justify-center p-8 bg-gray-50 hover:bg-gray-800 rounded-2xl transition-all duration-300 border border-gray-200 hover:border-gray-800"
          >
            <h2 className="text-2xl font-bold text-gray-800 group-hover:text-white mb-2">Admin Access</h2>
            <p className="text-sm text-gray-500 group-hover:text-gray-300">Manage logs and devices</p>
          </Link>
        </div>

      </div>
    </main>
  );
}