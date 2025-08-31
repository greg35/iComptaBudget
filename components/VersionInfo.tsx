import { Badge } from "./ui/badge";

interface VersionInfoProps {
  className?: string;
  showPrefix?: boolean;
}

// Version extraite du package.json - sera injectée au build
declare const __APP_VERSION__: string;

export function VersionInfo({ className = "", showPrefix = true }: VersionInfoProps) {
  // Fallback si la variable n'est pas définie
  const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : "0.1.0";
  
  return (
    <Badge variant="secondary" className={`text-xs ${className}`}>
      {showPrefix ? "v" : ""}{version}
    </Badge>
  );
}

export function getAppVersion(): string {
  return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : "0.1.0";
}
