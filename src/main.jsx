// index.jsx
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function ResponsiveToastContainer() {
  const [pos, setPos] = useState(
    typeof window !== "undefined" && window.innerWidth < 640 ? "top-center" : "top-right"
  );
  useEffect(() => {
    const onResize = () => setPos(window.innerWidth < 640 ? "top-center" : "top-right");
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return (
    <ToastContainer
      position={pos}
      autoClose={3000}
      hideProgressBar={false}
      newestOnTop={false}
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="light"
    />
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ResponsiveToastContainer />
    <App />
  </StrictMode>
);
