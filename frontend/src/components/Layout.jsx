import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sidebar, SidebarBody, SidebarLink } from './ui/Sidebar';
import { useAuth } from '../providers/AuthProvider';
import {
  IconLayoutDashboard,
  IconSend,
  IconRobot,
  IconUsers,
  IconMessage,
  IconLogout,
  IconActivity
} from '@tabler/icons-react';
import { cn } from '../utils';

export default function Layout() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const links = [
    {
      label: 'Dashboard',
      href: '/',
      icon: (
        <IconLayoutDashboard className="h-5 w-5 shrink-0 text-white" />
      ),
    },
    {
      label: 'Blast',
      href: '/blast',
      icon: (
        <IconSend className="h-5 w-5 shrink-0 text-white" />
      ),
    },
    {
      label: 'Bot',
      href: '/bot',
      icon: (
        <IconRobot className="h-5 w-5 shrink-0 text-white" />
      ),
    },
    {
      label: 'Contact',
      href: '/contact',
      icon: (
        <IconUsers className="h-5 w-5 shrink-0 text-white" />
      ),
    },
    {
      label: 'Messages',
      href: '/messages',
      icon: (
        <IconMessage className="h-5 w-5 shrink-0 text-white" />
      ),
    },
  ];

  const Logo = () => {
    return (
      <div
        className="flex items-center gap-2 py-1"
      >
        <motion.div
          className="h-6 w-7 shrink-0 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center"
          whileHover={{ scale: 1.05 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <IconActivity className="h-4 w-4 text-white" />
        </motion.div>
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="font-medium whitespace-pre text-white"
        >
          Burhan2WS
        </motion.span>
      </div>
    );
  };

  const LogoIcon = () => {
    return (
      <div
        className="flex items-center gap-2 py-1"
      >
        <motion.div
          className="h-6 w-7 shrink-0 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center"
          whileHover={{ scale: 1.05 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <IconActivity className="h-4 w-4 text-white" />
        </motion.div>
      </div>
    );
  };

  return (
    <div className="h-screen w-screen bg-slate-950 grid-pattern overflow-hidden">
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-10">
          <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
            {open ? <Logo /> : <LogoIcon />}
            <div className="mt-8 flex flex-col gap-2">
              {links.map((link, idx) => (
                <div
                  key={idx}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(link.href);
                  }}
                >
                  <SidebarLink
                    link={link}
                    className={cn(
                      'rounded-xl px-3 py-2',
                      location.pathname === link.href
                        ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-white'
                        : 'text-slate-400 hover:bg-gradient-to-r hover:from-indigo-500/10 hover:to-purple-500/10 hover:text-white'
                    )}
                  />
                </div>
              ))}
            </div>
          </div>
          <div>
            <div
              onClick={(e) => {
                e.preventDefault();
                logout();
                navigate('/login');
              }}
            >
              <SidebarLink
                link={{
                  label: 'Logout',
                  href: '#',
                  icon: (
                    <IconLogout className="h-5 w-5 shrink-0 text-white" />
                  ),
                }}
                className="rounded-xl px-3 py-2 text-slate-400 hover:bg-gradient-to-r hover:from-red-500/10 hover:to-rose-500/10 hover:text-red-400"
              />
            </div>
          </div>
        </SidebarBody>
      </Sidebar>

      {/* Main content */}
      <main className="fixed top-0 right-0 bottom-0 left-0 md:left-[70px] transition-all duration-500 ease-out overflow-hidden flex flex-col bg-slate-950">
        <div className="flex-1 overflow-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
