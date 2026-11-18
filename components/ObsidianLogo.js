// Obsidian logo: ring, inner arc, dot and rounded play triangle. One color, transparent background.
import React from "react";
import Svg, { Circle, Path, Polygon } from "react-native-svg";

export default function ObsidianLogo({ size = 30, color = "#fff" }) {
  return (
    <Svg width={size} height={size} viewBox="177 152 900 900">
      <Circle cx="627" cy="602" r="396" stroke={color} strokeWidth="50" fill="none" />
      <Path
        d="M 578.8 297.8 A 308 308 0 0 0 341.4 717.4"
        stroke={color}
        strokeWidth="46"
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx="722" cy="325" r="28" fill={color} />
      <Polygon
        points="556,505 556,725 765,615"
        fill={color}
        stroke={color}
        strokeWidth="30"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
