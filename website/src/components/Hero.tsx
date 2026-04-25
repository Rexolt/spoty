"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Download, Command, Search, Globe, Terminal, Mic } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-radial-gradient -z-10" />
      
      <div className="max-w-7xl mx-auto px-6 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-blue-400 mb-8"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          Version 3.0 is out
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl md:text-7xl font-bold tracking-tight mb-6"
        >
          Your computer, <br />
          <span className="text-gradient">redefined.</span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="max-w-2xl text-lg md:text-xl text-white/60 mb-10"
        >
          Spoty is a lightning-fast, extensible search launcher that brings everything you need to your fingertips. Apps, files, calculations, and AI — all in one place.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center gap-4 mb-16"
        >
          <a 
            href="#download" 
            className="w-full sm:w-auto bg-[#0A84FF] text-white px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#409CFF] transition-all active:scale-95 shadow-lg shadow-blue-600/20"
          >
            <Download className="w-5 h-5" />
            Download for Free
          </a>
          <button className="w-full sm:w-auto px-8 py-4 rounded-2xl font-bold bg-white/5 border border-white/10 flex items-center justify-center gap-2 hover:bg-white/10 transition-all active:scale-95">
            <Command className="w-5 h-5" />
            Alt + Space to open
          </button>
        </motion.div>

        {/* Live-looking Spoty UI Mockup using original styles */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="relative w-full max-w-2xl aspect-video animate-float"
        >
          <div className="absolute inset-0 bg-[#0A84FF]/20 blur-[100px] -z-10 rounded-full" />
          
          <div className="spoty-container w-full text-left overflow-hidden flex flex-col h-full">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
              <div className="flex bg-black/20 rounded-full p-1 border border-white/5">
                <div className="px-4 py-1 bg-white/10 rounded-full text-xs font-semibold text-white">Search</div>
                <div className="px-4 py-1 text-xs font-semibold text-white/40">AI Mode</div>
              </div>
            </div>

            <div className="spoty-search-bar">
              <Search className="w-6 h-6 text-white/40" />
              <div className="text-2xl font-light text-white/80">Search everything...</div>
            </div>

            <div className="flex-1 p-2 space-y-1">
              <div className="spoty-result-item bg-white/10 border border-white/10">
                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center border border-green-500/20">
                  <Mic className="w-6 h-6 text-green-500" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">Spotify</div>
                  <div className="text-xs text-white/40 italic">Application</div>
                </div>
                <div className="text-[10px] uppercase tracking-wider bg-[#0A84FF] px-2 py-1 rounded text-white font-bold">Open</div>
              </div>

              <div className="spoty-result-item">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center border border-blue-500/20">
                  <Globe className="w-6 h-6 text-blue-500" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-white/80">Google Chrome</div>
                  <div className="text-xs text-white/40 italic">Browser</div>
                </div>
              </div>

              <div className="spoty-result-item">
                <div className="w-10 h-10 bg-gray-500/20 rounded-lg flex items-center justify-center border border-gray-500/20">
                  <Terminal className="w-6 h-6 text-gray-400" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-white/80">Terminal</div>
                  <div className="text-xs text-white/40 italic">Command Line</div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
