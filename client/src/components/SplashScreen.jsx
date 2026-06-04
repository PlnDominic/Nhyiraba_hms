import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SplashScreen = ({ onComplete }) => {
  const [stage, setStage] = useState('logo'); // 'logo', 'name', 'fade'

  useEffect(() => {
    // Logo animation stage
    const logoTimer = setTimeout(() => {
      setStage('name');
    }, 1500);

    // Name animation stage
    const nameTimer = setTimeout(() => {
      setStage('fade');
    }, 3000);

    // Complete and hide splash
    const completeTimer = setTimeout(() => {
      if (onComplete) onComplete();
    }, 3800);

    return () => {
      clearTimeout(logoTimer);
      clearTimeout(nameTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
        style={{
          background: '#e94e00',
        }}
      >


        {/* Main content container */}
        <div className="relative z-10 flex flex-col items-center justify-center">
          {/* Logo Animation */}
          <motion.div
            initial={{ scale: 0, rotate: -180, opacity: 0 }}
            animate={{
              scale: stage === 'logo' || stage === 'name' ? 1 : 0.8,
              rotate: 0,
              opacity: stage === 'fade' ? 0 : 1,
            }}
            transition={{
              duration: 1,
              ease: [0.6, 0.05, 0.01, 0.9],
            }}
            className="mb-8"
          >
            {/* Logo container - white rectangular with stroke */}
            <div className="relative">
              <motion.div
                className="relative bg-white p-8 shadow-2xl border-4 border-orange-600"
                style={{
                  borderRadius: '16px',
                  borderColor: '#e94e00',
                }}
              >
                <img
                  src="/logo256.png"
                  alt="Nhyiraba HMS Logo"
                  className="w-32 h-32 md:w-40 md:h-40 object-contain"
                />
              </motion.div>
            </div>
          </motion.div>

          {/* Hotel Name Animation */}
          <AnimatePresence>
            {(stage === 'name' || stage === 'fade') && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: stage === 'fade' ? 0 : 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="text-center"
              >
                {/* Main hotel name */}
                <motion.h1
                  className="text-4xl md:text-6xl text-white mb-2"
                  style={{
                    textShadow: '0 4px 20px rgba(0,0,0,0.3)',
                    fontFamily: "'Playfair Display', serif",
                    fontWeight: '900',
                  }}
                >
                  {['N', 'h', 'y', 'i', 'r', 'a', 'b', 'a'].map((letter, index) => (
                    <motion.span
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.3,
                        delay: index * 0.1,
                        ease: 'easeOut',
                      }}
                    >
                      {letter}
                    </motion.span>
                  ))}
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.8 }}
                  className="text-xl md:text-2xl text-white/90 font-light tracking-wider"
                  style={{
                    textShadow: '0 2px 10px rgba(0,0,0,0.2)',
                  }}
                >
                  Hotel Management System
                </motion.p>

                {/* Decorative line */}
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 0.8, delay: 1.2 }}
                  className="h-0.5 bg-gradient-to-r from-transparent via-white to-transparent mt-4 mx-auto max-w-xs"
                />
              </motion.div>
            )}
          </AnimatePresence>


        </div>


      </motion.div>
    </AnimatePresence>
  );
};

export default SplashScreen;
