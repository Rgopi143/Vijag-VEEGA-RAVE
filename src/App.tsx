import { motion } from 'framer-motion';
import { Sparkles, ExternalLink } from 'lucide-react';
import confetti from 'canvas-confetti';

const GOOGLE_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLScwOfwR7hWB1A_UBKbesq7f9TCZ7FH6p9GNCDPx0Vj8YU0clQ/viewform?usp=publish-editor";

export default function App() {
  const handleButtonHover = () => {
    confetti({
      particleCount: 25,
      spread: 60,
      origin: { y: 0.5 },
      colors: ['#ff0a1a', '#ffffff', '#ffd700']
    });
  };

  return (
    <div className="app-container">
      
      {/* Background Ambient Spotlight */}
      <div className="bg-spotlight">
        <div className="spotlight-orb" />
      </div>

      {/* Focused Poster Container */}
      <main className="poster-main">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7 }}
          className="poster-card"
        >
          <div style={{ position: 'relative', width: '100%' }}>
            {/* Poster Image */}
            <img 
              src="/landing pic.PNG" 
              alt="VEEGA RAVE 2026 Poster" 
              className="poster-img"
            />

            {/* Pulse Ring Animation Behind Button */}
            <div className="pulse-ring" />

            {/* CENTERED INTERACTIVE "get Launch" BUTTON WRAPPER */}
            <div className="btn-wrapper">
              <motion.a
                href={GOOGLE_FORM_URL}
                target="_self"
                onMouseEnter={handleButtonHover}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                className="btn-get-launch"
              >
                <Sparkles className="btn-icon" />
                <span>get Launch</span>
                <ExternalLink className="btn-icon" />
              </motion.a>
            </div>
          </div>
        </motion.div>
      </main>

    </div>
  );
}
