import { useState, useRef, useEffect } from "react";

interface SwipeToUnlockProps {
  onUnlock?: () => void;
  buttonText?: string;
  buttonColor?: string;
  chevronColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  unlockThreshold?: number;
}

function ChevronPattern({ color = "#029DE2" }: { color?: string }) {
  const CHEVRON_WIDTH = 23;
  const CHEVRON_COUNT = 30;
  const TOTAL_WIDTH = CHEVRON_WIDTH * CHEVRON_COUNT;
  
  return (
    <div className="absolute inset-0 overflow-hidden flex items-center">
      <div className="absolute left-0 flex h-full animate-chevron-slide" style={{ width: `${TOTAL_WIDTH}px` }}>
        {Array.from({ length: CHEVRON_COUNT }).map((_, i) => (
          <svg
            key={i}
            width={CHEVRON_WIDTH}
            height="45"
            viewBox="0 0 23 45"
            fill="none"
            className="shrink-0"
            style={{ opacity: 0.3 }}
          >
            <path
              d="M21 23.3333L11.5567 45H0.725962L10.1692 23.3333L0 0H10.8308L21 23.3333Z"
              fill={color}
            />
          </svg>
        ))}
      </div>
      <div 
        className="absolute left-0 flex h-full animate-chevron-slide-offset" 
        aria-hidden="true"
        style={{ width: `${TOTAL_WIDTH}px` }}
      >
        {Array.from({ length: CHEVRON_COUNT }).map((_, i) => (
          <svg
            key={i}
            width={CHEVRON_WIDTH}
            height="45"
            viewBox="0 0 23 45"
            fill="none"
            className="shrink-0"
            style={{ opacity: 0.3 }}
          >
            <path
              d="M21 23.3333L11.5567 45H0.725962L10.1692 23.3333L0 0H10.8308L21 23.3333Z"
              fill={color}
            />
          </svg>
        ))}
      </div>
    </div>
  );
}

interface ButtonProps {
  translateX: number;
  isDragging: boolean;
  isUnlocked: boolean;
  text: string;
  color: string;
}

function Button({ translateX, isDragging, isUnlocked, text, color }: ButtonProps) {
  return (
    <div
      className="absolute box-border content-stretch flex flex-col gap-[10px] items-center justify-center overflow-clip px-[24px] py-[14px] rounded-xl top-0 w-[94px] touch-none select-none cursor-grab active:cursor-grabbing"
      style={{
        backgroundColor: color,
        left: `${translateX}px`,
        transition: isDragging ? "none" : "left 0.3s ease-out",
        opacity: isUnlocked ? 0 : 1,
      }}
    >
      <p className="shrink-0 text-nowrap text-white whitespace-pre">
        {text}
      </p>
    </div>
  );
}

export default function SwipeToUnlock({
  onUnlock,
  buttonText = "Slide",
  buttonColor = "#029DE2",
  chevronColor = "#029DE2",
  backgroundColor = "#FFFFFF",
  borderColor = "#029DE2",
  unlockThreshold = 0.85,
}: SwipeToUnlockProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);

  const BUTTON_WIDTH = 94;

  const getMaxTranslateX = () => {
    if (!containerRef.current) return 0;
    const containerWidth = containerRef.current.offsetWidth;
    return containerWidth - BUTTON_WIDTH;
  };

  const handleStart = (clientX: number) => {
    if (isUnlocked) return;
    setIsDragging(true);
    startXRef.current = clientX - translateX;
    currentXRef.current = translateX;
  };

  const handleMove = (clientX: number) => {
    if (!isDragging || isUnlocked) return;

    const maxTranslate = getMaxTranslateX();
    const newTranslateX = clientX - startXRef.current;
    const clampedTranslate = Math.max(0, Math.min(newTranslateX, maxTranslate));

    setTranslateX(clampedTranslate);
    currentXRef.current = clampedTranslate;
  };

  const handleEnd = () => {
    if (!isDragging || isUnlocked) return;

    const maxTranslate = getMaxTranslateX();
    const unlockPosition = maxTranslate * unlockThreshold;

    if (currentXRef.current >= unlockPosition) {
      setTranslateX(maxTranslate);
      setIsUnlocked(true);
      setTimeout(() => {
        onUnlock?.();
      }, 300);
    } else {
      setTranslateX(0);
    }

    setIsDragging(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const handleMouseUp = () => handleEnd();

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, isUnlocked]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches?.[0];
    if (touch) {
      handleStart(touch.clientX);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches?.[0];
    if (touch) {
      handleMove(touch.clientX);
    }
  };

  const handleTouchEnd = () => {
    handleEnd();
  };

  useEffect(() => {
    if (isUnlocked) {
      const timer = setTimeout(() => {
        setIsUnlocked(false);
        setTranslateX(0);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isUnlocked]);

  return (
    <div
      ref={containerRef}
      className="relative rounded-xl h-[45px] w-full"
      style={{ backgroundColor }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="overflow-clip relative rounded-[inherit] size-full">
        <ChevronPattern color={chevronColor} />
        <Button
          translateX={translateX}
          isDragging={isDragging}
          isUnlocked={isUnlocked}
          text={buttonText}
          color={buttonColor}
        />
      </div>
      <div
        aria-hidden="true"
        className="absolute border-[1.5px] border-solid inset-0 pointer-events-none rounded-xl"
        style={{ borderColor }}
      />
      {isUnlocked && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="animate-pulse" style={{ color: borderColor }}>
            Booked! ✓
          </p>
        </div>
      )}
    </div>
  );
}