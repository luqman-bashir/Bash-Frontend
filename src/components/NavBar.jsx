import React, { useState } from "react";
import { Link } from "react-router-dom";
import { FiHome, FiBriefcase, FiUser, FiMail, FiMenu, FiX } from "react-icons/fi";

const RainDots = () => {
  return (
    <div className="rain-container absolute inset-0 z-0 overflow-hidden">
      {[...Array(50)].map((_, i) => (
        <div key={i} className="rain-dot"></div>
      ))}
    </div>
  );
};

const NavBar = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="bg-black text-white fixed top-0 left-0 w-full p-4 z-50 lg:w-1/5 lg:h-screen lg:flex lg:flex-col lg:items-center lg:justify-center shadow-lg">
      {/* Mobile Menu Button */}
      <RainDots />

      <div className="flex justify-between items-center w-full lg:hidden">
        <h1 className="text-2xl font-signature">Luqman.</h1>
        <button onClick={() => setIsOpen(!isOpen)} className="text-2xl">
          {isOpen ? <FiX /> : <FiMenu />}
        </button>
      </div>
      
      {/* Logo - Shown on Larger Screens */}
      <div className="hidden lg:block text-center mb-5">
        <h1 className="text-3xl font-signature">Luqman.</h1>
      </div>
      
      {/* Navigation Links */}
      <ul className={`absolute top-16 left-0 w-full bg-black lg:static lg:w-auto lg:bg-transparent text-gray-400 text-lg text-center lg:text-left transition-all duration-300 ease-in-out ${isOpen ? "block" : "hidden lg:flex lg:flex-col"}`}>
        {[{ to: "/", icon: FiHome, label: "Home" },
          { to: "/portfolio", icon: FiBriefcase, label: "Portfolio" },
          { to: "/about", icon: FiUser, label: "About Me" },
          { to: "/contact", icon: FiMail, label: "Contact" }].map((item, index) => (
          <li key={index} className="py-2 lg:py-3 flex items-center justify-center lg:justify-start space-x-3 hover:text-white transition duration-300">
            <item.icon className="text-xl" />
            <Link to={item.to} onClick={() => setIsOpen(false)}>{item.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default NavBar;
