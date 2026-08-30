import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Users, Target, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useTeams } from "@/contexts/TeamsContext";
import { useMilestones } from "@/hooks/useMilestones";

interface SidebarProps {
  children: React.ReactNode;
}

const Sidebar: React.FC<SidebarProps> = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const { teams } = useTeams();
  const { milestones } = useMilestones();

  const isDashboardAccessible = teams.length > 0 && milestones.length > 0;

  const dashboardTooltip = !isDashboardAccessible
    ? teams.length === 0 && milestones.length === 0
      ? "Add teams and milestones to access the Dashboard"
      : teams.length === 0
        ? "Add teams to access the Dashboard"
        : "Add milestones to access the Dashboard"
    : undefined;

  const navigationItems = [
    {
      name: "Dashboard",
      href: "/",
      icon: Home,
      disabled: !isDashboardAccessible,
    },
    {
      name: "Teams",
      href: "/teams",
      icon: Users,
      disabled: false,
    },
    {
      name: "Milestones",
      href: "/milestones",
      icon: Target,
      disabled: false,
    },
  ];

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Sidebar */}
      <div
        className={cn(
          "bg-gray-800 border-r border-gray-700 transition-all duration-300 flex flex-col",
          isCollapsed ? "w-[5rem]" : "w-64"
        )}
      >
        {/* Logo Section */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 transition-all duration-300",
                isCollapsed
                  ? "w-12 h-12"
                  : "w-full px-2"
              )}
            >
              <img
                src={isCollapsed ? "/logo_dark.png" : "/full_logo.png"}
                alt="Digital Dreamers Den"
                className="w-full h-full object-contain object-left rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navigationItems.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;
              
              if (item.disabled) {
                return (
                  <li key={item.name}>
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 rounded-lg cursor-not-allowed opacity-40",
                              "text-gray-500"
                            )}
                          >
                            <Icon className="w-5 h-5 flex-shrink-0" />
                            {!isCollapsed && (
                              <span className="text-sm font-medium">{item.name}</span>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="bg-gray-700 text-white border-gray-600">
                          <p>{dashboardTooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </li>
                );
              }

              return (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-200 group",
                      isActive
                        ? "bg-blue-600 text-white"
                        : "text-gray-300 hover:bg-gray-700 hover:text-white"
                    )}
                    title={isCollapsed ? item.name : undefined}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {!isCollapsed && (
                      <span className="text-sm font-medium">{item.name}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Toggle Button */}
        <div className="p-4 border-t border-gray-700">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full justify-center text-gray-400 hover:text-white hover:bg-gray-700"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
            {!isCollapsed && <span className="ml-2 text-sm">Collapse</span>}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
};

export default Sidebar;
