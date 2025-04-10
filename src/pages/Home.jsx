import React from "react";
import { Typewriter } from "react-simple-typewriter";
import {
  FaLinkedin, FaReddit, FaGithub, FaPython, FaReact, FaNodeJs,
  FaHtml5, FaCss3Alt,
  FaBootstrap
} from "react-icons/fa";
import {
  SiDjango, SiFlask, SiNextdotjs, SiTailwindcss, SiNestjs,
  SiPostgresql, SiFastapi, SiJavascript
} from "react-icons/si";
import { MdEmail } from "react-icons/md";
import profile from "/Profile.jpeg";

const RainDots = () => {
  return (
    <div className="rain-container absolute inset-0 z-0 overflow-hidden">
      {[...Array(50)].map((_, i) => (
        <div key={i} className="rain-dot"></div>
      ))}
    </div>
  );
};

const Home = () => {
  const skills = [
    { name: "Python", icon: <FaPython size={50} /> },
    { name: "Django", icon: <SiDjango size={50} /> },
    { name: "Flask", icon: <SiFlask size={50} /> },
    { name: "JavaScript", icon: <SiJavascript size={50} /> },
    { name: "React", icon: <FaReact size={50} /> },
    { name: "Next.js", icon: <SiNextdotjs size={50} /> },
    { name: "Nest.js", icon: <SiNestjs size={50} /> },
    { name: "Tailwind CSS", icon: <SiTailwindcss size={50} /> },
    { name: "HTML", icon: <FaHtml5 size={50} /> },
    { name: "CSS", icon: <FaCss3Alt size={50} /> },
    { name: "Fast API", icon: <SiFastapi size={50} /> },
    { name: "PostgreSQL", icon: <SiPostgresql size={50} /> },
    { name: "Bootstrap", icon: <FaBootstrap size={50} /> },
  ];

  return (
<div className="relative flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white px-6 sm:px-12 lg:px-24 xl:px-32 lg:ml-[250px] lg:w-[calc(100%-250px)]">
<RainDots />

      <main className="w-full max-w-6xl p-10 flex flex-col items-center text-center relative z-10">
        <section id="home" className="mb-16">
          <div className="relative mb-8">
            <img
              src={profile}
              alt="Profile"
              className="w-40 h-40 mx-auto rounded-full border-4 border-gray-700 shadow-xl transition-transform duration-300 hover:scale-110"
            />
          </div>
          <h2 className="text-4xl font-bold">
            <Typewriter
              words={["Luqman Bashir", "Full-Stack Developer", "Software Engineer"]}
              loop={true}
              cursor
              cursorStyle="|"
              typeSpeed={100}
              deleteSpeed={50}
              delaySpeed={1500}
            />
          </h2>

          <p className="text-gray-400 mt-4 max-w-2xl text-lg">
            I'm a dedicated and enthusiastic technical professional with expertise in JavaScript, React, Next.js, Python, Flask, TailwindCSS, and Django.
          </p>
        </section>

        <section id="skills" className="mb-16">
          <h3 className="text-3xl font-bold mb-8">My Skills</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8">
            {skills.map((skill, index) => (
              <div
                key={index}
                className="flex flex-col items-center p-6 bg-gray-800 rounded-lg text-center shadow-lg transition duration-300 transform hover:scale-110 hover:bg-gray-700"
              >
                <div className="text-white">{skill.icon}</div>
                <p className="text-gray-400 mt-3 text-lg font-medium">{skill.name}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex justify-center space-x-8 mt-16">
          <a
            href="https://www.linkedin.com/in/luqman-bashir-055985350/"
            className="text-gray-400 hover:text-blue-500 transition duration-300 transform hover:scale-125"
          >
            <FaLinkedin size={50} />
          </a>
          <a
            href="https://www.reddit.com/user/uth_man_/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-red-500 transition duration-300 transform hover:scale-125"
          >
            <FaReddit size={50} />
          </a>
          <a
            href="https://github.com/luqman-bashir"
            className="text-gray-400 hover:text-gray-200 transition duration-300 transform hover:scale-125"
          >
            <FaGithub size={50} />
          </a>
          <a
            href="https://mail.google.com/mail/?view=cm&fs=1&to=luqmanbashir22@gmail.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-red-500 transition duration-300 transform hover:scale-125"
          >
            <MdEmail size={50} />
          </a>
        </section>
      </main>
    </div>
  );
};

export default Home;
