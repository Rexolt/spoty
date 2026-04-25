import { Search, Code, Globe, Mail } from "lucide-react";

export default function Footer() {
  return (
    <footer className="py-20 border-t border-white/5 bg-black">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <div className="bg-[#0A84FF] p-1.5 rounded-lg">
                <Search className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight">Spoty</span>
            </div>
            <p className="text-white/50 max-w-sm mb-8 leading-relaxed">
              The open-source productivity launcher that simplifies your digital workflow. Built with love by the community.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="p-2 glass rounded-lg hover:text-blue-400 transition-colors">
                <Globe className="w-5 h-5" />
              </a>
              <a href="https://github.com/Rexolt/spoty" className="p-2 glass rounded-lg hover:text-blue-400 transition-colors">
                <Code className="w-5 h-5" />
              </a>
              <a href="#" className="p-2 glass rounded-lg hover:text-blue-400 transition-colors">
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-6">Product</h4>
            <ul className="space-y-4 text-white/50 text-sm">
              <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#download" className="hover:text-white transition-colors">Download</a></li>
              <li><a href="https://github.com/Rexolt/spoty/releases" className="hover:text-white transition-colors">Release Notes</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-6">Support</h4>
            <ul className="space-y-4 text-white/50 text-sm">
              <li><a href="https://github.com/Rexolt/spoty/issues" className="hover:text-white transition-colors">Issues</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Community</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">License</a></li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-white/5 text-white/30 text-xs">
          <p>© {new Date().getFullYear()} Spoty Project. All rights reserved.</p>
          <p>Handcrafted by Rexolt</p>
        </div>
      </div>
    </footer>
  );
}
