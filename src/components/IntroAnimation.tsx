import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import booksImage from '../assets/books.jpg'; // Ensure the path is correct

const IntroAnimation = ({ onComplete }: { onComplete: () => void }) => {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
      onComplete();
    }, 4000); // Increased duration slightly for the new effect

    return () => {
      clearTimeout(timer);
    };
  }, [onComplete]);

  // Animation variants for a subtle grain-like text reveal
  const textVariants = {
    hidden: { opacity: 0, scale: 0.98, filter: 'blur(2px)' }, // Initial state with blur for "grain" feel
    visible: { opacity: 1, scale: 1, filter: 'blur(0px)', transition: { duration: 0.8, ease: 'easeOut' } },
  };

  const imageVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: 'easeOut' } },
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed top-0 left-0 w-full h-full bg-gray-950 z-50 flex justify-center items-center" // Darker background
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1, ease: 'easeOut' }}
        >
          <div className="flex flex-col items-center justify-center">
            {/* "Welcome to Xbook-Hub." text animation */}
            <motion.div
              className="text-center text-4xl leading-snug sm:text-5xl text-blue-300 font-oxanium" // Blueish text, Oxanium font
              variants={textVariants}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.3, ...textVariants.visible.transition }}
            >
              Welcome to<br />
              <motion.span
                className="text-5xl sm:text-6xl font-bold mt-2 text-indigo-400 font-space-mono" // Different color for bold part, Space Mono font
                variants={textVariants}
                initial="hidden"
                animate="visible"
                transition={{ delay: 0.7, ...textVariants.visible.transition }}
              >
                Xbook-Hub.
              </motion.span>
            </motion.div>

            {/* Books image animation */}
            <motion.img
              src={booksImage}
              alt="Books"
              className="w-40 sm:w-52 mt-10 sm:mt-12 object-contain select-none"
              draggable={false}
              variants={imageVariants}
              initial="hidden"
              animate="visible"
              transition={{ delay: 1.5, ...imageVariants.visible.transition }}
            />

            {/* "by Gabsome X" text animation */}
            <motion.div
              className="mt-8 text-gray-400 text-xl sm:text-2xl font-space-mono" // Greyish text, Space Mono font
              variants={imageVariants} // Reusing image variants for a similar reveal
              initial="hidden"
              animate="visible"
              transition={{ delay: 2.0, ...imageVariants.visible.transition }}
            >
              by Gabsome X
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IntroAnimation;