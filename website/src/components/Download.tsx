"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { getDownloadLinks } from "@/lib/download-utils";
import { ExternalLink } from "lucide-react";

export default function Download() {
  const [version, setVersion] = useState("3.1.0");
  const [links, setLinks] = useState(getDownloadLinks("3.1.0"));

  useEffect(() => {
    fetch("https://api.github.com/repos/Rexolt/spoty/releases/latest")
      .then((res) => res.json())
      .then((data) => {
        if (data.tag_name) {
          const v = data.tag_name.startsWith('v') ? data.tag_name.slice(1) : data.tag_name;
          setVersion(v);
          setLinks(getDownloadLinks(v));
        }
      })
      .catch((err) => console.error("Failed to fetch latest release:", err));
  }, []);

  const platforms = [
    {
      name: "Windows",
      icon: "/windows-11.png",
      key: "windows",
      color: "from-blue-600/20 to-blue-400/10"
    },
    {
      name: "macOS",
      icon: "/apple-logo.png",
      key: "macos",
      color: "from-gray-400/20 to-gray-200/10"
    },
    {
      name: "Linux",
      icon: "/linux-tux.png",
      key: "linux",
      color: "from-orange-400/20 to-yellow-200/10"
    }
  ];

  // Map icons to specific linux links
  const getIconForLink = (name: string) => {
    if (name.includes("Debian")) return "/debian.png";
    if (name.includes("Fedora")) return "/fedora.png";
    if (name.includes("Arch")) return "/arch.png";
    return null;
  };

  return (
    <section id="download" className="py-24 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#0A84FF]/10 blur-[120px] rounded-full -z-10" />
      
      <div className="max-w-7xl mx-auto px-6 text-center">
        <div className="inline-block px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm font-mono text-blue-400 mb-6">
          Latest Version: v{version}
        </div>
        <h2 className="text-4xl md:text-6xl font-bold mb-6 text-gradient">Download Spoty</h2>
        <p className="text-white/60 max-w-xl mx-auto text-lg mb-16">
          Available on all major platforms. Choose your operating system below to see available installers.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {platforms.map((platform, index) => (
            <motion.div
              key={platform.key}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group relative"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${platform.color} blur-2xl opacity-0 group-hover:opacity-100 transition-opacity rounded-[2rem]`} />
              <div className="relative p-8 rounded-[2rem] spoty-container flex flex-col items-center gap-6 border-white/5 hover:border-white/20 transition-all h-full">
                <div className="relative w-20 h-20 transition-transform group-hover:scale-110">
                  <Image 
                    src={platform.icon} 
                    alt={platform.name} 
                    fill 
                    className="object-contain"
                  />
                </div>
                <h3 className="text-2xl font-bold">{platform.name}</h3>
                
                <div className="w-full space-y-2 mt-4">
                  {(links as any)[platform.key].map((link: any, i: number) => {
                    const distroIcon = getIconForLink(link.name);
                    return (
                      <a
                        key={i}
                        href={link.url}
                        className="flex items-center justify-between w-full p-3 rounded-xl bg-white/5 hover:bg-[#0A84FF] transition-all group/link border border-white/5 hover:border-white/20"
                      >
                        <div className="flex items-center gap-3">
                          {distroIcon && (
                            <div className="relative w-5 h-5 grayscale group-hover/link:grayscale-0 transition-all">
                              <Image src={distroIcon} alt="Icon" fill className="object-contain" />
                            </div>
                          )}
                          <span className="text-sm font-medium text-white/80 group-hover/link:text-white">{link.name}</span>
                        </div>
                        <ExternalLink className="w-4 h-4 text-white/30 group-hover/link:text-white" />
                      </a>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-20 p-8 spoty-container rounded-3xl max-w-2xl mx-auto border-white/10">
          <p className="text-white/70 italic text-sm">
            "Spoty is open-source and free to use. All downloads are hosted on GitHub for maximum transparency and security."
          </p>
          <div className="mt-6 flex items-center justify-center gap-6 grayscale opacity-50">
            <span className="text-xs font-bold tracking-widest uppercase">Trusted by Developers</span>
          </div>
        </div>
      </div>
    </section>
  );
}
