"use client";

import Link from "next/link";
import { Search, Code } from "lucide-react";

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 glass border-b border-white/5">
      <div className="flex items-center gap-2">
        <div className="bg-[#0A84FF] p-1.5 rounded-lg">
          <Search className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold tracking-tight">Spoty</span>
      </div>

      <div className="hidden md:flex items-center gap-8 text-sm font-medium text-white/70">
        <Link href="#features" className="hover:text-white transition-colors">Features</Link>
        <Link href="#download" className="hover:text-white transition-colors">Download</Link>
        <Link href="https://github.com/Rexolt/spoty" target="_blank" className="hover:text-white transition-colors flex items-center gap-1.5">
          <Code className="w-4 h-4" />
          GitHub
        </Link>
      </div>

      <div>
        <Link 
          href="#download" 
          className="bg-white text-black px-5 py-2 rounded-full text-sm font-semibold hover:bg-white/90 transition-all active:scale-95"
        >
          Get Started
        </Link>
      </div>
    </nav>
  );
}
