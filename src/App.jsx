import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Contact from "./pages/Contact";
import NavBar from "./components/NavBar";
import About from "./pages/About";
import Portfolio from "./pages/Portfolio";

export default function App() {
  return (
    <Router>
      <div className="flex flex-col lg:flex-row min-h-screen bg-gray-900 text-white">
        <NavBar />

        <div className="w-full lg:w-5/6 p-10 flex justify-center items-center">
          <div className="max-w-7xl w-full">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/about" element={<About />} />
              <Route path="/portfolio" element={<Portfolio />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}
