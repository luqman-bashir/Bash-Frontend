import React from "react";

const About = () => {
  const education = [
    {
      institution: "University Of Nairobi",
      program: "Bachelor Of Computer Science (Currently Enrolled)",
      iconColor: "bg-green-500",
    },
    {
      institution: "Moringa School, Nairobi",
      program: "Certificate in Full-Stack Development (Sep 2024 – Feb 2025)",
      description: ["Focused on JavaScript, Flask, Django, React, and Python development."],
      iconColor: "bg-green-500",
    },
    {
      institution: "Khalifa Bin Jassim High School",
      program: "Certificate of Secondary Education (Jan 2020 – Oct 2023)",
      description: ["Completed with a mean grade of B"],
      iconColor: "bg-blue-500",
    },
  ];

  return (
<div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-6 lg:ml-[250px]">
<div className="max-w-4xl w-full">
        <h1 className="text-3xl font-bold mb-4 text-gray-100 text-center md:text-left">About Me</h1>
        <p className="text-gray-400 mb-6 text-center md:text-left">
          Hello, I am Luqman, a passionate Full-Stack Developer currently exploring new technologies.
        </p>

        {/* Education Background */}
        <h2 className="text-2xl font-semibold mt-8 mb-4 text-gray-100 text-center md:text-left">Education Background</h2>
        <div className="space-y-4">
          {education.map((edu, index) => (
            <div
              key={index}
              className="flex flex-col md:flex-row items-start bg-gray-800 p-4 rounded-lg shadow-md border border-gray-700"
            >
              {/* Icon */}
              <div className={`w-3 h-3 rounded-full ${edu.iconColor} mr-0 md:mr-4 mt-1`} />

              {/* Education Details */}
              <div className="text-center md:text-left">
                <h3 className="text-lg font-semibold">{edu.institution}</h3>
                <p className="text-gray-300">{edu.program}</p>
                {edu.description && (
                  <ul className="list-disc list-inside text-gray-400 mt-2 space-y-1">
                    {edu.description.map((desc, i) => (
                      <li key={i}>{desc}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default About;
