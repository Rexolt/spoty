"use client";

import { motion } from "framer-motion";
import { 
  Rocket, 
  Search, 
  Calculator, 
  Cloud, 
  Terminal, 
  Brain, 
  Copy, 
  Palette 
} from "lucide-react";

const features = [
  {
    title: "App Launcher",
    description: "Instantly find and launch any installed application with fuzzy search.",
    icon: Rocket,
    color: "text-[#0A84FF]",
    bg: "bg-[#0A84FF]/10"
  },
  {
    title: "File Search",
    description: "Deep search across your Desktop, Documents, and Downloads folders.",
    icon: Search,
    color: "text-purple-500",
    bg: "bg-purple-500/10"
  },
  {
    title: "Smart Calculator",
    description: "Perform math, unit conversions, and currency exchanges on the fly.",
    icon: Calculator,
    color: "text-green-500",
    bg: "bg-green-500/10"
  },
  {
    title: "Weather Widget",
    description: "Get real-time weather updates for any city without opening a browser.",
    icon: Cloud,
    color: "text-sky-500",
    bg: "bg-sky-500/10"
  },
  {
    title: "System Commands",
    description: "Lock, sleep, shutdown, or restart your computer with simple commands.",
    icon: Terminal,
    color: "text-red-500",
    bg: "bg-red-500/10"
  },
  {
    title: "AI Integration",
    description: "Powered by OpenAI, Gemini, or local Ollama for instant assistance.",
    icon: Brain,
    color: "text-yellow-500",
    bg: "bg-yellow-500/10"
  },
  {
    title: "Clipboard History",
    description: "Access your recent clipboard entries and search through them easily.",
    icon: Copy,
    color: "text-orange-500",
    bg: "bg-orange-500/10"
  },
  {
    title: "Custom Themes",
    description: "Dark, Light, Midnight, and more. Make Spoty yours.",
    icon: Palette,
    color: "text-pink-500",
    bg: "bg-pink-500/10"
  }
];

export default function Features() {
  return (
    <section id="features" className="py-24 bg-white/[0.02]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">Supercharged Features</h2>
          <p className="text-white/60 max-w-2xl mx-auto text-lg">
            Everything you need to boost your productivity, packed into a sleek and minimal interface.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="p-8 rounded-3xl spoty-result-item hover:bg-white/[0.05] transition-all group"
            >
              <div className={`w-12 h-12 ${feature.bg} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform border border-white/5`}>
                <feature.icon className={`w-6 h-6 ${feature.color}`} />
              </div>
              <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
              <p className="text-white/50 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
