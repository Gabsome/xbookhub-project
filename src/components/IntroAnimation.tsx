import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import pageFlipSound from '../sounds/one-page-book-flip-101928.mp3';
import roseImage from '../assets/rose.jpg'; // Ensure the path is correct

const IntroAnimation = ({ onComplete }: { onComplete: () => void }) => {
  const [show, setShow] = useState(true);
  const soundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(pageFlipSound);
    audio.volume = 0.9;
    soundRef.current = audio;

    // Try playing the sound immediately
    audio.play().catch((err) => {
      console.warn('Autoplay blocked:', err);
    });

    // Fallback if autoplay fails
    const handleUserInteraction = () => {
      if (audio.paused) {
        audio.play().catch(() => {});
      }
      window.removeEventListener('click', handleUserInteraction);
    };
    window.addEventListener('click', handleUserInteraction);

    const timer = setTimeout(() => {
      setShow(false);
      onComplete();
    }, 5000); // End animation after 5s

    return () => {
      clearTimeout(timer);
      audio.pause();
      audio.currentTime = 0;
      window.removeEventListener('click', handleUserInteraction);
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed top-0 left-0 w-full h-full bg-gray-900 z-50 flex justify-center items-center perspective"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
        >
          <div className="relative w-[340px] h-[460px] sm:w-[420px] sm:h-[520px]">
            <motion.div
              className="absolute w-full h-full rounded-lg shadow-2xl"
              initial={{ rotateY: 0 }}
              animate={{ rotateY: 180 }}
              transition={{ duration: 5, ease: 'easeInOut' }}
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* Front Face */}
              <motion.div
                className="absolute w-full h-full bg-gray-900 text-amber-400 flex flex-col items-center justify-center font-serif backface-hidden rounded-lg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 1 }}
              >
                <div className="text-center text-4xl leading-snug sm:text-5xl">
                  Someone to<br />
                  <span className="text-5xl sm:text-6xl font-bold mt-2">LYNN on.</span>
                </div>
                <img
                  src={roseImage}
                  alt="Rose"
                  className="w-20 sm:w-24 mt-6 object-contain select-none"
                  draggable={false}
                />
              </motion.div>

              {/* Back Face */}
              <div className="absolute w-full h-full bg-amber-700 dark:bg-gray-900 text-white text-3xl sm:text-4xl flex items-center justify-center font-mono rotate-y-180 backface-hidden rounded-lg">
                <div className="text-center">by Gabsome X</div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IntroAnimation;
