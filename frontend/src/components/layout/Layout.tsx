import React from 'react';
import { Navbar } from './Navbar';
import { Outlet } from 'react-router-dom';

export const Layout: React.FC = () => {
  return (
    <div className="layout">
      <Navbar />
      <main className="page-wrapper container animate-fade-up">
        <Outlet />
      </main>
    </div>
  );
};
