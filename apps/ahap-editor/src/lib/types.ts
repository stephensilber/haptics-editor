export interface AhapEvent {
  id: string;
  type: "transient" | "continuous";
  time: number;
  duration: number;
  intensity: number;
  sharpness: number;
}

export interface AhapProject {
  name: string;
  events: AhapEvent[];
}
