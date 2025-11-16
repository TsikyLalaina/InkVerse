declare module 'react-confetti' {
  import * as React from 'react';
  interface ConfettiProps {
    width?: number;
    height?: number;
    numberOfPieces?: number;
    recycle?: boolean;
    tweenDuration?: number;
    gravity?: number;
    wind?: number;
    initialVelocityX?: number;
    initialVelocityY?: number;
    run?: boolean;
    colors?: string[];
    drawShape?: (ctx: CanvasRenderingContext2D) => void;
    onConfettiComplete?: (confetti: any) => void;
    className?: string;
    style?: React.CSSProperties;
  }
  const Confetti: React.ComponentType<ConfettiProps>;
  export default Confetti;
}
