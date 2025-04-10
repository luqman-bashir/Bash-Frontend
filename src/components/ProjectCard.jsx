import React from "react";

const ProjectCard = ({ project }) => {
  return (
    <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
      <img
        src={project.image}
        alt={project.title}
        className="w-full h-64 object-cover rounded-lg"
      />
      <h2 className="text-xl font-semibold mt-4">
        <a
          href={project.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:underline"
        >
          {project.title}
        </a>
      </h2>
      <p className="text-gray-400">{project.description}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {project.tags.map((tag, index) => (
          <span
            key={index}
            className="bg-red-500 text-xs px-2 py-1 rounded-full text-white"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
};

export default ProjectCard;
