import React from "react";
import { FaWhatsapp } from "react-icons/fa";
import { FiMail, FiMapPin, FiPhone } from "react-icons/fi";

const Contact = () => {
  return (
<div className="flex justify-center items-center min-h-screen bg-gray-900 text-white p-4 lg:ml-[250px]">
<div className="bg-gray-800 p-6 rounded-xl shadow-lg w-full max-w-2xl md:max-w-3xl lg:max-w-4xl">
        <h2 className="text-2xl font-bold text-white mb-4 text-center md:text-left">Contact Me</h2>
        <p className="text-gray-400 mb-4 text-center md:text-left">
          Feel free to reach out for collaborations, projects, or just to say hello!
        </p>

        {/* Contact Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center space-x-3">
            <FiMail className="text-orange-400" />
            <p className="break-all">luqmanbashir22@gmail.com</p>
          </div>

          <div className="flex items-center space-x-3">
            <FiPhone className="text-green-400" />
            <p>+254 114116498</p>
          </div>

          <div className="flex items-center space-x-3">
            <FiMapPin className="text-blue-400" />
            <p>Nairobi, Kenya</p>
          </div>

          <div className="flex items-center space-x-3">
            <FaWhatsapp className="text-green-500" />
            <a
              href="https://wa.me/254114116498"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              WhatsApp Me
            </a>
          </div>
        </div>

        {/* Google Map - Responsive */}
        <div className="mt-6 w-full h-56 sm:h-64 md:h-72 lg:h-80">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3988.8360392327163!2d36.83247937590193!3d-1.2714165987164847!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x182f16daa6419c4b%3A0x42b506bc65bb202a!2sLosai%20Rd%2C%20Nairobi%2C%20Kenya!5e0!3m2!1sen!2sus!4v1739480096135!5m2!1sen!2us"
            className="w-full h-full rounded-lg"
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          ></iframe>
        </div>
      </div>
    </div>
  );
};

export default Contact;
