import React from 'react';
import Svg, { Path, Circle, Ellipse } from 'react-native-svg';

const ChickIcon = ({ size = 24, color = "#4A90E2" }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* Round fluffy body */}
      <Circle
        cx="50"
        cy="60"
        r="25"
        stroke={color}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Round head overlapping body */}
      <Circle
        cx="50"
        cy="38"
        r="18"
        stroke={color}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Head tuft/feather on top */}
      <Path
        d="M 48 22 L 50 15 L 52 22"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Left eye */}
      <Circle cx="45" cy="36" r="5" fill={color} />
      
      {/* Right eye */}
      <Circle cx="55" cy="36" r="5" fill={color} />
      
      {/* Small triangular beak */}
      <Path
        d="M 50 42 L 50 46"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
      />
      <Path
        d="M 48 44 L 52 44"
        stroke={color}
        strokeWidth="7"
        strokeLinecap="round"
      />
      
      {/* Small wing on body */}
      <Path
        d="M 32 58 C 28 58, 26 60, 28 62"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Left foot */}
      <Path
        d="M 42 84 L 40 90 M 42 84 L 42 90 M 42 84 L 44 90"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Right foot */}
      <Path
        d="M 58 84 L 56 90 M 58 84 L 58 90 M 58 84 L 60 90"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

export default ChickIcon;
