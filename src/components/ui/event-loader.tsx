import { Loader } from "./loader";

export function EventLoader() {
  return (
    <div className="event-loader-container">
      <div className="event-loader-content">
        <div className="loader-glow">
          <Loader />
        </div>
        <p className="loader-text">Creating amazing plans</p>
      </div>
      <style jsx>{`
        .event-loader-container {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          overflow: hidden;
          background: linear-gradient(
            180deg,
            #029de2 0%,
            #4db8ea 50%,
            #87d4f2 100%
          );
          background-size: 200% 200%;
          animation: gradientShift 4s ease-in-out infinite;
        }

        .event-loader-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          z-index: 1;
          padding: 32px;
        }

        .loader-glow {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 120px;
          height: 120px;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(255, 255, 255, 1) 0%,
            rgba(255, 255, 255, 0.8) 30%,
            rgba(255, 255, 255, 0.4) 60%,
            rgba(255, 255, 255, 0) 100%
          );
          animation: pulse 2s ease-in-out infinite;
        }

        .loader-text {
          font-family: "Inter", sans-serif;
          font-weight: 500;
          font-size: 16px;
          line-height: 1.2;
          color: white;
          text-align: center;
          white-space: nowrap;
        }

        @keyframes gradientShift {
          0% {
            background-position: 0% 0%;
          }
          50% {
            background-position: 0% 100%;
          }
          100% {
            background-position: 0% 0%;
          }
        }

        @keyframes pulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
