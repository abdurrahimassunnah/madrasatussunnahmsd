import React, { useState } from 'react';
import { Eye, X, FileText, Maximize2 } from 'lucide-react';

interface FilePreviewProps {
  file: File;
}

const FilePreview: React.FC<FilePreviewProps> = ({ file }) => {
  const [isOpen, setIsOpen] = useState(false);
  const isPdf = file.type === 'application/pdf';
  const fileUrl = URL.createObjectURL(file);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center text-xs text-emerald-600 hover:text-emerald-700 font-medium hover:underline focus:outline-none"
      >
        <Eye className="w-3.5 h-3.5 mr-1" />
        প্রিভিউ দেখুন
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center space-x-2 overflow-hidden">
                <FileText className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <h3 className="font-semibold text-gray-800 truncate" title={file.name}>{file.name}</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-gray-200 rounded-full text-gray-500 hover:text-red-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 bg-gray-100 p-4 overflow-hidden relative">
              {isPdf ? (
                <iframe 
                  src={fileUrl} 
                  className="w-full h-full rounded-lg shadow-inner border border-gray-300 bg-white"
                  title="PDF Preview"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-white rounded-lg shadow-sm border border-gray-200 text-center p-8">
                  <FileText className="w-20 h-20 text-gray-300 mb-4" />
                  <p className="text-lg font-medium text-gray-700">এই ফরম্যাটটি সরাসরি প্রিভিউ করা সম্ভব নয়</p>
                  <p className="text-sm text-gray-500 mt-2">তবে ফাইলটি পাঠ পরিকল্পনা তৈরির জন্য ব্যবহার করা হবে।</p>
                  <p className="mt-4 text-xs bg-gray-100 px-3 py-1 rounded-full text-gray-600 font-mono">{file.type}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FilePreview;