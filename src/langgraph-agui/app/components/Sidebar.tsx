"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { name: "AGUI Example", href: "/pages/agui-tools" },
  { name: "Deepsearch Example", href: "/pages/deepsearch" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0 shadow-sm shrink-0">
      <div className="p-6 border-b border-gray-100">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <span className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm font-mono">LG</span>
          LangGraph
        </h1>
      </div>
      
      <div className="flex-1 overflow-y-auto py-6 px-4">
        <div className="mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider px-2">
          Examples
        </div>
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`
                    group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200
                    ${isActive 
                      ? "bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-200" 
                      : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                    }
                  `}
                >
                  <span className={`w-1.5 h-1.5 rounded-full mr-3 transition-colors ${isActive ? "bg-blue-500" : "bg-gray-300 group-hover:bg-gray-400"}`}></span>
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 px-2 py-2 bg-gray-50 rounded-lg border border-gray-100">
          <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 text-xs font-bold shadow-sm">
            U
          </div>
          <div className="text-xs text-gray-500 overflow-hidden">
            <p className="font-medium text-gray-700 truncate">Demo User</p>
            <p className="truncate">Local Environment</p>
          </div>
        </div>
      </div>
    </nav>
  );
}