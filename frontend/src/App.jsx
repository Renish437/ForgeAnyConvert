import React from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ThemeModeProvider } from "./hooks/useThemeMode";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Landing from "./pages/Landing";
import Converter from "./pages/Converter";
import PdfStudio from "./pages/PdfStudio";
import GithubGrabber from "./pages/GithubGrabber";
import ImageLab from "./pages/ImageLab";
import MediaConverter from "./pages/MediaConverter";

const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.22, ease: "easeOut" },
};

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <motion.div {...pageTransition}>
              <Landing />
            </motion.div>
          }
        />
        <Route
          path="/converter"
          element={
            <motion.div {...pageTransition}>
              <Converter />
            </motion.div>
          }
        />
        <Route
          path="/pdf-studio"
          element={
            <motion.div {...pageTransition}>
              <PdfStudio />
            </motion.div>
          }
        />
        <Route
          path="/image-lab"
          element={
            <motion.div {...pageTransition}>
              <ImageLab />
            </motion.div>
          }
        />
        <Route
          path="/media"
          element={
            <motion.div {...pageTransition}>
              <MediaConverter />
            </motion.div>
          }
        />
        <Route
          path="/github"
          element={
            <motion.div {...pageTransition}>
              <GithubGrabber />
            </motion.div>
          }
        />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <ThemeModeProvider>
      <BrowserRouter>
        <div className="flex min-h-screen flex-col bg-bg">
          <Navbar />
          <div className="flex-1">
            <AnimatedRoutes />
          </div>
          <Footer />
        </div>
      </BrowserRouter>
    </ThemeModeProvider>
  );
}

export default App;
